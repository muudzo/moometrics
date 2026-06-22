import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { CloudUpload, RotateCw, Trash2, CheckCircle2 } from 'lucide-react';
import { useOutbox } from '@/hooks/useOutbox';
import { drainOutbox, retryItem, discardItem } from '@/services/outbox';

/** Header widget showing the offline write queue and letting users retry/sync. */
export function OutboxStatus() {
  const { items, pending, failed } = useOutbox();
  const total = items.length;

  if (total === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative" aria-label="Offline queue">
          <CloudUpload className="w-4 h-4" />
          <Badge
            variant={failed > 0 ? 'destructive' : 'secondary'}
            className="ml-1 px-1.5 py-0 text-xs"
          >
            {pending + failed}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium">Offline queue</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => drainOutbox()}
            disabled={pending === 0 || !navigator.onLine}
          >
            <RotateCw className="w-3 h-3 mr-1" /> Sync now
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          {pending} waiting to sync{failed > 0 ? `, ${failed} need attention` : ''}.
        </p>
        <ul className="space-y-2 max-h-72 overflow-auto">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-2 rounded-md border px-2 py-1.5 text-xs"
            >
              <div className="min-w-0">
                <p className="font-medium capitalize">
                  {item.type} — <span className="font-normal">{item.label}</span>
                </p>
                {item.status === 'failed' ? (
                  <p className="text-destructive">{item.error ?? 'Rejected'}</p>
                ) : (
                  <p className="text-muted-foreground">Waiting to sync…</p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                {item.status === 'failed' && (
                  <button
                    className="text-muted-foreground hover:text-foreground"
                    title="Retry"
                    onClick={() => retryItem(item.id as number)}
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  className="text-muted-foreground hover:text-destructive"
                  title="Discard"
                  onClick={() => discardItem(item.id as number)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
        {pending === 0 && failed === 0 && (
          <p className="flex items-center gap-1 text-xs text-green-600 mt-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> All changes synced
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
