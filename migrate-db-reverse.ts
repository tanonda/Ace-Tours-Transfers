/**
 * migrate-db-reverse.ts
 * 
 * Syncs data FROM the NEW database INTO the OLD database.
 * Uses upsert (ON CONFLICT on slug/key) so existing rows get updated
 * and missing rows get inserted.
 * 
 * Tables synced:
 *  - users (admin/staff only)
 *  - products
 *  - product_translations
 *  - content_blocks + cms_content
 *  - site_settings
 *  - feature_flags
 *  - payment_gateways
 *  - addons
 *  - reviews
 *  - promotions
 *
 * Usage:  npx tsx migrate-db-reverse.ts
 */

import pg from "pg";
const { Client } = pg;

const OLD_DB_URL = process.env.OLD_DATABASE_URL ?? "";
const NEW_DB_URL = process.env.DATABASE_URL;
if (!NEW_DB_URL) throw new Error("DATABASE_URL is required");

function placeholders(count: number): string {
  return Array.from({ length: count }, (_, i) => `$${i + 1}`).join(", ");
}

async function syncTable(
  source: pg.Client,
  target: pg.Client,
  label: string,
  selectQuery: string,
  insertFn: (r: any) => { sql: string; values: any[] },
) {
  console.log(`\n━━━ Syncing: ${label} ━━━`);
  let rows: any[];
  try {
    rows = (await source.query(selectQuery)).rows;
  } catch (err: any) {
    if (err.message?.includes("does not exist")) {
      console.log(`   ⏭️  Table does not exist in source — skipping`);
      return;
    }
    throw err;
  }

  console.log(`   📦 ${rows.length} rows in source`);
  if (rows.length === 0) { console.log("   ⏭️  Nothing to sync"); return; }

  let ok = 0, fail = 0;
  for (const r of rows) {
    try {
      const { sql, values } = insertFn(r);
      await target.query(sql, values);
      ok++;
    } catch (err: any) {
      fail++;
      if (fail <= 3) console.error(`   ❌ ${err.message}`);
    }
  }
  console.log(`   ✅ Synced: ${ok} | ❌ Errors: ${fail}`);
}

async function main() {
  const oldClient = new Client({ connectionString: OLD_DB_URL });
  const newClient = new Client({ connectionString: NEW_DB_URL });

  try {
    console.log("🔌 Connecting to databases…");
    await newClient.connect();
    await oldClient.connect();
    console.log("✅ Both connected\n");

    // ─── Users (admin/staff) ────────────────────────────────────────────
    await syncTable(newClient, oldClient, "users",
      `SELECT * FROM users WHERE role IN ('admin', 'field_service')`,
      (r) => ({
        sql: `INSERT INTO users (id, username, password, email, role, name, phone, created_at, updated_at, is_active, password_reset_token, password_reset_token_expiry, totp_secret, totp_enabled)
              VALUES (${placeholders(14)})
              ON CONFLICT (id) DO UPDATE SET
                username = EXCLUDED.username, password = EXCLUDED.password,
                email = EXCLUDED.email, role = EXCLUDED.role, name = EXCLUDED.name,
                phone = EXCLUDED.phone, totp_secret = EXCLUDED.totp_secret,
                totp_enabled = EXCLUDED.totp_enabled`,
        values: [r.id, r.username, r.password, r.email, r.role, r.name, r.phone,
                 r.created_at, r.updated_at, r.is_active, r.password_reset_token,
                 r.password_reset_token_expiry, r.totp_secret, r.totp_enabled],
      })
    );

    // ─── Products ───────────────────────────────────────────────────────
    await syncTable(newClient, oldClient, "products",
      `SELECT * FROM products`,
      (r) => ({
        sql: `INSERT INTO products (
                id, title, price, child_price, adult_price_cents, child_price_cents,
                infant_price_cents, pet_price_cents, pricing_type, group_price_cents,
                group_max_pax, duration, min_pax, image, description, category,
                is_active, capacity, default_capacity, vehicle_details,
                seo_title, seo_description, seo_keywords, geo_targeting,
                listing_order, image_alt, itinerary_stops, itinerary_intro,
                contact_for_price, meeting_point, meeting_point_map_url,
                pickup_instructions, operating_hours, included_items,
                excluded_items, cancellation_policy, booking_cutoff_hours,
                additional_info, support_email, support_phone, product_code,
                traveler_photos
              ) VALUES (${placeholders(42)})
              ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title, price = EXCLUDED.price,
                child_price = EXCLUDED.child_price,
                adult_price_cents = EXCLUDED.adult_price_cents,
                child_price_cents = EXCLUDED.child_price_cents,
                infant_price_cents = EXCLUDED.infant_price_cents,
                pet_price_cents = EXCLUDED.pet_price_cents,
                pricing_type = EXCLUDED.pricing_type,
                group_price_cents = EXCLUDED.group_price_cents,
                group_max_pax = EXCLUDED.group_max_pax,
                duration = EXCLUDED.duration, min_pax = EXCLUDED.min_pax,
                image = EXCLUDED.image, description = EXCLUDED.description,
                category = EXCLUDED.category, is_active = EXCLUDED.is_active,
                capacity = EXCLUDED.capacity,
                default_capacity = EXCLUDED.default_capacity,
                vehicle_details = EXCLUDED.vehicle_details,
                seo_title = EXCLUDED.seo_title,
                seo_description = EXCLUDED.seo_description,
                seo_keywords = EXCLUDED.seo_keywords,
                geo_targeting = EXCLUDED.geo_targeting,
                listing_order = EXCLUDED.listing_order,
                image_alt = EXCLUDED.image_alt,
                itinerary_stops = EXCLUDED.itinerary_stops,
                itinerary_intro = EXCLUDED.itinerary_intro,
                contact_for_price = EXCLUDED.contact_for_price,
                meeting_point = EXCLUDED.meeting_point,
                meeting_point_map_url = EXCLUDED.meeting_point_map_url,
                pickup_instructions = EXCLUDED.pickup_instructions,
                operating_hours = EXCLUDED.operating_hours,
                included_items = EXCLUDED.included_items,
                excluded_items = EXCLUDED.excluded_items,
                cancellation_policy = EXCLUDED.cancellation_policy,
                booking_cutoff_hours = EXCLUDED.booking_cutoff_hours,
                additional_info = EXCLUDED.additional_info,
                support_email = EXCLUDED.support_email,
                support_phone = EXCLUDED.support_phone,
                product_code = EXCLUDED.product_code,
                traveler_photos = EXCLUDED.traveler_photos`,
        values: [
          r.id, r.title, r.price, r.child_price, r.adult_price_cents, r.child_price_cents,
          r.infant_price_cents, r.pet_price_cents, r.pricing_type, r.group_price_cents,
          r.group_max_pax, r.duration, r.min_pax, r.image, r.description, r.category,
          r.is_active, r.capacity, r.default_capacity,
          r.vehicle_details ? JSON.stringify(r.vehicle_details) : null,
          r.seo_title, r.seo_description, r.seo_keywords, r.geo_targeting,
          r.listing_order, r.image_alt,
          r.itinerary_stops ? JSON.stringify(r.itinerary_stops) : null,
          r.itinerary_intro, r.contact_for_price, r.meeting_point, r.meeting_point_map_url,
          r.pickup_instructions, r.operating_hours,
          r.included_items ? JSON.stringify(r.included_items) : null,
          r.excluded_items ? JSON.stringify(r.excluded_items) : null,
          r.cancellation_policy, r.booking_cutoff_hours,
          r.additional_info ? JSON.stringify(r.additional_info) : null,
          r.support_email, r.support_phone, r.product_code,
          r.traveler_photos ? JSON.stringify(r.traveler_photos) : null,
        ],
      })
    );

    // ─── Content Blocks (delete + reinsert to avoid slug conflicts) ─────
    console.log("\n━━━ Syncing: content_blocks (full replace) ━━━");
    const newCbRows = (await newClient.query("SELECT * FROM content_blocks")).rows;
    console.log(`   📦 ${newCbRows.length} rows in new DB`);

    // Must clear cms_content first (FK on block_slug), then content_blocks
    await oldClient.query("DELETE FROM cms_content");
    await oldClient.query("DELETE FROM content_blocks");
    console.log("   🗑️  Cleared content_blocks + cms_content in old DB");

    for (const r of newCbRows) {
      await oldClient.query(
        `INSERT INTO content_blocks (id, slug, label, description, enabled, config, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [r.id, r.slug, r.label, r.description, r.enabled,
         r.config ? JSON.stringify(r.config) : null, r.updated_at]
      );
    }
    console.log(`   ✅ Inserted ${newCbRows.length} content_blocks`);

    // ─── CMS Content ────────────────────────────────────────────────────
    console.log("\n━━━ Syncing: cms_content (full replace) ━━━");
    const newCmsRows = (await newClient.query("SELECT * FROM cms_content")).rows;
    console.log(`   📦 ${newCmsRows.length} rows in new DB`);

    for (const r of newCmsRows) {
      await oldClient.query(
        `INSERT INTO cms_content (id, block_slug, content_key, content_type, value, locale, sort_order, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [r.id, r.block_slug, r.content_key, r.content_type, r.value,
         r.locale, r.sort_order, r.created_at, r.updated_at]
      );
    }
    console.log(`   ✅ Inserted ${newCmsRows.length} cms_content`);

    // ─── Site Settings (full replace) ───────────────────────────────────
    console.log("\n━━━ Syncing: site_settings (full replace) ━━━");
    const newSsRows = (await newClient.query("SELECT * FROM site_settings")).rows;
    console.log(`   📦 ${newSsRows.length} rows in new DB`);

    await oldClient.query("DELETE FROM site_settings");
    console.log("   🗑️  Cleared site_settings in old DB");

    for (const r of newSsRows) {
      await oldClient.query(
        `INSERT INTO site_settings (id, key, value, updated_at) VALUES ($1,$2,$3,$4)`,
        [r.id, r.key, r.value ? JSON.stringify(r.value) : null, r.updated_at]
      );
    }
    console.log(`   ✅ Inserted ${newSsRows.length} site_settings`);

    // ─── Feature Flags (full replace) ───────────────────────────────────
    console.log("\n━━━ Syncing: feature_flags (full replace) ━━━");
    const newFfRows = (await newClient.query("SELECT * FROM feature_flags")).rows;
    console.log(`   📦 ${newFfRows.length} rows in new DB`);

    await oldClient.query("DELETE FROM feature_flags");
    console.log("   🗑️  Cleared feature_flags in old DB");

    for (const r of newFfRows) {
      await oldClient.query(
        `INSERT INTO feature_flags (id, slug, enabled, display_name, description, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [r.id, r.slug, r.enabled, r.display_name, r.description, r.updated_at]
      );
    }
    console.log(`   ✅ Inserted ${newFfRows.length} feature_flags`);

    // ─── Payment Gateways (full replace) ────────────────────────────────
    console.log("\n━━━ Syncing: payment_gateways (full replace) ━━━");
    const newPgRows = (await newClient.query("SELECT * FROM payment_gateways")).rows;
    console.log(`   📦 ${newPgRows.length} rows in new DB`);

    // Check if payments reference gateways in old DB
    let oldPayments = 0;
    try {
      oldPayments = parseInt((await oldClient.query("SELECT COUNT(*) as c FROM payments")).rows[0].c);
    } catch { /* table may not exist */ }

    if (oldPayments > 0) {
      console.log(`   ⚠️  ${oldPayments} payments exist in old DB — using upsert on slug`);
      for (const r of newPgRows) {
        await oldClient.query(
          `INSERT INTO payment_gateways (id, slug, display_name, description, active, is_default, priority, credentials, supported_currencies, config, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (slug) DO UPDATE SET
             display_name = EXCLUDED.display_name, description = EXCLUDED.description,
             active = EXCLUDED.active, is_default = EXCLUDED.is_default,
             priority = EXCLUDED.priority, credentials = EXCLUDED.credentials,
             supported_currencies = EXCLUDED.supported_currencies,
             config = EXCLUDED.config, updated_at = EXCLUDED.updated_at`,
          [r.id, r.slug, r.display_name, r.description, r.active, r.is_default, r.priority,
           r.credentials ? JSON.stringify(r.credentials) : null,
           r.supported_currencies ? JSON.stringify(r.supported_currencies) : null,
           r.config ? JSON.stringify(r.config) : null,
           r.created_at, r.updated_at]
        );
      }
    } else {
      await oldClient.query("DELETE FROM payment_gateways");
      console.log("   🗑️  Cleared payment_gateways in old DB");
      for (const r of newPgRows) {
        await oldClient.query(
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
    console.log(`   ✅ Inserted ${newPgRows.length} payment_gateways`);

    // ─── Addons ─────────────────────────────────────────────────────────
    await syncTable(newClient, oldClient, "addons",
      `SELECT * FROM addons`,
      (r) => ({
        sql: `INSERT INTO addons (id, name, description, price_cents, active, created_at)
              VALUES ($1,$2,$3,$4,$5,$6)
              ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name, description = EXCLUDED.description,
                price_cents = EXCLUDED.price_cents, active = EXCLUDED.active`,
        values: [r.id, r.name, r.description, r.price_cents, r.active, r.created_at],
      })
    );

    // ─── Reviews ────────────────────────────────────────────────────────
    await syncTable(newClient, oldClient, "reviews",
      `SELECT * FROM reviews`,
      (r) => ({
        sql: `INSERT INTO reviews (id, user_id, tour_id, booking_id, rating, comment, status, guest_name, guest_email, is_guest, photo_url, created_at)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
              ON CONFLICT (id) DO UPDATE SET
                rating = EXCLUDED.rating, comment = EXCLUDED.comment,
                status = EXCLUDED.status, guest_name = EXCLUDED.guest_name,
                guest_email = EXCLUDED.guest_email, photo_url = EXCLUDED.photo_url`,
        values: [r.id, r.user_id, r.tour_id, r.booking_id, r.rating, r.comment,
                 r.status, r.guest_name, r.guest_email, r.is_guest, r.photo_url, r.created_at],
      })
    );

    // ─── Promotions ─────────────────────────────────────────────────────
    await syncTable(newClient, oldClient, "promotions",
      `SELECT * FROM promotions`,
      (r) => ({
        sql: `INSERT INTO promotions (id, code, description, discount_type, discount_value, min_purchase_cents, max_uses, used_count, valid_from, valid_to, applicable_to, is_active, created_at, created_by)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
              ON CONFLICT (id) DO UPDATE SET
                code = EXCLUDED.code, description = EXCLUDED.description,
                discount_type = EXCLUDED.discount_type, discount_value = EXCLUDED.discount_value,
                min_purchase_cents = EXCLUDED.min_purchase_cents, max_uses = EXCLUDED.max_uses,
                used_count = EXCLUDED.used_count, valid_from = EXCLUDED.valid_from,
                valid_to = EXCLUDED.valid_to, applicable_to = EXCLUDED.applicable_to,
                is_active = EXCLUDED.is_active`,
        values: [r.id, r.code, r.description, r.discount_type, r.discount_value,
                 r.min_purchase_cents, r.max_uses, r.used_count, r.valid_from,
                 r.valid_to, r.applicable_to, r.is_active, r.created_at, r.created_by],
      })
    );

    // ─── Verification ───────────────────────────────────────────────────
    console.log("\n\n🎉 Reverse sync complete!");
    console.log("\n━━━ Final Comparison: OLD vs NEW ━━━");
    const tables = [
      "products", "content_blocks", "cms_content", "site_settings",
      "feature_flags", "payment_gateways", "users", "addons", "reviews", "promotions"
    ];
    for (const t of tables) {
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
  console.error("❌ Reverse sync failed:", err);
  process.exit(1);
});
