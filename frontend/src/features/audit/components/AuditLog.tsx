import { useCallback, useEffect, useState } from 'react';
import { apiFetch, type Page } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollText, ChevronLeft, ChevronRight } from 'lucide-react';

interface AuditEntry {
  id: number;
  actor_user_id: number | null;
  actor_username: string | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  details: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
}

const PAGE_SIZE = 20;

const ACTION_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  create: 'default',
  update: 'secondary',
  delete: 'destructive',
  login: 'secondary',
  account_locked: 'destructive',
  password_change: 'secondary',
};

export const AuditLog: React.FC = () => {
  const [data, setData] = useState<Page<AuditEntry> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAudit = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await apiFetch<Page<AuditEntry>>(`/api/audit?page=${p}&limit=${PAGE_SIZE}`);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAudit(page);
  }, [page, fetchAudit]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ScrollText className="h-6 w-6" /> Audit Log
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Every create, update, delete, and sign-in across your farm — {data?.total ?? 0} entries
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">When</th>
              <th className="px-4 py-3 text-left font-medium">Who</th>
              <th className="px-4 py-3 text-left font-medium">Action</th>
              <th className="px-4 py-3 text-left font-medium">Entity</th>
              <th className="px-4 py-3 text-left font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : !data || data.items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No audit entries yet
                </td>
              </tr>
            ) : (
              data.items.map((e) => (
                <tr key={e.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{e.actor_username ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={ACTION_VARIANT[e.action] ?? 'secondary'}>{e.action}</Badge>
                  </td>
                  <td className="px-4 py-3 capitalize">
                    {e.entity_type}
                    {e.entity_id != null ? ` #${e.entity_id}` : ''}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono max-w-xs truncate">
                    {e.details ? JSON.stringify(e.details) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
