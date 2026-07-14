// Feed inventory: per-farm named feed items with a running bag count and an
// append-only transaction log (+ restock, - usage). Designed for offline
// clients: transactions carry a client-generated UUID, and a replayed
// duplicate is answered with 200 + current state — never an error — so the
// outbox can safely retry after a dropped response without surfacing a
// false failure to the user.
import { Hono } from "hono";
import { getDb, isUniqueViolation } from "../../_shared/db.ts";
import { parsePagination } from "../../_shared/pagination.ts";
import { jsonError, pageEnvelope } from "../../_shared/response.ts";
import { recordAudit } from "../../_shared/auditService.ts";
import { requireAuth, requireManager } from "../../_shared/auth.ts";
import {
  FeedItemCreateSchema,
  FeedItemUpdateSchema,
  FeedTransactionSchema,
  firstZodError,
} from "../../_shared/validation.ts";

const NAME_TAKEN = "A feed item with this name already exists";
const NOT_FOUND = "Feed item not found";

export const feedRouter = new Hono();

feedRouter.use("*", requireAuth);

interface FeedItemRow {
  id: number;
  farm_id: number;
  name: string;
  quantity: number;
  low_stock_threshold: number;
  created_at: Date;
  updated_at: Date;
}

interface FeedTransactionRow {
  id: number;
  feed_item_id: number;
  delta: number;
  reason: string | null;
  recorded_by_user_id: number;
  created_at: Date;
}

function parseId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  return parseInt(raw, 10);
}

async function getOwnedItem(
  itemId: number,
  farmId: number,
): Promise<FeedItemRow | null> {
  const sql = getDb();
  const [item] = await sql<FeedItemRow[]>`
    select * from feed_items where id = ${itemId} and farm_id = ${farmId}
  `;
  return item ?? null;
}

feedRouter.get("/", async (c) => {
  const user = c.get("user");
  const paged = parsePagination(c);
  if (!paged.ok) return jsonError(c, 422, paged.error);
  const { page, limit, offset } = paged.pagination;

  const sql = getDb();
  const [{ count }] = await sql<{ count: number }[]>`
    select count(*)::int as count from feed_items where farm_id = ${user.farm_id}
  `;
  const items = await sql<FeedItemRow[]>`
    select * from feed_items
    where farm_id = ${user.farm_id}
    order by name asc
    offset ${offset} limit ${limit}
  `;
  return c.json(pageEnvelope(items, count, page, limit));
});

feedRouter.post("/", requireManager, async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => null);
  const parsed = FeedItemCreateSchema.safeParse(body);
  if (!parsed.success) return jsonError(c, 422, firstZodError(parsed));
  const data = parsed.data;

  const sql = getDb();
  let item: FeedItemRow;
  try {
    [item] = await sql<FeedItemRow[]>`
      insert into feed_items (farm_id, name, quantity, low_stock_threshold)
      values (${user.farm_id}, ${data.name}, ${data.quantity}, ${data.low_stock_threshold})
      returning *
    `;
  } catch (err) {
    if (isUniqueViolation(err)) return jsonError(c, 409, NAME_TAKEN);
    throw err;
  }

  await recordAudit({
    c,
    actor: user,
    action: "create",
    entityType: "feed_item",
    entityId: item.id,
    details: { name: item.name, quantity: item.quantity },
  });
  return c.json(item, 201);
});

feedRouter.put("/:id", requireManager, async (c) => {
  const user = c.get("user");
  const id = parseId(c.req.param("id"));
  if (id === null) {
    return jsonError(c, 422, "id: Input should be a valid integer");
  }

  const existing = await getOwnedItem(id, user.farm_id);
  if (!existing) return jsonError(c, 404, NOT_FOUND);

  const body = await c.req.json().catch(() => null);
  const parsed = FeedItemUpdateSchema.safeParse(body);
  if (!parsed.success) return jsonError(c, 422, firstZodError(parsed));

  const name = parsed.data.name ?? existing.name;
  const threshold = parsed.data.low_stock_threshold ??
    existing.low_stock_threshold;

  const sql = getDb();
  let updated: FeedItemRow;
  try {
    [updated] = await sql<FeedItemRow[]>`
      update feed_items
      set name = ${name}, low_stock_threshold = ${threshold}, updated_at = now()
      where id = ${id} and farm_id = ${user.farm_id}
      returning *
    `;
  } catch (err) {
    if (isUniqueViolation(err)) return jsonError(c, 409, NAME_TAKEN);
    throw err;
  }

  await recordAudit({
    c,
    actor: user,
    action: "update",
    entityType: "feed_item",
    entityId: id,
    details: { name, low_stock_threshold: threshold },
  });
  return c.json(updated);
});

feedRouter.delete("/:id", requireManager, async (c) => {
  const user = c.get("user");
  const id = parseId(c.req.param("id"));
  if (id === null) {
    return jsonError(c, 422, "id: Input should be a valid integer");
  }

  const existing = await getOwnedItem(id, user.farm_id);
  if (!existing) return jsonError(c, 404, NOT_FOUND);

  const sql = getDb();
  // Transaction history intentionally cascades away with the item.
  await sql`delete from feed_items where id = ${id} and farm_id = ${user.farm_id}`;

  await recordAudit({
    c,
    actor: user,
    action: "delete",
    entityType: "feed_item",
    entityId: id,
  });
  return c.body(null, 204);
});

feedRouter.post("/:id/transactions", async (c) => {
  const user = c.get("user");
  const id = parseId(c.req.param("id"));
  if (id === null) {
    return jsonError(c, 422, "id: Input should be a valid integer");
  }

  const item = await getOwnedItem(id, user.farm_id);
  if (!item) return jsonError(c, 404, NOT_FOUND);

  const body = await c.req.json().catch(() => null);
  const parsed = FeedTransactionSchema.safeParse(body);
  if (!parsed.success) return jsonError(c, 422, firstZodError(parsed));
  const { delta, reason, client_txn_id: clientTxnId } = parsed.data;

  const sql = getDb();
  let updatedItem: FeedItemRow;
  try {
    [updatedItem] = await sql.begin(async (tx) => {
      await tx`
        insert into feed_transactions
          (farm_id, feed_item_id, delta, reason, recorded_by_user_id, client_txn_id)
        values
          (${user.farm_id}, ${id}, ${delta}, ${
        reason ?? null
      }, ${user.id}, ${clientTxnId})
      `;
      const [updated] = await tx<FeedItemRow[]>`
        update feed_items set quantity = quantity + ${delta}, updated_at = now()
        where id = ${id}
        returning *
      `;
      return [updated];
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      // Outbox replay of a transaction that already landed (e.g. the network
      // dropped after the server committed but before the client saw the
      // response). This is a SUCCESS from the client's point of view — a 4xx
      // here would make the outbox mark a completed sync as failed.
      const current = await getOwnedItem(id, user.farm_id);
      return c.json({ item: current, duplicate: true });
    }
    throw err;
  }

  await recordAudit({
    c,
    actor: user,
    action: delta > 0 ? "feed_restock" : "feed_usage",
    entityType: "feed_item",
    entityId: id,
    details: { delta, reason: reason ?? null, client_txn_id: clientTxnId },
  });
  return c.json({ item: updatedItem, duplicate: false }, 201);
});

feedRouter.get("/:id/transactions", async (c) => {
  const user = c.get("user");
  const id = parseId(c.req.param("id"));
  if (id === null) {
    return jsonError(c, 422, "id: Input should be a valid integer");
  }

  const item = await getOwnedItem(id, user.farm_id);
  if (!item) return jsonError(c, 404, NOT_FOUND);

  const paged = parsePagination(c);
  if (!paged.ok) return jsonError(c, 422, paged.error);
  const { page, limit, offset } = paged.pagination;

  const sql = getDb();
  const [{ count }] = await sql<{ count: number }[]>`
    select count(*)::int as count from feed_transactions where feed_item_id = ${id}
  `;
  const rows = await sql<FeedTransactionRow[]>`
    select id, feed_item_id, delta, reason, recorded_by_user_id, created_at
    from feed_transactions
    where feed_item_id = ${id}
    order by created_at desc
    offset ${offset} limit ${limit}
  `;
  return c.json(pageEnvelope(rows, count, page, limit));
});
