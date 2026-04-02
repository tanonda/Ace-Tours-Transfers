/**
 * cleanup-products.ts
 * 
 * Cleans up duplicate product listings, merges Efate tours,
 * sets vehicle contact-for-price, and merges data from deleted duplicates.
 * 
 * Runs against BOTH databases to keep them in sync.
 * 
 * Usage:  npx tsx cleanup-products.ts
 */

import pg from "pg";
const { Client } = pg;

const OLD_DB_URL = "postgresql://neondb_owner:REDACTED@ep-bitter-frog-a7zxak3x-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require";
const NEW_DB_URL = "postgresql://neondb_owner:REDACTED@ep-delicate-king-am3aopbg-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require";

// ── IDs to DELETE (bare seed duplicates + test entry) ───────────────────────
const IDS_TO_DELETE = [
  // TOURS — bare seed duplicates
  "3aabf032-1063-4a0d-a718-971d20248262", // "Efate Scenic Product" (bare seed)
  "afcac012-6eef-4023-a1c5-d56691e4fffb", // "Roots & Routes Product" (bare seed)
  "ecf59564-4044-47af-a7a1-cb3a9ea892c9", // "Blue Lagoon & Turtle Bay Combo" (bare seed)
  "019ab373-946b-4429-b0bc-b24ada42a08d", // "Pele Island Beach Day" (bare seed)
  "49e217e4-0487-4809-a0e8-a691cdabba76", // "Test Product 1774546792413" (test entry)

  // TOURS — Efate merge: delete "Efate Scenic Tour", keep "Full-Day Efate Scenic Round Island Tour"
  "0faa77fb-8d08-4890-8ea2-9d6015809154", // "Efate Scenic Tour" (merge into Full-Day variant)

  // TRANSFERS — bare seed duplicates
  "0cdd0499-ab37-46c2-aa23-42fcb989f592", // "Airport Transfer" (bare seed)
  "586deae7-0a12-4c68-8c93-e8bc13b6bcd0", // "Dinner Transfer (Round Trip)" (bare seed)
  "1629ada6-4b71-4494-8aec-fb92454ea318", // "Wharf / Cruise Ship Transfer" (bare seed)
  "08a2fb55-4139-4982-8a84-309c9b8b58ed", // "Event Transfer Package" (bare seed)

  // VEHICLES — bare seed duplicates
  "06234179-1cb5-4449-8441-1a0ffb07bcef", // "Ford Ranger Wildtrak" (bare seed)
  "67d154d7-6d8a-4c75-a193-f4ccbc854dd5", // "Hyundai Grand i10" (bare seed)
  "53ee5214-89f0-4863-885a-f46e713c1a7e", // "Kia Cerato Sedan" (bare seed)
  "4f21bb09-c06f-439f-a6fe-c26bc1d0a02b", // "Suzuki Jimny" (bare seed)
  "dafaee85-cdea-4c8b-8496-9f142cf6b4fc", // "Toyota Hiace Bus" (bare seed)
  "c5f9c8ba-f914-450a-b923-ba487d4e16f4", // "Toyota Hilux 4WD" (bare seed)
];

// ── Data merge map: source (being deleted) → target (being kept) ────────────
// We'll copy included_items, excluded_items, support_email, support_phone,
// cancellation_policy from the source if the target is missing them.
const MERGE_MAP: { sourceId: string; targetId: string; label: string }[] = [
  // Airport Transfer seed → Premium Airport Transfer
  { sourceId: "0cdd0499-ab37-46c2-aa23-42fcb989f592", targetId: "602f6517-8f99-4e2d-9316-e803f40957b4", label: "Airport Transfer → Premium Airport Transfer" },
  // Dinner Transfer seed → Dinner Transfer refined
  { sourceId: "586deae7-0a12-4c68-8c93-e8bc13b6bcd0", targetId: "36a21c27-a805-461f-8f42-ab4331cdd678", label: "Dinner Transfer seed → refined" },
  // Wharf Transfer seed → Wharf Transfer refined
  { sourceId: "1629ada6-4b71-4494-8aec-fb92454ea318", targetId: "445b3808-fbee-4a9b-9aaa-73fe30b350e0", label: "Wharf Transfer seed → refined" },
  // Toyota Hilux seed → refined (has included_items + support)
  { sourceId: "c5f9c8ba-f914-450a-b923-ba487d4e16f4", targetId: "db634559-5fdc-4e8b-9a49-d7d7ec6d5dbd", label: "Toyota Hilux seed → refined" },
];

// ── Vehicle IDs to set contact_for_price = true ──────────────────────────────
const VEHICLE_IDS_CONTACT_FOR_PRICE = [
  "dc445dd1-5653-444e-99c3-c81106e2f60a", // Ford Ranger Wildtrak
  "b3057338-9b8e-4840-aff7-ceba8eed407d", // Hyundai Grand i10
  "3b0428ff-2f1f-49fa-a07b-72814972e151", // Kia Cerato Sedan
  "a9ebfa1d-7734-49a1-8a28-d2ecbbbd26f4", // Suzuki Jimny
  "925a00cb-7aef-4b2f-9934-3a16ebd46fc5", // Toyota Hiace Bus
  "db634559-5fdc-4e8b-9a49-d7d7ec6d5dbd", // Toyota Hilux 4WD
  "ef2a01bf-dbf8-4e4f-b8d9-7b6b7d0746c1", // Toyota Prado SUV
  "8ffdeaab-f076-4355-9ded-f00a937b4d42", // 15-Seater Minibus
];

// ── Efate Tour merge: update the kept "Full-Day" variant ─────────────────────
const EFATE_KEEP_ID = "03db4647-1499-4156-aa0f-7997e3703955"; // Full-Day Efate Scenic Round Island Tour
const EFATE_DELETE_ID = "0faa77fb-8d08-4890-8ea2-9d6015809154"; // Efate Scenic Tour

async function runCleanup(client: pg.Client, dbLabel: string) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  RUNNING CLEANUP ON: ${dbLabel}`);
  console.log(`${"═".repeat(60)}`);

  // ── Step 1: Merge data from duplicates into kept versions ────────────
  console.log("\n━━━ Step 1: Merging data from duplicates → kept versions ━━━");

  for (const { sourceId, targetId, label } of MERGE_MAP) {
    try {
      const sourceRes = await client.query(
        `SELECT included_items, excluded_items, support_email, support_phone, cancellation_policy FROM products WHERE id = $1`,
        [sourceId]
      );
      if (sourceRes.rows.length === 0) {
        console.log(`   ⏭️  Source not found: ${label}`);
        continue;
      }

      const source = sourceRes.rows[0];
      const targetRes = await client.query(
        `SELECT included_items, excluded_items, support_email, support_phone, cancellation_policy FROM products WHERE id = $1`,
        [targetId]
      );
      if (targetRes.rows.length === 0) {
        console.log(`   ⏭️  Target not found: ${label}`);
        continue;
      }

      const target = targetRes.rows[0];
      const updates: string[] = [];
      const values: any[] = [];
      let paramIdx = 1;

      // Copy included_items if target is empty/null and source has data
      if (source.included_items && JSON.stringify(source.included_items) !== "[]" && (!target.included_items || JSON.stringify(target.included_items) === "[]")) {
        updates.push(`included_items = $${paramIdx++}`);
        values.push(JSON.stringify(source.included_items));
      }

      // Copy excluded_items
      if (source.excluded_items && JSON.stringify(source.excluded_items) !== "[]" && (!target.excluded_items || JSON.stringify(target.excluded_items) === "[]")) {
        updates.push(`excluded_items = $${paramIdx++}`);
        values.push(JSON.stringify(source.excluded_items));
      }

      // Copy support_email
      if (source.support_email && !target.support_email) {
        updates.push(`support_email = $${paramIdx++}`);
        values.push(source.support_email);
      }

      // Copy support_phone
      if (source.support_phone && !target.support_phone) {
        updates.push(`support_phone = $${paramIdx++}`);
        values.push(source.support_phone);
      }

      // Copy cancellation_policy
      if (source.cancellation_policy && !target.cancellation_policy) {
        updates.push(`cancellation_policy = $${paramIdx++}`);
        values.push(source.cancellation_policy);
      }

      if (updates.length > 0) {
        values.push(targetId);
        await client.query(
          `UPDATE products SET ${updates.join(", ")} WHERE id = $${paramIdx}`,
          values
        );
        console.log(`   ✅ Merged ${updates.length} fields: ${label}`);
      } else {
        console.log(`   ⏭️  Nothing to merge: ${label}`);
      }
    } catch (err: any) {
      console.error(`   ❌ Merge error (${label}): ${err.message}`);
    }
  }

  // ── Step 2: Merge Efate Tours ───────────────────────────────────────
  console.log("\n━━━ Step 2: Merging Efate Tours ━━━");

  try {
    // Check if the Efate Scenic Tour exists (it may have different SEO data worth keeping)
    const efateDeleteRes = await client.query(`SELECT seo_title, listing_order FROM products WHERE id = $1`, [EFATE_DELETE_ID]);
    
    if (efateDeleteRes.rows.length > 0) {
      const efateDelete = efateDeleteRes.rows[0];
      
      // Update the kept Full-Day version with a cleaner title and the SEO from the delete version if better
      await client.query(`
        UPDATE products SET
          title = 'Efate Scenic Round Island Tour',
          seo_title = COALESCE(seo_title, $1),
          listing_order = CASE WHEN listing_order = 0 THEN $2 ELSE listing_order END
        WHERE id = $3
      `, [efateDelete.seo_title, efateDelete.listing_order, EFATE_KEEP_ID]);

      console.log(`   ✅ Merged Efate Tour into single listing: "Efate Scenic Round Island Tour"`);
    } else {
      console.log(`   ⏭️  Efate Scenic Tour not found (may already be deleted)`);
    }
  } catch (err: any) {
    console.error(`   ❌ Efate merge error: ${err.message}`);
  }

  // ── Step 3: Set vehicle listings to contact_for_price ────────────────
  console.log("\n━━━ Step 3: Setting vehicle listings to contact_for_price ━━━");

  for (const vId of VEHICLE_IDS_CONTACT_FOR_PRICE) {
    try {
      const res = await client.query(
        `UPDATE products SET contact_for_price = true WHERE id = $1 RETURNING title`,
        [vId]
      );
      if (res.rows.length > 0) {
        console.log(`   ✅ ${res.rows[0].title} → contact_for_price = true`);
      } else {
        console.log(`   ⏭️  Vehicle ID ${vId.substring(0, 8)} not found`);
      }
    } catch (err: any) {
      console.error(`   ❌ Vehicle update error: ${err.message}`);
    }
  }

  // ── Step 4: Delete duplicates ────────────────────────────────────────
  console.log("\n━━━ Step 4: Deleting duplicate/test listings ━━━");

  // First clean up any FK references (tour_instances, availability_holds, etc.)
  for (const id of IDS_TO_DELETE) {
    try {
      // Clean tour_instances and their holds
      const instances = await client.query(`SELECT id FROM tour_instances WHERE tour_id = $1`, [id]);
      for (const inst of instances.rows) {
        await client.query(`DELETE FROM availability_holds WHERE tour_instance_id = $1`, [inst.id]);
      }
      await client.query(`DELETE FROM tour_instances WHERE tour_id = $1`, [id]);

      // Clean other FK references
      await client.query(`DELETE FROM product_blackout_dates WHERE product_id = $1`, [id]);
      await client.query(`DELETE FROM pricing_versions WHERE product_id = $1`, [id]);
      await client.query(`DELETE FROM resources WHERE product_id = $1`, [id]);
      await client.query(`DELETE FROM wishlist_items WHERE tour_id = $1`, [id]);

      // Clean reviews (FK to tour_id)
      await client.query(`DELETE FROM reviews WHERE tour_id = $1`, [id]);

      // Now delete the product
      const res = await client.query(`DELETE FROM products WHERE id = $1 RETURNING title`, [id]);
      if (res.rows.length > 0) {
        console.log(`   🗑️  Deleted: ${res.rows[0].title}`);
      } else {
        console.log(`   ⏭️  Already gone: ${id.substring(0, 8)}`);
      }
    } catch (err: any) {
      console.error(`   ❌ Delete error (${id.substring(0, 8)}): ${err.message}`);
    }
  }

  // ── Step 5: Also set VIP Executive Transfer pricing ──────────────────
  console.log("\n━━━ Step 5: Fix VIP Executive Transfer pricing ━━━");
  try {
    await client.query(`
      UPDATE products SET
        adult_price_cents = 5000,
        pricing_type = 'group',
        group_price_cents = 5000,
        price = '5000 VUV'
      WHERE id = '214d8d80-f909-4e5f-a96f-c18a049b6f4e'
    `);
    console.log(`   ✅ VIP Executive Transfer → VUV 5000/trip`);
  } catch (err: any) {
    console.error(`   ❌ VIP pricing error: ${err.message}`);
  }

  // ── Verification ─────────────────────────────────────────────────────
  console.log("\n━━━ Verification ━━━");
  const countRes = await client.query(`SELECT category, COUNT(*) as c FROM products GROUP BY category ORDER BY category`);
  let total = 0;
  for (const r of countRes.rows) {
    console.log(`   ${r.category}: ${r.c} products`);
    total += parseInt(r.c);
  }
  console.log(`   TOTAL: ${total} products`);

  // Check for any remaining products with adult_price_cents=0 and contact_for_price=false
  const zeroPriceRes = await client.query(`
    SELECT title, category FROM products 
    WHERE adult_price_cents = 0 AND contact_for_price = false AND pricing_type = 'per_person'
  `);
  if (zeroPriceRes.rows.length > 0) {
    console.log("\n   ⚠️  Products with zero price and no contact-for-price:");
    for (const r of zeroPriceRes.rows) {
      console.log(`      - ${r.title} (${r.category})`);
    }
  }
}

async function main() {
  const newClient = new Client({ connectionString: NEW_DB_URL });
  const oldClient = new Client({ connectionString: OLD_DB_URL });

  try {
    console.log("🔌 Connecting to both databases…");
    await newClient.connect();
    await oldClient.connect();
    console.log("✅ Connected\n");

    // Run cleanup on NEW database first
    await runCleanup(newClient, "NEW DATABASE (US East)");

    // Then run same cleanup on OLD database
    await runCleanup(oldClient, "OLD DATABASE (AP Southeast)");

    console.log("\n\n🎉 Cleanup complete on both databases!");

  } finally {
    await newClient.end();
    await oldClient.end();
    console.log("🔌 Connections closed.");
  }
}

main().catch((err) => {
  console.error("❌ Cleanup failed:", err);
  process.exit(1);
});
