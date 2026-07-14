import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { apiFetch, ApiError, type Page } from '@/services/api';
import { enqueueFeedTransaction } from '@/services/outbox';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Wheat, Plus, Pencil, Trash2, PackageMinus, PackagePlus } from 'lucide-react';

interface FeedItem {
  id: number;
  name: string;
  quantity: number;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
}

interface FeedTransactionResponse {
  item: FeedItem;
  duplicate: boolean;
}

const emptyItemForm = { name: '', quantity: '0', low_stock_threshold: '5' };
const emptyTxnForm = { amount: '1', reason: '' };

export const FeedManagement: React.FC = () => {
  const { user } = useAuth();
  const online = useOnlineStatus();
  const isManager = user?.role === 'manager';

  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add / edit feed item (manager only)
  const [itemOpen, setItemOpen] = useState(false);
  const [editing, setEditing] = useState<FeedItem | null>(null);
  const [itemForm, setItemForm] = useState({ ...emptyItemForm });
  const [itemLoading, setItemLoading] = useState(false);
  const [itemError, setItemError] = useState<string | null>(null);

  // Record usage / restock (both roles, offline-capable)
  const [txnOpen, setTxnOpen] = useState(false);
  const [txnItem, setTxnItem] = useState<FeedItem | null>(null);
  const [txnDirection, setTxnDirection] = useState<'usage' | 'restock'>('usage');
  const [txnForm, setTxnForm] = useState({ ...emptyTxnForm });
  const [txnLoading, setTxnLoading] = useState(false);
  const [txnError, setTxnError] = useState<string | null>(null);
  const [queuedNotice, setQueuedNotice] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      const data = await apiFetch<Page<FeedItem>>('/api/feed?limit=200');
      setItems(data.items);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load feed inventory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const openAddItem = () => {
    setEditing(null);
    setItemForm({ ...emptyItemForm });
    setItemError(null);
    setItemOpen(true);
  };

  const openEditItem = (item: FeedItem) => {
    setEditing(item);
    setItemForm({
      name: item.name,
      quantity: String(item.quantity),
      low_stock_threshold: String(item.low_stock_threshold),
    });
    setItemError(null);
    setItemOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!online) {
      setItemError(
        "You're offline — feed setup needs a connection. Recording usage works offline."
      );
      return;
    }
    setItemLoading(true);
    setItemError(null);
    try {
      if (editing) {
        await apiFetch<FeedItem>(`/api/feed/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: itemForm.name,
            low_stock_threshold: parseInt(itemForm.low_stock_threshold, 10),
          }),
        });
      } else {
        await apiFetch<FeedItem>('/api/feed', {
          method: 'POST',
          body: JSON.stringify({
            name: itemForm.name,
            quantity: parseInt(itemForm.quantity, 10) || 0,
            low_stock_threshold: parseInt(itemForm.low_stock_threshold, 10) || 0,
          }),
        });
      }
      setItemOpen(false);
      await fetchItems();
    } catch (err) {
      setItemError(err instanceof ApiError ? err.message : 'Failed to save feed item');
    } finally {
      setItemLoading(false);
    }
  };

  const handleDeleteItem = async (item: FeedItem) => {
    if (!online) {
      alert("You're offline — cannot delete right now. Reconnect and try again.");
      return;
    }
    if (!confirm(`Delete ${item.name} and its history? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/feed/${item.id}`, { method: 'DELETE' });
      await fetchItems();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete feed item');
    }
  };

  const openTxn = (item: FeedItem, direction: 'usage' | 'restock') => {
    setTxnItem(item);
    setTxnDirection(direction);
    setTxnForm({ ...emptyTxnForm });
    setTxnError(null);
    setTxnOpen(true);
  };

  const handleTxn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txnItem) return;
    const amount = parseInt(txnForm.amount, 10);
    if (!Number.isInteger(amount) || amount <= 0) {
      setTxnError('Enter a positive number of bags');
      return;
    }
    const delta = txnDirection === 'usage' ? -amount : amount;
    const label = `${txnItem.name}: ${delta > 0 ? '+' : ''}${delta} bags`;

    const queueOffline = async () => {
      await enqueueFeedTransaction(txnItem.id, delta, txnForm.reason || null, label);
      // Optimistically reflect the change so the stock the worker sees matches
      // what they just recorded, even before the sync lands.
      setItems((prev) =>
        prev.map((i) => (i.id === txnItem.id ? { ...i, quantity: i.quantity + delta } : i))
      );
      setTxnOpen(false);
      setQueuedNotice(`${label} saved offline — will sync when you're back online.`);
    };

    if (!online) {
      await queueOffline();
      return;
    }

    setTxnLoading(true);
    setTxnError(null);
    try {
      await apiFetch<FeedTransactionResponse>(`/api/feed/${txnItem.id}/transactions`, {
        method: 'POST',
        body: JSON.stringify({
          delta,
          reason: txnForm.reason || null,
          client_txn_id: crypto.randomUUID(),
        }),
      });
      setTxnOpen(false);
      await fetchItems();
    } catch (err) {
      // Network failure mid-submit: queue it rather than lose the entry.
      if (err instanceof ApiError && err.isOffline) {
        await queueOffline();
      } else {
        setTxnError(err instanceof ApiError ? err.message : 'Failed to record');
      }
    } finally {
      setTxnLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading feed inventory...</p>
      </div>
    );
  }

  const lowCount = items.filter((i) => i.quantity <= i.low_stock_threshold).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wheat className="h-6 w-6" /> Feed Inventory
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {items.length} feed {items.length === 1 ? 'type' : 'types'}
            {lowCount > 0 && ` — ${lowCount} running low`}
          </p>
        </div>
        {isManager && (
          <Button onClick={openAddItem}>
            <Plus className="h-4 w-4 mr-2" /> Add Feed Type
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {queuedNotice && (
        <div className="rounded-md bg-primary/10 border border-primary/20 px-3 py-2 text-sm">
          {queuedNotice}
        </div>
      )}

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Feed</th>
              <th className="px-4 py-3 text-left font-medium">Bags on hand</th>
              <th className="px-4 py-3 text-left font-medium">Re-up at</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  {isManager
                    ? 'No feed types yet — add one to start tracking stock'
                    : 'No feed types have been set up yet'}
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const low = item.quantity <= item.low_stock_threshold;
                return (
                  <tr key={item.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3">
                      <span className={low ? 'font-bold text-destructive' : 'font-bold'}>
                        {item.quantity}
                      </span>
                      {item.quantity < 0 && (
                        <span className="ml-2 text-xs text-muted-foreground">recount needed</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.low_stock_threshold} bags
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={low ? 'destructive' : 'default'}>
                        {low ? 'Re-up needed' : 'OK'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        <Button size="sm" variant="outline" onClick={() => openTxn(item, 'usage')}>
                          <PackageMinus className="h-3 w-3 mr-1" /> Use
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openTxn(item, 'restock')}
                        >
                          <PackagePlus className="h-3 w-3 mr-1" /> Restock
                        </Button>
                        {isManager && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => openEditItem(item)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteItem(item)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add / edit feed item dialog (manager) */}
      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Feed Type' : 'Add Feed Type'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveItem} className="space-y-4">
            {itemError && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {itemError}
              </div>
            )}
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input
                value={itemForm.name}
                onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                placeholder="e.g. Dairy Meal"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {!editing && (
                <div className="space-y-1">
                  <Label>Bags on hand</Label>
                  <Input
                    type="number"
                    min="0"
                    value={itemForm.quantity}
                    onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })}
                  />
                </div>
              )}
              <div className="space-y-1">
                <Label>Alert when at or below</Label>
                <Input
                  type="number"
                  min="0"
                  value={itemForm.low_stock_threshold}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, low_stock_threshold: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setItemOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={itemLoading || !itemForm.name}>
                {itemLoading ? 'Saving...' : editing ? 'Save Changes' : 'Add Feed Type'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Record usage / restock dialog (both roles, offline-capable) */}
      <Dialog open={txnOpen} onOpenChange={setTxnOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {txnDirection === 'usage' ? 'Record Feed Usage' : 'Record Restock'}
              {txnItem && ` — ${txnItem.name}`}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTxn} className="space-y-4">
            {txnError && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {txnError}
              </div>
            )}
            <div className="space-y-1">
              <Label>{txnDirection === 'usage' ? 'Bags used *' : 'Bags added *'}</Label>
              <Input
                type="number"
                min="1"
                value={txnForm.amount}
                onChange={(e) => setTxnForm({ ...txnForm, amount: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Note</Label>
              <Input
                value={txnForm.reason}
                onChange={(e) => setTxnForm({ ...txnForm, reason: e.target.value })}
                placeholder={txnDirection === 'usage' ? 'e.g. Morning feed' : 'e.g. Delivery'}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTxnOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={txnLoading}>
                {txnLoading ? 'Recording...' : online ? 'Record' : 'Save offline'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
