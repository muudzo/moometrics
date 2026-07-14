/**
 * Offline write queue (outbox).
 *
 * Animal and death-report writes captured while offline are persisted to
 * IndexedDB (via Dexie) and replayed in order when connectivity returns. Death
 * images are stored as Blobs and hashed client-side (SHA-256) so a worker can
 * be warned about duplicates before queueing.
 *
 * Replay error policy:
 *  - permanent (4xx except 401/429): mark the item failed with the server's
 *    reason and move on — never silently drop or infinitely retry.
 *  - transient (offline / timeout / 429 / 5xx): stop the drain and retry later.
 */
import Dexie, { type Table } from 'dexie';
import { apiFetch, ApiError } from './api';

export type OutboxType = 'animal' | 'death' | 'feed_usage';
export type OutboxStatus = 'pending' | 'failed';

export interface OutboxItem {
  id?: number;
  type: OutboxType;
  payload: Record<string, unknown>;
  imageBlob?: Blob;
  imageName?: string;
  imageHash?: string;
  status: OutboxStatus;
  error?: string;
  label: string;
  createdAt: number;
}

class OutboxDB extends Dexie {
  outbox!: Table<OutboxItem, number>;

  constructor() {
    super('moometrics-outbox');
    this.version(1).stores({ outbox: '++id, type, status, createdAt' });
  }
}

export const outboxDB = new OutboxDB();

export async function sha256Hex(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// --- pub/sub so the UI can reflect queue changes -------------------------
type Listener = () => void;
const listeners = new Set<Listener>();
function notify() {
  listeners.forEach((l) => l());
}
export function subscribeOutbox(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function listOutbox(): Promise<OutboxItem[]> {
  return outboxDB.outbox.orderBy('createdAt').toArray();
}

export async function enqueueAnimal(
  payload: Record<string, unknown>,
  label: string
): Promise<void> {
  await outboxDB.outbox.add({
    type: 'animal',
    payload,
    status: 'pending',
    label,
    createdAt: Date.now(),
  });
  notify();
  void drainOutbox();
}

export async function enqueueDeath(
  fields: Record<string, string>,
  image: File,
  label: string
): Promise<string> {
  const imageHash = await sha256Hex(image);
  await outboxDB.outbox.add({
    type: 'death',
    payload: fields,
    imageBlob: image,
    imageName: image.name,
    imageHash,
    status: 'pending',
    label,
    createdAt: Date.now(),
  });
  notify();
  void drainOutbox();
  return imageHash;
}

/**
 * Queue a feed stock change (+ restock, − usage) for offline sync.
 *
 * The idempotency key (client_txn_id) is generated HERE, at enqueue time, and
 * travels inside the payload — so however many times the drain replays this
 * item, the server sees the same key and applies the delta exactly once.
 */
export async function enqueueFeedTransaction(
  feedItemId: number,
  delta: number,
  reason: string | null,
  label: string
): Promise<void> {
  await outboxDB.outbox.add({
    type: 'feed_usage',
    payload: {
      feed_item_id: feedItemId,
      delta,
      reason,
      client_txn_id: crypto.randomUUID(),
    },
    status: 'pending',
    label,
    createdAt: Date.now(),
  });
  notify();
  void drainOutbox();
}

function isPermanent(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    err.status >= 400 &&
    err.status < 500 &&
    err.status !== 401 &&
    err.status !== 429
  );
}

let draining = false;

/** One replay request per outbox type — add new offline-capable entities here. */
const replayRequest: Record<OutboxType, (item: OutboxItem) => Promise<unknown>> = {
  animal: (item) =>
    apiFetch('/api/animals', { method: 'POST', body: JSON.stringify(item.payload) }),
  death: (item) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(item.payload)) fd.append(k, v as string);
    fd.append('file', item.imageBlob as Blob, item.imageName ?? 'photo');
    return apiFetch('/api/deaths', { method: 'POST', body: fd });
  },
  feed_usage: (item) =>
    apiFetch(`/api/feed/${item.payload.feed_item_id}/transactions`, {
      method: 'POST',
      body: JSON.stringify(item.payload),
    }),
};

/** Replay pending items in order. Safe to call repeatedly. */
export async function drainOutbox(): Promise<void> {
  if (draining || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
  draining = true;
  try {
    const pending = (await outboxDB.outbox.where('status').equals('pending').toArray()).sort(
      (a, b) => a.createdAt - b.createdAt
    );
    for (const item of pending) {
      try {
        await replayRequest[item.type](item);
        await outboxDB.outbox.delete(item.id as number);
      } catch (err) {
        if (isPermanent(err)) {
          await outboxDB.outbox.update(item.id as number, {
            status: 'failed',
            error: err instanceof ApiError ? err.message : 'Rejected by server',
          });
        } else {
          // transient — stop; a later online event or retry will resume.
          break;
        }
      } finally {
        notify();
      }
    }
  } finally {
    draining = false;
    notify();
  }
}

export async function retryItem(id: number): Promise<void> {
  await outboxDB.outbox.update(id, { status: 'pending', error: undefined });
  notify();
  void drainOutbox();
}

export async function discardItem(id: number): Promise<void> {
  await outboxDB.outbox.delete(id);
  notify();
}

// Auto-drain when connectivity returns.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void drainOutbox();
  });
}
