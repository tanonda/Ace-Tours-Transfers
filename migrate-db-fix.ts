/**
 * migrate-db-fix.ts
 * 
 * Fixes the tables that had unique-slug/key conflicts during the initial migration.
 * Strategy: DELETE existing rows in the new DB, then re-insert from old DB.
 * 
 * Tables fixed:
 *  - content_blocks       (slug unique constraint)
 *  - site_settings        (key unique constraint)
 *  - feature_flags        (slug unique constraint)
 *  - payment_gateways     (slug unique constraint)
 *
 * Usage:  npx tsx migrate-db-fix.ts
 */

import pg from "pg";
const { Client } = pg;

const OLD_DB_URL = "postgresql://neondb_owner:REDACTED@ep-bitter-frog-a7zxak3x-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require";
const NEW_DB_URL = "postgresql://neondb_owner:REDACTED@ep-delicate-king-am3aopbg-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function main() {
  const oldClient = new Client({ connectionString: OLD_DB_URL });
  const newClient = new Client({ connectionString: NEW_DB_URL });

  try {
    console.log("🔌 Connecting to databases…");
    await oldClient.connect();
    await newClient.connect();
    console.log("✅ Both databases connected\n");

    // ─── content_blocks ─────────────────────────────────────────────────
    console.log("━━━ Fixing: content_blocks ━━━");
    const cbRows = (await oldClient.query("SELECT * FROM content_blocks")).rows;
    console.log(`   📦 ${cbRows.length} rows from old DB`);
    
    // Delete all content_blocks in new DB and re-insert
    await newClient.query("DELETE FROM cms_content"); // must delete child rows first (references block_slug)
    await newClient.query("DELETE FROM content_blocks");
    console.log("   🗑️  Cleared content_blocks (and cms_content) in new DB");
    
    for (const r of cbRows) {
      await newClient.query(
        `INSERT INTO content_blocks (id, slug, label, description, enabled, config, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [r.id, r.slug, r.label, r.description, r.enabled,
         r.config ? JSON.stringify(r.config) : null, r.updated_at]
      );
    }
    console.log(`   ✅ Inserted ${cbRows.length} content_blocks`);

    // Now re-insert cms_content
    console.log("\n━━━ Fixing: cms_content ━━━");
    const cmsRows = (await oldClient.query("SELECT * FROM cms_content")).rows;
    console.log(`   📦 ${cmsRows.length} rows from old DB`);
    
    for (const r of cmsRows) {
      await newClient.query(
        `INSERT INTO cms_content (id, block_slug, content_key, content_type, value, locale, sort_order, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [r.id, r.block_slug, r.content_key, r.content_type, r.value,
         r.locale, r.sort_order, r.created_at, r.updated_at]
      );
    }
    console.log(`   ✅ Inserted ${cmsRows.length} cms_content`);

    // ─── site_settings ──────────────────────────────────────────────────
    console.log("\n━━━ Fixing: site_settings ━━━");
    const ssRows = (await oldClient.query("SELECT * FROM site_settings")).rows;
    console.log(`   📦 ${ssRows.length} rows from old DB`);
    
    await newClient.query("DELETE FROM site_settings");
    console.log("   🗑️  Cleared site_settings in new DB");
    
    for (const r of ssRows) {
      await newClient.query(
        `INSERT INTO site_settings (id, key, value, updated_at)
         VALUES ($1,$2,$3,$4)`,
        [r.id, r.key, r.value ? JSON.stringify(r.value) : null, r.updated_at]
      );
    }
    console.log(`   ✅ Inserted ${ssRows.length} site_settings`);

    // ─── feature_flags ──────────────────────────────────────────────────
    console.log("\n━━━ Fixing: feature_flags ━━━");
    const ffRows = (await oldClient.query("SELECT * FROM feature_flags")).rows;
    console.log(`   📦 ${ffRows.length} rows from old DB`);
    
    await newClient.query("DELETE FROM feature_flags");
    console.log("   🗑️  Cleared feature_flags in new DB");
    
    for (const r of ffRows) {
      await newClient.query(
        `INSERT INTO feature_flags (id, slug, enabled, display_name, description, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [r.id, r.slug, r.enabled, r.display_name, r.description, r.updated_at]
      );
    }
    console.log(`   ✅ Inserted ${ffRows.length} feature_flags`);

    // ─── payment_gateways ───────────────────────────────────────────────
    console.log("\n━━━ Fixing: payment_gateways ━━━");
    const pgRows = (await oldClient.query("SELECT * FROM payment_gateways")).rows;
    console.log(`   📦 ${pgRows.length} rows from old DB`);
    
    // Check if any payments reference these gateways
    const paymentCount = (await newClient.query("SELECT COUNT(*) as c FROM payments")).rows[0].c;
    if (parseInt(paymentCount) > 0) {
      console.log(`   ⚠️  ${paymentCount} payments exist — using upsert strategy instead of delete`);
      for (const r of pgRows) {
        await newClient.query(
          `INSERT INTO payment_gateways (id, slug, display_name, description, active, is_default, priority, credentials, supported_currencies, config, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (slug) DO UPDATE SET
             display_name = EXCLUDED.display_name,
             description = EXCLUDED.description,
             active = EXCLUDED.active,
             is_default = EXCLUDED.is_default,
             priority = EXCLUDED.priority,
             credentials = EXCLUDED.credentials,
             supported_currencies = EXCLUDED.supported_currencies,
             config = EXCLUDED.config,
             updated_at = EXCLUDED.updated_at`,
          [r.id, r.slug, r.display_name, r.description, r.active, r.is_default, r.priority,
           r.credentials ? JSON.stringify(r.credentials) : null,
           r.supported_currencies ? JSON.stringify(r.supported_currencies) : null,
           r.config ? JSON.stringify(r.config) : null,
           r.created_at, r.updated_at]
        );
      }
    } else {
      await newClient.query("DELETE FROM payment_gateways");
      console.log("   🗑️  Cleared payment_gateways in new DB");
      
      for (const r of pgRows) {
        await newClient.query(
          `INSERT INTO payment_gateways (id, slug, display_name, description, active, is_default, priority, credentials, supported_currencies, config, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [r.id, r.slug, r.display_name, r.description, r.active, r.is_default, r.priority,
           r.credentials ? JSON.stringify(r.credentials) : null,
           r.supported_currencies ? JSON.stringify(r.supported_currencies) : null,
           r.config ? JSON.stringify(r.config) : null,
           r.created_at, r.updated_at]
        );
      }
    }
    console.log(`   ✅ Inserted ${pgRows.length} payment_gateways`);

    // ─── Verification ───────────────────────────────────────────────────
    console.log("\n\n🎉 Fix migration complete!");
    console.log("\n━━━ Verification: Row counts in NEW database ━━━");
    const verifyTables = [
      "products", "product_translations", "content_blocks", "cms_content",
      "site_settings", "feature_flags", "payment_gateways", "users"
    ];
    for (const t of verifyTables) {
      try {
        const result = await newClient.query(`SELECT COUNT(*) as count FROM ${t}`);
        console.log(`   ${t}: ${result.rows[0].count} rows`);
      } catch {
        console.log(`   ${t}: (table does not exist yet)`);
      }
    }

    // Compare counts with old DB
    console.log("\n━━━ Comparison: Row counts OLD vs NEW ━━━");
    for (const t of verifyTables) {
      try {
        const oldCount = (await oldClient.query(`SELECT COUNT(*) as count FROM ${t}`)).rows[0].count;
        const newCount = (await newClient.query(`SELECT COUNT(*) as count FROM ${t}`)).rows[0].count;
        const match = oldCount === newCount ? "✅" : "⚠️";
        console.log(`   ${match} ${t}: old=${oldCount} new=${newCount}`);
      } catch (e: any) {
        console.log(`   ⏭️  ${t}: ${e.message}`);
      }
    }

  } finally {
    await oldClient.end();
    await newClient.end();
    console.log("\n🔌 Connections closed.");
  }
}

main().catch((err) => {
  console.error("❌ Fix migration failed:", err);
  process.exit(1);
});
