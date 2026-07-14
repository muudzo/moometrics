import { assert, assertEquals } from "@std/assert";
import { getDb } from "./db.ts";
import { checkRateLimit } from "./rateLimit.ts";

Deno.test("rate limit allows up to the limit, then rejects", async () => {
  const bucket = `smoketest:${crypto.randomUUID()}`;
  for (let i = 1; i <= 5; i++) {
    assert(
      await checkRateLimit(bucket, 5, 60),
      `attempt ${i} should be allowed`,
    );
  }
  // 6th attempt in the same window must be rejected — proves the counter is
  // actually shared/persisted (Postgres-backed), not per-isolate memory.
  assertEquals(await checkRateLimit(bucket, 5, 60), false);

  const sql = getDb();
  await sql`delete from rate_limit_hits where bucket = ${bucket}`;
});

Deno.test("stale windows for a bucket are garbage-collected on the next hit", async () => {
  const bucket = `smoketest-gc:${crypto.randomUUID()}`;
  const sql = getDb();
  const staleWindow = new Date(Date.now() - 10 * 60_000);
  await sql`
    insert into rate_limit_hits (bucket, window_start, hits)
    values (${bucket}, ${staleWindow}, 5)
  `;

  // A fresh hit must both succeed (old window doesn't count against the
  // limit) and sweep the stale row.
  assert(await checkRateLimit(bucket, 5, 60));
  const rows = await sql<
    { window_start: Date }[]
  >`select window_start from rate_limit_hits where bucket = ${bucket}`;
  assertEquals(rows.length, 1);
  assert(rows[0].window_start > staleWindow);

  await sql`delete from rate_limit_hits where bucket = ${bucket}`;
  await sql.end();
});
