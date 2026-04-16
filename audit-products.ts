/**
 * audit-products.ts — dumps all products for review
 */
import pg from "pg";
const { Client } = pg;

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error("DATABASE_URL is required");

async function main() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  const { rows } = await client.query(`
    SELECT id, title, price, child_price, adult_price_cents, child_price_cents,
           infant_price_cents, pet_price_cents, pricing_type, group_price_cents,
           duration, min_pax, category, is_active, default_capacity,
           seo_title, seo_description, image, image_alt, listing_order,
           contact_for_price, description,
           vehicle_details, included_items, excluded_items,
           support_email, support_phone
    FROM products
    ORDER BY category, title
  `);

  // Group by category
  const grouped: Record<string, any[]> = {};
  for (const r of rows) {
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push(r);
  }

  for (const [cat, products] of Object.entries(grouped)) {
    console.log(`\n${"═".repeat(80)}`);
    console.log(`  CATEGORY: ${cat.toUpperCase()} (${products.length} listings)`);
    console.log(`${"═".repeat(80)}`);

    for (const p of products) {
      console.log(`\n  ┌─ ID: ${p.id}`);
      console.log(`  │  Title:          ${p.title}`);
      console.log(`  │  Price (text):    ${p.price}`);
      console.log(`  │  Child Price:     ${p.child_price || "—"}`);
      console.log(`  │  Adult ¢:        ${p.adult_price_cents}  Child ¢: ${p.child_price_cents}  Infant ¢: ${p.infant_price_cents}  Pet ¢: ${p.pet_price_cents}`);
      console.log(`  │  Pricing Type:    ${p.pricing_type}  Group ¢: ${p.group_price_cents}`);
      console.log(`  │  Duration:        ${p.duration}`);
      console.log(`  │  Min Pax:         ${p.min_pax || "—"}`);
      console.log(`  │  Capacity:        ${p.default_capacity}`);
      console.log(`  │  Active:          ${p.is_active}`);
      console.log(`  │  Contact4Price:   ${p.contact_for_price}`);
      console.log(`  │  Listing Order:   ${p.listing_order}`);
      console.log(`  │  SEO Title:       ${p.seo_title || "—"}`);
      console.log(`  │  Image Alt:       ${p.image_alt || "—"}`);
      console.log(`  │  Image:           ${p.image?.substring(0, 80) || "—"}`);
      console.log(`  │  Description:     ${JSON.stringify(p.description)?.substring(0, 120)}`);
      if (p.vehicle_details) {
        console.log(`  │  Vehicle:         ${JSON.stringify(p.vehicle_details)}`);
      }
      if (p.included_items) {
        console.log(`  │  Included:        ${JSON.stringify(p.included_items)}`);
      }
      console.log(`  │  Support:         ${p.support_email || "—"} / ${p.support_phone || "—"}`);
      console.log(`  └─`);
    }
  }

  console.log(`\n\nTOTAL PRODUCTS: ${rows.length}`);
  
  await client.end();
}

main().catch(console.error);
