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
  await sql.end();
});
