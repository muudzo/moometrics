import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the network layer; keep the real ApiError for instanceof checks.
vi.mock('@/services/api', async (importActual) => {
  const actual = await importActual<typeof import('@/services/api')>();
  return { ...actual, apiFetch: vi.fn() };
});

import { apiFetch, ApiError } from '@/services/api';
import {
  outboxDB,
  enqueueAnimal,
  enqueueFeedTransaction,
  drainOutbox,
  listOutbox,
} from '@/services/outbox';

const mockedApiFetch = apiFetch as unknown as ReturnType<typeof vi.fn>;

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}

beforeEach(async () => {
  await outboxDB.outbox.clear();
  mockedApiFetch.mockReset();
  // Stay "offline" so enqueue's auto-drain is a no-op; we drain explicitly.
  setOnline(false);
});

describe('offline outbox', () => {
  it('enqueues an animal as pending', async () => {
    await enqueueAnimal({ name: 'Bessie', animal_type: 'cattle' }, 'Bessie');
    const items = await listOutbox();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ type: 'animal', status: 'pending', label: 'Bessie' });
  });

  it('removes an item from the queue after a successful sync', async () => {
    await enqueueAnimal({ name: 'A', animal_type: 'cattle' }, 'A');
    mockedApiFetch.mockResolvedValue({ id: 1 });
    setOnline(true);
    await drainOutbox();
    expect(await listOutbox()).toHaveLength(0);
  });

  it('marks an item failed on a permanent error (409) without blocking the queue', async () => {
    await enqueueAnimal({ name: 'Dup', animal_type: 'cattle' }, 'Dup');
    await enqueueAnimal({ name: 'Ok', animal_type: 'cattle' }, 'Ok');
    mockedApiFetch
      .mockRejectedValueOnce(new ApiError(409, 'Tag taken'))
      .mockResolvedValueOnce({ id: 2 });
    setOnline(true);
    await drainOutbox();
    const items = await listOutbox();
    expect(items).toHaveLength(1); // first failed, second synced & removed
    expect(items[0]).toMatchObject({ status: 'failed', error: 'Tag taken' });
  });

  it('keeps an item pending on a transient error (offline)', async () => {
    await enqueueAnimal({ name: 'A', animal_type: 'cattle' }, 'A');
    mockedApiFetch.mockRejectedValue(new ApiError(0, 'offline'));
    setOnline(true);
    await drainOutbox();
    const items = await listOutbox();
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('pending');
  });

  it('enqueues a feed transaction with a client_txn_id baked in at enqueue time', async () => {
    await enqueueFeedTransaction(7, -3, 'Morning feed', 'Dairy Meal: -3 bags');
    const items = await listOutbox();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ type: 'feed_usage', status: 'pending' });
    expect(items[0].payload).toMatchObject({ feed_item_id: 7, delta: -3 });
    // The idempotency key must exist BEFORE any sync attempt so every replay
    // of this item carries the same key.
    expect(items[0].payload.client_txn_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('replays a feed transaction to the feed endpoint and preserves the same key across retries', async () => {
    await enqueueFeedTransaction(7, -3, null, 'Dairy Meal: -3 bags');
    const [queued] = await listOutbox();
    const originalKey = queued.payload.client_txn_id;

    // First drain attempt fails transiently — item stays pending.
    mockedApiFetch.mockRejectedValueOnce(new ApiError(503, 'server hiccup'));
    setOnline(true);
    await drainOutbox();
    expect((await listOutbox())[0].status).toBe('pending');

    // Second attempt succeeds — same endpoint, same idempotency key.
    mockedApiFetch.mockResolvedValueOnce({ item: { id: 7, quantity: 4 }, duplicate: false });
    await drainOutbox();
    expect(await listOutbox()).toHaveLength(0);

    const calls = mockedApiFetch.mock.calls.filter(([url]) =>
      String(url).includes('/api/feed/7/transactions')
    );
    expect(calls).toHaveLength(2);
    for (const [, init] of calls) {
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.client_txn_id).toBe(originalKey);
    }
  });
});
