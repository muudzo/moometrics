import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the network layer; keep the real ApiError for instanceof checks.
vi.mock('@/services/api', async (importActual) => {
  const actual = await importActual<typeof import('@/services/api')>();
  return { ...actual, apiFetch: vi.fn() };
});

import { apiFetch, ApiError } from '@/services/api';
import { outboxDB, enqueueAnimal, drainOutbox, listOutbox } from '@/services/outbox';

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
});
