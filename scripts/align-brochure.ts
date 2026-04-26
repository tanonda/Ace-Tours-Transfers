/**
 * align-brochure.ts
 *
 * Aligns all product listings with the printed brochure cards
 * that are handed out at hotel receptions.
 *
 * Idempotent — safe to run multiple times.
 *
 * Usage:  npx tsx scripts/align-brochure.ts
 */

import "dotenv/config";
import { initializeDatabase } from "../server/db.js";
import { products } from "../shared/schema.js";
import { eq, and, inArray, sql } from "drizzle-orm";

// ── Brochure contact details ────────────────────────────────────────────────
const BROCHURE_PHONE = "+678 711 4045";
const BROCHURE_EMAIL = "acetoursvanuatu@outlook.com";

async function main() {
  const { db } = await initializeDatabase();

  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   BROCHURE ALIGNMENT — Product Listing Update           ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  // ── STEP 1: Rename products to match brochure titles ──────────────────
  console.log("━━━ Step 1: Renaming products to match brochure titles ━━━\n");

  const renames: { from: string; to: string }[] = [
    { from: "Efate Scenic Round Island Tour", to: "Efate Scenic Tour" },
    { from: "Roots & Routes Cultural Tour", to: "Roots & Routes Tour" },
    { from: "Events Transfer Package: Professional Group Logistics", to: "Event Transfer Package" },
    { from: "VIP Executive Transfer", to: "VIP Transfer" },
  ];

  for (const { from, to } of renames) {
    const result = await db
      .update(products)
      .set({ title: to })
      .where(eq(products.title, from))
      .returning({ id: products.id, title: products.title });

    if (result.length > 0) {
      console.log(`   ✅ "${from}" → "${to}"`);
    } else {
      // Check if already renamed
      const existing = await db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.title, to))
        .limit(1);
      if (existing.length > 0) {
        console.log(`   ⏭️  Already named: "${to}"`);
      } else {
        console.log(`   ⚠️  Not found: "${from}"`);
      }
    }
  }

  // ── STEP 2: Reinstate "Bus Hire for the Day" ──────────────────────────
  console.log("\n━━━ Step 2: Reinstating 'Bus Hire for the Day' ━━━\n");

  const existingBusHire = await db
    .select({ id: products.id, isActive: products.isActive })
    .from(products)
    .where(eq(products.title, "Bus Hire for the Day"))
    .limit(1);

  if (existingBusHire.length > 0) {
    // Exists — make sure it's active and update to brochure spec
    await db
      .update(products)
      .set({
        isActive: true,
        category: "tour",
        pricingType: "group",
        groupPriceCents: 32000,
        adultPriceCents: 0,
        childPriceCents: 0,
        price: "A$400",
        duration: "Typically 5-8 hours",
        description: [
          "<p>Hire the bus for the day and explore Efate Island at your own pace. Choose your own stops around the island with a dedicated driver.</p>",
          "<ul><li>Hire the bus for the day (Typically 5-8 hours)</li><li>Choose your own stops</li><li>Light refreshments provided</li><li>You take care of your entrance fees</li></ul>",
        ],
        seoTitle: "Bus Hire for the Day Port Vila | Group Day Charter | Ace Tours",
        seoDescription:
          "Hire a bus for the day in Port Vila. Choose your own stops around Efate Island with a dedicated driver. Light refreshments included. A$400 flat rate.",
        seoKeywords: "bus hire port vila, day charter vanuatu, group bus hire efate, bus rental vanuatu",
        geoTargeting: "Port Vila, Efate, Vanuatu",
        contactForPrice: false,
        supportPhone: BROCHURE_PHONE,
        supportEmail: BROCHURE_EMAIL,
        listingOrder: 3,
      })
      .where(eq(products.id, existingBusHire[0].id));
    console.log(`   ✅ Updated existing "Bus Hire for the Day" (was ${existingBusHire[0].isActive ? "active" : "inactive"})`);
  } else {
    // Insert new
    const inserted = await db
      .insert(products)
      .values({
        title: "Bus Hire for the Day",
        category: "tour",
        pricingType: "group",
        groupPriceCents: 32000,
        adultPriceCents: 0,
        childPriceCents: 0,
        price: "A$400",
        duration: "Typically 5-8 hours",
        minPax: null,
        image: "https://res.cloudinary.com/dwro1dh5q/image/upload/v1765064623/ace-tours-assets/tour_bus_hire.jpg",
        description: [
          "<p>Hire the bus for the day and explore Efate Island at your own pace. Choose your own stops around the island with a dedicated driver.</p>",
          "<ul><li>Hire the bus for the day (Typically 5-8 hours)</li><li>Choose your own stops</li><li>Light refreshments provided</li><li>You take care of your entrance fees</li></ul>",
        ],
        isActive: true,
        defaultCapacity: 30,
        seoTitle: "Bus Hire for the Day Port Vila | Group Day Charter | Ace Tours",
        seoDescription:
          "Hire a bus for the day in Port Vila. Choose your own stops around Efate Island with a dedicated driver. Light refreshments included. A$400 flat rate.",
        seoKeywords: "bus hire port vila, day charter vanuatu, group bus hire efate, bus rental vanuatu",
        geoTargeting: "Port Vila, Efate, Vanuatu",
        contactForPrice: false,
        supportPhone: BROCHURE_PHONE,
        supportEmail: BROCHURE_EMAIL,
        listingOrder: 3,
      } as any)
      .returning({ id: products.id, title: products.title });
    console.log(`   ✅ Created new: "${inserted[0].title}" [${inserted[0].id.substring(0, 8)}]`);
  }

  // ── STEP 3: Deactivate non-brochure tours ─────────────────────────────
  console.log("\n━━━ Step 3: Deactivating tours not on brochure ━━━\n");

  const toDeactivate = [
    "Mele Cascades Waterfall Tour",
    "Ekasup Cultural Village Tour",
    "Port Vila City & Market Tour",
    "Havannah Harbour Sunset Cruise & Dinner",
  ];

  for (const title of toDeactivate) {
    const result = await db
      .update(products)
      .set({ isActive: false })
      .where(and(eq(products.title, title), eq(products.isActive, true)))
      .returning({ id: products.id, title: products.title });

    if (result.length > 0) {
      console.log(`   🔴 Deactivated: "${title}"`);
    } else {
      const exists = await db
        .select({ id: products.id, isActive: products.isActive })
        .from(products)
        .where(eq(products.title, title))
        .limit(1);
      if (exists.length > 0 && !exists[0].isActive) {
        console.log(`   ⏭️  Already inactive: "${title}"`);
      } else if (exists.length === 0) {
        console.log(`   ⏭️  Not found: "${title}"`);
      }
    }
  }

  // ── STEP 4: Update descriptions to match brochure ─────────────────────
  console.log("\n━━━ Step 4: Updating descriptions to match brochure ━━━\n");

  // 4a. Efate Scenic Tour
  await db
    .update(products)
    .set({
      description: [
        "<p>Experience the ultimate round-island adventure on Efate. This full-day tour takes you through the stunning highlights of the island, from lush waterfalls to crystal-clear lagoons.</p>",
        "<ul><li>Round island trip (8am to 3pm)</li><li>Local chocolate factory visit</li><li>Raru Waterfall for a cool dip</li><li>Blue Lagoon for rope swinging</li><li>Lunch at Banana Bay Beach Club</li><li>Duty Free Shopping</li><li>Price includes entrance fee to all stops and refreshments</li></ul>",
      ],
      minPax: "min. 10-14 pax",
    })
    .where(eq(products.title, "Efate Scenic Tour"));
  console.log('   ✅ Updated: "Efate Scenic Tour" description');

  // 4b. Roots & Routes Tour — ensure "Price includes entrance fees"
  await db
    .update(products)
    .set({
      description: [
        "<p>A taste for custom & tradition. This cultural immersion tour takes you deep into the heart of Vanuatu's living heritage, from kava ceremonies to endemic plant discovery.</p>",
        "<ul><li>A taste for custom & tradition (Typically 4-5 hours)</li><li>Cultural Village Tour & Experience</li><li>Kava Tasting & Endemic Plant Tour (El Manaro Nakamal)</li><li>Cultural Centre Visit</li><li>Light refreshments provided</li><li>Price includes entrance fees</li></ul>",
      ],
      minPax: "min. 10-14 pax",
    })
    .where(eq(products.title, "Roots & Routes Tour"));
  console.log('   ✅ Updated: "Roots & Routes Tour" description');

  // 4c. Event Transfer Package — add overtime rate
  await db
    .update(products)
    .set({
      description: [
        "<p>Professional group transportation with coordination support for your corporate events, conferences, and team-building activities.</p>",
        "<ul><li>Group transportation, coordination with event planners, and on-site support</li><li>Bus driver for the whole day</li><li>Ideal for: Corporate events, conferences, and team-building activities</li><li>VT 25,000 — includes bus hire & driver (5-8 hours)</li><li>VT 1,000/hr for 8hrs+</li></ul>",
      ],
    })
    .where(eq(products.title, "Event Transfer Package"));
  console.log('   ✅ Updated: "Event Transfer Package" description');

  // 4d. Hospitality Package — add VT 5,000 short trip + NGO rate
  await db
    .update(products)
    .set({
      description: [
        "<p>Customized itineraries tailored to your schedule. Let us pick you up and drop you off for all your meetings.</p>",
        "<ul><li>Customized itineraries for all your meetings and appointments</li><li>Ideal for: Hosting out-of-town clients and business partners</li><li>VT 25,000 — includes bus hire & driver (5-8 hours)</li><li>VT 5,000 pick up and drop off (two destinations)</li><li>Special: VT 18,000 bus hire for NGOs for the whole day</li></ul>",
      ],
    })
    .where(eq(products.title, "Hospitality Package"));
  console.log('   ✅ Updated: "Hospitality Package" description');

  // 4e. Airport Transfer (Premium Airport Transfer → keep title for now,
  //     but ensure description has brochure details)
  const airportTransfer = await db
    .select({ id: products.id, title: products.title })
    .from(products)
    .where(
      sql`lower(${products.title}) LIKE '%airport%transfer%' AND ${products.category} = 'transfer' AND ${products.isActive} = true`
    )
    .limit(1);

  if (airportTransfer.length > 0) {
    await db
      .update(products)
      .set({
        description: [
          "<p>Reliable airport pickups and drop-offs at Port Vila Bauerfield International Airport. Our professional drivers track your flight and provide meet-and-greet services for a stress-free arrival.</p>",
          "<ul><li>Airport pickups and drop-offs</li><li>Flight tracking included</li><li>Meet-and-greet services</li><li>Ideal for: Personal and Business travellers and frequent flyers</li><li>VIP transfers also available upon request</li><li>Babies travel free of charge</li></ul>",
        ],
      })
      .where(eq(products.id, airportTransfer[0].id));
    console.log(`   ✅ Updated: "${airportTransfer[0].title}" description`);
  } else {
    console.log("   ⚠️  No active airport transfer product found");
  }

  // ── STEP 5: Set support contact on ALL active products ────────────────
  console.log("\n━━━ Step 5: Setting brochure contact details on all products ━━━\n");

  const contactResult = await db
    .update(products)
    .set({
      supportPhone: BROCHURE_PHONE,
      supportEmail: BROCHURE_EMAIL,
    })
    .where(eq(products.isActive, true))
    .returning({ id: products.id });

  console.log(`   ✅ Updated ${contactResult.length} active products with:`);
  console.log(`      Phone: ${BROCHURE_PHONE}`);
  console.log(`      Email: ${BROCHURE_EMAIL}`);

  // ── STEP 6: Verification ──────────────────────────────────────────────
  console.log("\n━━━ Step 6: Verification ━━━\n");

  const allProducts = await db
    .select({
      title: products.title,
      category: products.category,
      isActive: products.isActive,
      supportPhone: products.supportPhone,
      supportEmail: products.supportEmail,
    })
    .from(products)
    .orderBy(products.category, products.title);

  const active = allProducts.filter((p) => p.isActive);
  const inactive = allProducts.filter((p) => !p.isActive);

  const byCat: Record<string, number> = {};
  for (const p of active) {
    byCat[p.category] = (byCat[p.category] || 0) + 1;
  }

  console.log("   Active products by category:");
  for (const [cat, count] of Object.entries(byCat).sort()) {
    console.log(`      ${cat}: ${count}`);
  }
  console.log(`      TOTAL ACTIVE: ${active.length}`);
  console.log(`      TOTAL INACTIVE: ${inactive.length}`);

  // Check all active have contacts
  const missingContact = active.filter(
    (p) => !p.supportPhone || !p.supportEmail
  );
  if (missingContact.length > 0) {
    console.log("\n   ⚠️  Active products missing contact info:");
    for (const p of missingContact) {
      console.log(`      - ${p.title} (${p.category})`);
    }
  } else {
    console.log("\n   ✅ All active products have support phone & email set");
  }

  // List active tour titles
  console.log("\n   Active Tours:");
  for (const p of active.filter((p) => p.category === "tour")) {
    console.log(`      ✓ ${p.title}`);
  }
  console.log("\n   Active Transfers:");
  for (const p of active.filter((p) => p.category === "transfer")) {
    console.log(`      ✓ ${p.title}`);
  }
  console.log("\n   Active Vehicles:");
  for (const p of active.filter((p) => p.category === "vehicle")) {
    console.log(`      ✓ ${p.title}`);
  }

  console.log("\n\n🎉 Brochure alignment complete!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Brochure alignment failed:", err);
  process.exit(1);
});
