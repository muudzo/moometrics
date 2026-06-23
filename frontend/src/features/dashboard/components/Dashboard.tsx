import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PawPrint, HeartPulse, Skull, TrendingDown } from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { apiFetch } from '@/services/api';

interface RecentActivity {
  type: 'animal_added' | 'death_reported';
  description: string;
  timestamp: string;
}

interface DashboardStats {
  total_animals: number;
  alive_count: number;
  dead_count: number;
  death_rate: number;
  type_breakdown: Record<string, number>;
  recent_activity: RecentActivity[];
}

const PIE_COLORS = ['#4a5c2a', '#8ba155', '#c8a97e', '#a37c5b', '#6b8e5e', '#d4a853', '#9ca3af'];

export function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<DashboardStats>('/api/dashboard/stats')
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load stats'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      </div>
    );
  }

  const pieData = stats
    ? Object.entries(stats.type_breakdown).map(([name, value]) => ({ name, value }))
    : [];

  const kpis = [
    {
      label: 'Total Animals',
      value: stats?.total_animals ?? 0,
      icon: PawPrint,
      description: 'All records',
    },
    {
      label: 'Alive',
      value: stats?.alive_count ?? 0,
      icon: HeartPulse,
      description: 'Currently alive',
      className: 'text-green-600',
    },
    {
      label: 'Dead',
      value: stats?.dead_count ?? 0,
      icon: Skull,
      description: 'Recorded deaths',
      className: 'text-destructive',
    },
    {
      label: 'Death Rate',
      value: `${stats?.death_rate ?? 0}%`,
      icon: TrendingDown,
      description: 'Of total animals',
      className: (stats?.death_rate ?? 0) > 10 ? 'text-destructive' : 'text-muted-foreground',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Welcome back, <span className="font-medium">{user?.username}</span> &mdash;{' '}
          <span className="capitalize">{user?.role}</span>
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, description, className }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className={`h-4 w-4 ${className ?? 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${className ?? ''}`}>{value}</div>
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Animal Type Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Animal Type Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                No animal data yet
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" outerRadius={70} innerRadius={40}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="space-y-1 text-sm">
                  {pieData.map(({ name, value }, i) => (
                    <li key={name} className="flex items-center gap-2 capitalize">
                      <span
                        className="inline-block w-3 h-3 rounded-full"
                        style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      {name}: <span className="font-medium">{value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {!stats?.recent_activity?.length ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                No recent activity
              </div>
            ) : (
              <ul className="space-y-3">
                {stats.recent_activity.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span
                      className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                        item.type === 'death_reported' ? 'bg-destructive' : 'bg-green-500'
                      }`}
                    />
                    <div>
                      <p>{item.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
