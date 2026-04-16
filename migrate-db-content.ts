/**
 * migrate-db-content.ts
 * 
 * Migrates SEO and seed content from old Neon DB → new Neon DB.
 * 
 * Tables migrated:
 *  - products              (all product data incl. SEO fields)
 *  - product_translations  (i18n content)
 *  - content_blocks        (CMS block toggles)
 *  - cms_content           (CMS editable content)
 *  - site_settings         (WhatsApp, configs)
 *  - feature_flags         (feature toggles)
 *  - payment_gateways      (payment providers)
 *  - addons                (add-on products)
 *  - reviews               (customer reviews)
 *  - promotions            (discount codes)
 *  - users                 (admin accounts)
 *
 * Usage:  npx tsx migrate-db-content.ts
 */

import pg from "pg";
const { Client } = pg;

const OLD_DB_URL = process.env.OLD_DATABASE_URL ?? "";
const NEW_DB_URL = process.env.DATABASE_URL;
if (!NEW_DB_URL) throw new Error("DATABASE_URL is required");

interface TableMigration {
  name: string;
  query: string;
  /**
   * Returns the INSERT … ON CONFLICT SQL + values array for each row.
   * This lets us handle upsert logic per-table.
   */
  upsertFn: (rows: any[]) => { sql: string; values: any[] }[];
}

// ── Helper: generate $1, $2, … placeholders ───────────────────────────────────
function placeholders(count: number, offset = 0): string {
  return Array.from({ length: count }, (_, i) => `$${i + 1 + offset}`).join(", ");
}

// ── Table definitions ─────────────────────────────────────────────────────────
const TABLES: TableMigration[] = [
  // ─── Users (admin accounts only) ──────────────────────────────────────
  {
    name: "users",
    query: `SELECT * FROM users WHERE role IN ('admin', 'field_service')`,
    upsertFn: (rows) => rows.map((r) => ({
      sql: `INSERT INTO users (id, username, password, email, role, name, phone, created_at, updated_at, is_active, password_reset_token, password_reset_token_expiry, totp_secret, totp_enabled)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
            ON CONFLICT (id) DO UPDATE SET
              username = EXCLUDED.username,
              password = EXCLUDED.password,
              email = EXCLUDED.email,
              role = EXCLUDED.role,
              name = EXCLUDED.name,
              phone = EXCLUDED.phone,
              totp_secret = EXCLUDED.totp_secret,
              totp_enabled = EXCLUDED.totp_enabled`,
      values: [r.id, r.username, r.password, r.email, r.role, r.name, r.phone,
               r.created_at, r.updated_at, r.is_active, r.password_reset_token,
               r.password_reset_token_expiry, r.totp_secret, r.totp_enabled],
    })),
  },

  // ─── Products ─────────────────────────────────────────────────────────
  {
    name: "products",
    query: `SELECT * FROM products`,
    upsertFn: (rows) => rows.map((r) => ({
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
              title = EXCLUDED.title,
              price = EXCLUDED.price,
              child_price = EXCLUDED.child_price,
              adult_price_cents = EXCLUDED.adult_price_cents,
              child_price_cents = EXCLUDED.child_price_cents,
              infant_price_cents = EXCLUDED.infant_price_cents,
              pet_price_cents = EXCLUDED.pet_price_cents,
              pricing_type = EXCLUDED.pricing_type,
              group_price_cents = EXCLUDED.group_price_cents,
              group_max_pax = EXCLUDED.group_max_pax,
              duration = EXCLUDED.duration,
              min_pax = EXCLUDED.min_pax,
              image = EXCLUDED.image,
              description = EXCLUDED.description,
              category = EXCLUDED.category,
              is_active = EXCLUDED.is_active,
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
    })),
  },

  // ─── Product Translations ─────────────────────────────────────────────
  {
    name: "product_translations",
    query: `SELECT * FROM product_translations`,
    upsertFn: (rows) => rows.map((r) => ({
      sql: `INSERT INTO product_translations (
              id, product_id, locale, title, description,
              itinerary_intro, pickup_instructions, meeting_point,
              operating_hours, cancellation_policy, included_items,
              excluded_items, additional_info, updated_at
            ) VALUES (${placeholders(14)})
            ON CONFLICT (id) DO UPDATE SET
              title = EXCLUDED.title,
              description = EXCLUDED.description,
              itinerary_intro = EXCLUDED.itinerary_intro,
              pickup_instructions = EXCLUDED.pickup_instructions,
              meeting_point = EXCLUDED.meeting_point,
              operating_hours = EXCLUDED.operating_hours,
              cancellation_policy = EXCLUDED.cancellation_policy,
              included_items = EXCLUDED.included_items,
              excluded_items = EXCLUDED.excluded_items,
              additional_info = EXCLUDED.additional_info,
              updated_at = EXCLUDED.updated_at`,
      values: [
        r.id, r.product_id, r.locale, r.title, r.description,
        r.itinerary_intro, r.pickup_instructions, r.meeting_point,
        r.operating_hours, r.cancellation_policy,
        r.included_items ? JSON.stringify(r.included_items) : null,
        r.excluded_items ? JSON.stringify(r.excluded_items) : null,
        r.additional_info ? JSON.stringify(r.additional_info) : null,
        r.updated_at,
      ],
    })),
  },

  // ─── Content Blocks ───────────────────────────────────────────────────
  {
    name: "content_blocks",
    query: `SELECT * FROM content_blocks`,
    upsertFn: (rows) => rows.map((r) => ({
      sql: `INSERT INTO content_blocks (id, slug, label, description, enabled, config, updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            ON CONFLICT (id) DO UPDATE SET
              slug = EXCLUDED.slug,
              label = EXCLUDED.label,
              description = EXCLUDED.description,
              enabled = EXCLUDED.enabled,
              config = EXCLUDED.config,
              updated_at = EXCLUDED.updated_at`,
      values: [r.id, r.slug, r.label, r.description, r.enabled,
               r.config ? JSON.stringify(r.config) : null, r.updated_at],
    })),
  },

  // ─── CMS Content ──────────────────────────────────────────────────────
  {
    name: "cms_content",
    query: `SELECT * FROM cms_content`,
    upsertFn: (rows) => rows.map((r) => ({
      sql: `INSERT INTO cms_content (id, block_slug, content_key, content_type, value, locale, sort_order, created_at, updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            ON CONFLICT (id) DO UPDATE SET
              block_slug = EXCLUDED.block_slug,
              content_key = EXCLUDED.content_key,
              content_type = EXCLUDED.content_type,
              value = EXCLUDED.value,
              locale = EXCLUDED.locale,
              sort_order = EXCLUDED.sort_order,
              updated_at = EXCLUDED.updated_at`,
      values: [r.id, r.block_slug, r.content_key, r.content_type, r.value,
               r.locale, r.sort_order, r.created_at, r.updated_at],
    })),
  },

  // ─── Site Settings ────────────────────────────────────────────────────
  {
    name: "site_settings",
    query: `SELECT * FROM site_settings`,
    upsertFn: (rows) => rows.map((r) => ({
      sql: `INSERT INTO site_settings (id, key, value, updated_at)
            VALUES ($1,$2,$3,$4)
            ON CONFLICT (id) DO UPDATE SET
              key = EXCLUDED.key,
              value = EXCLUDED.value,
              updated_at = EXCLUDED.updated_at`,
      values: [r.id, r.key, r.value ? JSON.stringify(r.value) : null, r.updated_at],
    })),
  },

  // ─── Feature Flags ────────────────────────────────────────────────────
  {
    name: "feature_flags",
    query: `SELECT * FROM feature_flags`,
    upsertFn: (rows) => rows.map((r) => ({
      sql: `INSERT INTO feature_flags (id, slug, enabled, display_name, description, updated_at)
            VALUES ($1,$2,$3,$4,$5,$6)
            ON CONFLICT (id) DO UPDATE SET
              slug = EXCLUDED.slug,
              enabled = EXCLUDED.enabled,
              display_name = EXCLUDED.display_name,
              description = EXCLUDED.description,
              updated_at = EXCLUDED.updated_at`,
      values: [r.id, r.slug, r.enabled, r.display_name, r.description, r.updated_at],
    })),
  },

  // ─── Payment Gateways ─────────────────────────────────────────────────
  {
    name: "payment_gateways",
    query: `SELECT * FROM payment_gateways`,
    upsertFn: (rows) => rows.map((r) => ({
      sql: `INSERT INTO payment_gateways (id, slug, display_name, description, active, is_default, priority, credentials, supported_currencies, config, created_at, updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            ON CONFLICT (id) DO UPDATE SET
              slug = EXCLUDED.slug,
              display_name = EXCLUDED.display_name,
              description = EXCLUDED.description,
              active = EXCLUDED.active,
              is_default = EXCLUDED.is_default,
              priority = EXCLUDED.priority,
              credentials = EXCLUDED.credentials,
              supported_currencies = EXCLUDED.supported_currencies,
              config = EXCLUDED.config,
              updated_at = EXCLUDED.updated_at`,
      values: [r.id, r.slug, r.display_name, r.description, r.active, r.is_default, r.priority,
               r.credentials ? JSON.stringify(r.credentials) : null,
               r.supported_currencies ? JSON.stringify(r.supported_currencies) : null,
               r.config ? JSON.stringify(r.config) : null,
               r.created_at, r.updated_at],
    })),
  },

  // ─── Addons ───────────────────────────────────────────────────────────
  {
    name: "addons",
    query: `SELECT * FROM addons`,
    upsertFn: (rows) => rows.map((r) => ({
      sql: `INSERT INTO addons (id, name, description, price_cents, active, created_at)
            VALUES ($1,$2,$3,$4,$5,$6)
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              description = EXCLUDED.description,
              price_cents = EXCLUDED.price_cents,
              active = EXCLUDED.active`,
      values: [r.id, r.name, r.description, r.price_cents, r.active, r.created_at],
    })),
  },

  // ─── Reviews ──────────────────────────────────────────────────────────
  {
    name: "reviews",
    query: `SELECT * FROM reviews`,
    upsertFn: (rows) => rows.map((r) => ({
      sql: `INSERT INTO reviews (id, user_id, tour_id, booking_id, rating, comment, status, guest_name, guest_email, is_guest, photo_url, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            ON CONFLICT (id) DO UPDATE SET
              rating = EXCLUDED.rating,
              comment = EXCLUDED.comment,
              status = EXCLUDED.status,
              guest_name = EXCLUDED.guest_name,
              guest_email = EXCLUDED.guest_email,
              photo_url = EXCLUDED.photo_url`,
      values: [r.id, r.user_id, r.tour_id, r.booking_id, r.rating, r.comment,
               r.status, r.guest_name, r.guest_email, r.is_guest, r.photo_url, r.created_at],
    })),
  },

  // ─── Promotions ───────────────────────────────────────────────────────
  {
    name: "promotions",
    query: `SELECT * FROM promotions`,
    upsertFn: (rows) => rows.map((r) => ({
      sql: `INSERT INTO promotions (id, code, description, discount_type, discount_value, min_purchase_cents, max_uses, used_count, valid_from, valid_to, applicable_to, is_active, created_at, created_by)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
            ON CONFLICT (id) DO UPDATE SET
              code = EXCLUDED.code,
              description = EXCLUDED.description,
              discount_type = EXCLUDED.discount_type,
              discount_value = EXCLUDED.discount_value,
              min_purchase_cents = EXCLUDED.min_purchase_cents,
              max_uses = EXCLUDED.max_uses,
              used_count = EXCLUDED.used_count,
              valid_from = EXCLUDED.valid_from,
              valid_to = EXCLUDED.valid_to,
              applicable_to = EXCLUDED.applicable_to,
              is_active = EXCLUDED.is_active`,
      values: [r.id, r.code, r.description, r.discount_type, r.discount_value,
               r.min_purchase_cents, r.max_uses, r.used_count, r.valid_from,
               r.valid_to, r.applicable_to, r.is_active, r.created_at, r.created_by],
    })),
  },
];

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const oldClient = new Client({ connectionString: OLD_DB_URL });
  const newClient = new Client({ connectionString: NEW_DB_URL });

  try {
    console.log("🔌 Connecting to OLD database…");
    await oldClient.connect();
    console.log("✅ Connected to OLD database");

    console.log("🔌 Connecting to NEW database…");
    await newClient.connect();
    console.log("✅ Connected to NEW database\n");

    // First, make sure the new DB has the schema pushed
    // (assuming drizzle-kit push has already been run against the new DB)

    for (const table of TABLES) {
      console.log(`\n━━━ Migrating: ${table.name} ━━━`);

      // Check if the table exists in old DB
      let rows: any[];
      try {
        const result = await oldClient.query(table.query);
        rows = result.rows;
      } catch (err: any) {
        if (err.message?.includes("does not exist")) {
          console.log(`   ⏭️  Table "${table.name}" does not exist in old DB — skipping`);
          continue;
        }
        throw err;
      }

      console.log(`   📦 Found ${rows.length} rows in old DB`);

      if (rows.length === 0) {
        console.log(`   ⏭️  No rows to migrate`);
        continue;
      }

      const upserts = table.upsertFn(rows);
      let successCount = 0;
      let errorCount = 0;

      for (const upsert of upserts) {
        try {
          await newClient.query(upsert.sql, upsert.values);
          successCount++;
        } catch (err: any) {
          errorCount++;
          console.error(`   ❌ Error inserting row: ${err.message}`);
          // Log the failing row for debugging
          if (errorCount <= 3) {
            console.error(`      Values preview: ${JSON.stringify(upsert.values.slice(0, 3))}…`);
          }
        }
      }

      console.log(`   ✅ Migrated: ${successCount} rows | ❌ Errors: ${errorCount}`);
    }

    console.log("\n\n🎉 Migration complete!");

    // Quick verification — count rows in key tables on the new DB
    console.log("\n━━━ Verification: Row counts in NEW database ━━━");
    const verifyTables = [
      "products", "product_translations", "content_blocks", "cms_content",
      "site_settings", "feature_flags", "payment_gateways", "addons",
      "reviews", "promotions", "users"
    ];
    for (const t of verifyTables) {
      try {
        const result = await newClient.query(`SELECT COUNT(*) as count FROM ${t}`);
        console.log(`   ${t}: ${result.rows[0].count} rows`);
      } catch {
        console.log(`   ${t}: (table does not exist yet)`);
      }
    }

  } finally {
    await oldClient.end();
    await newClient.end();
    console.log("\n🔌 Connections closed.");
  }
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
