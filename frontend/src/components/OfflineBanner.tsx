import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/**
 * Persistent banner shown while the device is offline. Honest messaging is
 * the launch substitute for a true offline write-queue: the user can read
 * cached records but is told plainly that new entries cannot be saved yet.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      role="status"
      aria-live="assertive"
      className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-950"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>
        You&rsquo;re offline. You can view saved records, but new entries and edits can&rsquo;t be
        saved until you reconnect.
      </span>
    </div>
  );
}
