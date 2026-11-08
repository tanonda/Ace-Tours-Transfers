/**
 * Merge duplicate tour_instances rows created before the NULL-safe unique index.
 *
 * Two instances are duplicates when they share (tour_id, service_date,
 * COALESCE(time_slot,''), COALESCE(start_time,''), COALESCE(end_time,'')).
 * Old databases could create them because the original index treated NULLs as
 * distinct. This script picks the oldest instance as the keeper, moves every
 * hold/booking/audit row to it, sums the counters, and deletes the others.
 *
 *   npx tsx scripts/dedupe-tour-instances.ts            # report only
 *   npx tsx scripts/dedupe-tour-instances.ts --apply    # merge
 *
 * Run with `--apply` only during a quiet period: it takes row locks.
 */

import "dotenv/config";
import { db, pool, initializeDatabase } from "../server/db.js";
import { sql } from "drizzle-orm";

interface DuplicateGroup {
  ids: string[];
  confirmed: number[];
  held: number[];
  blocked: number[];
  capacity: number[];
}

async function findDuplicates() {
  await initializeDatabase();
  const result: any = await db.execute(sql`
    SELECT
      tour_id,
      service_date,
      COALESCE(time_slot, '')    AS time_slot,
      COALESCE(start_time, '')   AS start_time,
      COALESCE(end_time, '')     AS end_time,
      COUNT(*)::int              AS copies,
      array_agg(id              ORDER BY created_at, id) AS ids,
      array_agg(confirmed_count ORDER BY created_at, id) AS confirmed,
      array_agg(held_count      ORDER BY created_at, id) AS held,
      array_agg(blocked_count   ORDER BY created_at, id) AS blocked,
      array_agg(total_capacity  ORDER BY created_at, id) AS capacity
    FROM tour_instances
    GROUP BY tour_id, service_date, COALESCE(time_slot, ''), COALESCE(start_time, ''), COALESCE(end_time, '')
    HAVING COUNT(*) > 1
    ORDER BY tour_id, service_date
  `);
  return (result.rows ?? result) as Array<DuplicateGroup & Record<string, unknown>>;
}

async function mergeGroup(group: DuplicateGroup, apply: boolean): Promise<void> {
  const [keeper, ...duplicates] = group.ids;
  const sum = (values: number[]) => values.reduce((total, value) => total + Number(value || 0), 0);
  const confirmed = sum(group.confirmed);
  const held = sum(group.held);
  const blocked = sum(group.blocked);
  const capacity = Math.max(...group.capacity.map(Number));

  console.log(`  keeper ${keeper}: confirmed=${confirmed} held=${held} blocked=${blocked} capacity=${capacity}`);
  console.log(`  remove ${duplicates.length} duplicate(s): ${duplicates.join(", ")}`);
  if (!apply) return;

  await db.transaction(async (tx: any) => {
    for (const duplicate of duplicates) {
      await tx.execute(sql`UPDATE availability_holds SET tour_instance_id = ${keeper} WHERE tour_instance_id = ${duplicate}`);
      await tx.execute(sql`UPDATE bookings SET tour_instance_id = ${keeper} WHERE tour_instance_id = ${duplicate}`);
      await tx.execute(sql`UPDATE capacity_audit_log SET tour_instance_id = ${keeper} WHERE tour_instance_id = ${duplicate}`);
    }
    await tx.execute(sql`
      UPDATE tour_instances
      SET confirmed_count = ${confirmed},
          held_count = ${held},
          blocked_count = ${blocked},
          total_capacity = ${capacity},
          updated_at = NOW()
      WHERE id = ${keeper}
    `);
    // Guard against a concurrent instance being added under the same key.
    await tx.execute(sql`DELETE FROM tour_instances WHERE id IN (${sql.join(duplicates.map((id) => sql`${id}`), sql`, `)})`);
  });
}

async function main() {
  const apply = process.argv.includes("--apply");
  const groups = await findDuplicates();

  if (groups.length === 0) {
    console.log("No duplicate tour_instances found.");
    if (apply) {
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_tour_instances_unique_v2
        ON tour_instances (
          tour_id, service_date,
          COALESCE(time_slot, ''), COALESCE(start_time, ''), COALESCE(end_time, '')
        )
      `);
      console.log("Created idx_tour_instances_unique_v2.");
    } else {
      console.log("Re-run with --apply to create the unique index.");
    }
    return;
  }

  console.log(`Found ${groups.length} duplicate group(s).${apply ? " Merging..." : " Re-run with --apply to merge."}`);
  for (const group of groups) {
    await mergeGroup(group, apply);
  }
  if (apply) {
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tour_instances_unique_v2
      ON tour_instances (
        tour_id,
        service_date,
        COALESCE(time_slot, ''),
        COALESCE(start_time, ''),
        COALESCE(end_time, '')
      )
    `);
    console.log("Merged and created idx_tour_instances_unique_v2.");
  } else {
    console.log("Re-run with --apply to merge and create the unique index.");
  }
}

main()
  .catch((error) => {
    console.error("Dedupe failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool?.end?.().catch(() => undefined);
  });
