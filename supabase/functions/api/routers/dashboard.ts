// Port of backend/app/routers/dashboard.py.
import { Hono } from "hono";
import { getDb } from "../../_shared/db.ts";
import { requireAuth } from "../../_shared/auth.ts";

export const dashboardRouter = new Hono();

interface TypeStatusRow {
  animal_type: string;
  status: "alive" | "dead";
  count: number;
}

interface RecentAnimalRow {
  name: string;
  animal_type: string;
  created_at: Date;
}

interface RecentDeathRow {
  cause_of_death: string;
  created_at: Date;
  animal_id: number;
  animal_name: string | null;
}

interface RecentActivity {
  type: "animal_added" | "death_reported";
  description: string;
  timestamp: Date;
}

const RECENT_LIMIT = 5;

/** Matches Python's round(x, 1) for the values this endpoint ever produces
 * (a percentage in [0, 100]) — Number.EPSILON nudges away float noise like
 * 33.35 -> 33.449999999999996 before rounding to the nearest 0.1. */
function roundTo1(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

dashboardRouter.get("/stats", requireAuth, async (c) => {
  const user = c.get("user");
  const farmId = user.farm_id;
  const sql = getDb();

  // Aggregate counts by type/status in the database (no per-row loop).
  const rows = await sql<TypeStatusRow[]>`
    select animal_type, status, count(*)::int as count
    from animals
    where farm_id = ${farmId}
    group by animal_type, status
  `;

  const typeBreakdown: Record<string, number> = {};
  let total = 0;
  let alive = 0;
  for (const row of rows) {
    typeBreakdown[row.animal_type] = (typeBreakdown[row.animal_type] ?? 0) +
      row.count;
    total += row.count;
    if (row.status === "alive") alive += row.count;
  }
  const dead = total - alive;
  const deathRate = total > 0 ? roundTo1((dead / total) * 100) : 0.0;

  const activity: RecentActivity[] = [];

  const recentAnimals = await sql<RecentAnimalRow[]>`
    select name, animal_type, created_at
    from animals
    where farm_id = ${farmId}
    order by created_at desc
    limit ${RECENT_LIMIT}
  `;
  for (const a of recentAnimals) {
    activity.push({
      type: "animal_added",
      description: `${a.name} (${a.animal_type}) added`,
      timestamp: a.created_at,
    });
  }

  const recentDeaths = await sql<RecentDeathRow[]>`
    select d.cause_of_death, d.created_at, d.animal_id, a.name as animal_name
    from death_records d
    left join animals a on a.id = d.animal_id
    where d.farm_id = ${farmId}
    order by d.created_at desc
    limit ${RECENT_LIMIT}
  `;
  for (const d of recentDeaths) {
    const name = d.animal_name ?? `Animal #${d.animal_id}`;
    activity.push({
      type: "death_reported",
      description: `Death reported for ${name}: ${d.cause_of_death}`,
      timestamp: d.created_at,
    });
  }

  activity.sort((x, y) => y.timestamp.getTime() - x.timestamp.getTime());
  const recentActivity = activity.slice(0, RECENT_LIMIT);

  // Feed items at or below their re-order threshold — drives the low-stock
  // alert on the dashboard.
  const lowFeed = await sql<
    {
      id: number;
      name: string;
      quantity: number;
      low_stock_threshold: number;
    }[]
  >`
    select id, name, quantity, low_stock_threshold
    from feed_items
    where farm_id = ${farmId} and quantity <= low_stock_threshold
    order by quantity asc
  `;

  return c.json({
    total_animals: total,
    alive_count: alive,
    dead_count: dead,
    death_rate: deathRate,
    type_breakdown: typeBreakdown,
    recent_activity: recentActivity,
    low_feed: lowFeed,
  });
});
