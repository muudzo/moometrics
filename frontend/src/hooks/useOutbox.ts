import { useEffect, useState } from 'react';
import { listOutbox, subscribeOutbox, type OutboxItem } from '@/services/outbox';

export interface OutboxState {
  items: OutboxItem[];
  pending: number;
  failed: number;
}

/** Subscribe to the offline outbox and re-render on any change. */
export function useOutbox(): OutboxState {
  const [items, setItems] = useState<OutboxItem[]>([]);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      listOutbox().then((next) => {
        if (active) setItems(next);
      });
    };
    const unsubscribe = subscribeOutbox(refresh);
    refresh();
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return {
    items,
    pending: items.filter((i) => i.status === 'pending').length,
    failed: items.filter((i) => i.status === 'failed').length,
  };
}
