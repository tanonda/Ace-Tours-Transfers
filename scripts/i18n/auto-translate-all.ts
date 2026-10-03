/**
 * auto-translate-all.ts
 * 
 * Populates the product_translations table for all 26 products
 * and auto-translates missing CMS content entries.
 * 
 * Targets: fr, es, zh (Bislama must be entered manually)
 * 
 * Usage: npx tsx auto-translate-all.ts
 */

import pg from "pg";
import translate from "google-translate-api-x";

const { Client } = pg;

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error("DATABASE_URL is required");

const LOCALE_MAP: Record<string, string> = {
  fr: "fr",
  es: "es",
  zh: "zh-CN",
};

const TARGETS = ["fr", "es", "zh"] as const;

// Rate-limit helper to avoid hitting Google's limits
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function translateText(text: string, locale: string): Promise<string> {
  if (!text?.trim()) return text;
  const googleLang = LOCALE_MAP[locale];
  if (!googleLang) return text;

  try {
    const result = await translate(text, { from: "en", to: googleLang });
    return result.text;
  } catch (err: any) {
    console.error(`    ⚠️  translate error (${locale}): ${err.message}`);
    return text; // graceful fallback
  }
}

async function translateArray(arr: string[], locale: string): Promise<string[]> {
  const results: string[] = [];
  for (const item of arr) {
    results.push(await translateText(item, locale));
    await sleep(150); // throttle
  }
  return results;
}

async function main() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  console.log("🔌 Connected to database\n");

  // ═════════════════════════════════════════════════════════════════════
  // PHASE 1: Product Translations
  // ═════════════════════════════════════════════════════════════════════
  console.log("═══════════════════════════════════════════════════════");
  console.log("  PHASE 1: Auto-translating 26 products → fr, es, zh");
  console.log("═══════════════════════════════════════════════════════\n");

  const products = (await client.query(`
    SELECT id, title, description, itinerary_intro, pickup_instructions,
           meeting_point, operating_hours, cancellation_policy,
           included_items, excluded_items, additional_info
    FROM products ORDER BY category, title
  `)).rows;

  console.log(`  Found ${products.length} products to translate\n`);

  let productCount = 0;
  for (const p of products) {
    productCount++;
    console.log(`  [${productCount}/${products.length}] ${p.title}`);

    for (const locale of TARGETS) {
      try {
        // Check if translation already exists
        const existing = await client.query(
          `SELECT id FROM product_translations WHERE product_id = $1 AND locale = $2`,
          [p.id, locale]
        );

        if (existing.rows.length > 0) {
          console.log(`    ⏭️  ${locale}: already exists`);
          continue;
        }

        // Translate title
        const title = await translateText(p.title, locale);
        await sleep(200);

        // Translate description array
        const desc: string[] = p.description || [];
        const translatedDesc = desc.length > 0 ? await translateArray(desc, locale) : null;

        // Translate optional text fields
        const itineraryIntro = p.itinerary_intro
          ? await translateText(p.itinerary_intro, locale)
          : null;
        await sleep(100);

        const pickupInstructions = p.pickup_instructions
          ? await translateText(p.pickup_instructions, locale)
          : null;
        await sleep(100);

        const meetingPoint = p.meeting_point
          ? await translateText(p.meeting_point, locale)
          : null;

        const operatingHours = p.operating_hours
          ? await translateText(p.operating_hours, locale)
          : null;

        const cancellationPolicy = p.cancellation_policy
          ? await translateText(p.cancellation_policy, locale)
          : null;
        await sleep(100);

        // Translate array fields
        const includedItems =
          p.included_items?.length > 0
            ? await translateArray(p.included_items, locale)
            : null;

        const excludedItems =
          p.excluded_items?.length > 0
            ? await translateArray(p.excluded_items, locale)
            : null;

        const additionalInfo =
          p.additional_info?.length > 0
            ? await translateArray(p.additional_info, locale)
            : null;

        // Insert translation row
        await client.query(
          `INSERT INTO product_translations 
            (product_id, locale, title, description, itinerary_intro, pickup_instructions,
             meeting_point, operating_hours, cancellation_policy,
             included_items, excluded_items, additional_info, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
           ON CONFLICT (product_id, locale) DO UPDATE SET
             title=$3, description=$4, itinerary_intro=$5, pickup_instructions=$6,
             meeting_point=$7, operating_hours=$8, cancellation_policy=$9,
             included_items=$10, excluded_items=$11, additional_info=$12, updated_at=NOW()`,
          [
            p.id,
            locale,
            title,
            translatedDesc || null,
            itineraryIntro,
            pickupInstructions,
            meetingPoint,
            operatingHours,
            cancellationPolicy,
            includedItems ? JSON.stringify(includedItems) : null,
            excludedItems ? JSON.stringify(excludedItems) : null,
            additionalInfo ? JSON.stringify(additionalInfo) : null,
          ]
        );

        console.log(`    ✅ ${locale}: translated`);
        await sleep(300); // throttle between locales
      } catch (err: any) {
        console.error(`    ❌ ${locale}: ${err.message}`);
      }
    }
    console.log("");
  }

  // ═════════════════════════════════════════════════════════════════════
  // PHASE 2: CMS Content gap-fill
  // ═════════════════════════════════════════════════════════════════════
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  PHASE 2: Auto-translating missing CMS content");
  console.log("═══════════════════════════════════════════════════════\n");

  // Get all English CMS entries
  const enEntries = (await client.query(
    `SELECT id, block_slug, content_key, value, content_type FROM cms_content WHERE locale = 'en' AND value IS NOT NULL AND value != ''`
  )).rows;

  console.log(`  Found ${enEntries.length} English CMS entries\n`);

  let cmsTranslated = 0;
  let cmsSkipped = 0;

  for (const entry of enEntries) {
    for (const locale of TARGETS) {
      // Check if translation exists
      const existing = await client.query(
        `SELECT id FROM cms_content WHERE block_slug = $1 AND content_key = $2 AND locale = $3`,
        [entry.block_slug, entry.content_key, locale]
      );

      if (existing.rows.length > 0) {
        cmsSkipped++;
        continue;
      }

      try {
        const translated = await translateText(entry.value, locale);
        await client.query(
          `INSERT INTO cms_content (block_slug, content_key, locale, value, content_type)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (block_slug, content_key, locale) DO UPDATE SET value = $4`,
          [entry.block_slug, entry.content_key, locale, translated, entry.content_type || "text"]
        );
        cmsTranslated++;
        await sleep(200);
      } catch (err: any) {
        console.error(`  ❌ CMS ${entry.content_key} → ${locale}: ${err.message}`);
      }
    }
  }

  console.log(`  ✅ CMS translated: ${cmsTranslated} new entries`);
  console.log(`  ⏭️  CMS skipped: ${cmsSkipped} (already existed)\n`);

  // ═════════════════════════════════════════════════════════════════════
  // VERIFICATION
  // ═════════════════════════════════════════════════════════════════════
  console.log("═══════════════════════════════════════════════════════");
  console.log("  VERIFICATION");
  console.log("═══════════════════════════════════════════════════════\n");

  const ptCount = await client.query(
    `SELECT locale, COUNT(*) as c FROM product_translations GROUP BY locale ORDER BY locale`
  );
  console.log("  Product translations:");
  for (const r of ptCount.rows) {
    console.log(`    ${r.locale}: ${r.c} products`);
  }

  const cmsCount = await client.query(
    `SELECT locale, COUNT(*) as c FROM cms_content GROUP BY locale ORDER BY locale`
  );
  console.log("\n  CMS content:");
  for (const r of cmsCount.rows) {
    console.log(`    ${r.locale}: ${r.c} entries`);
  }

  await client.end();
  console.log("\n🎉 Auto-translation complete!");
}

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
