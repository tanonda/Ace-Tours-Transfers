import { db } from "./server/db";
import { products, siteSettings } from "./shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  console.log("Seeding optimized text content via Drizzle...");

  // Update Vehicle Rental
  await db.update(products)
    .set({
      description: ['Explore Vanuatu at your own pace with our premium 24-hour vehicle hire. Enjoy zero-deposit bookings, comprehensive insurance cover, and affordable rates tailored for your Port Vila adventure. Travel safely and comfortably around Efate Island with Ace Tours.'],
      seoTitle: 'Premium Vehicle Hire in Port Vila | Ace Tours Vanuatu',
      seoDescription: 'Rent a comfortable, fully-insured vehicle in Port Vila, Vanuatu with zero deposit. Book your affordable 24-hour car hire with Ace Tours today.',
      seoKeywords: 'vehicle hire port vila, car rental vanuatu, efate island car hire, zero deposit car rental vanuatu',
      geoTargeting: 'Port Vila, Efate, Vanuatu',
      listingOrder: 1
    })
    .where(eq(products.title, 'Vehicle Rental'));

  // Update Hospitality Package
  await db.update(products)
    .set({
      description: ['<p>Customized itineraries tailored to your schedule. Let us pick you up and drop you off for all your meetings.</p><ul><li>Ideal for hosting out-of-town clients and business partners.</li><li>Starting at VT 25,000 - includes bus hire & driver (5-8 hours).</li><li>Special: VT 18,000 bus hire for NGOs for the whole day.</li></ul>'],
      seoTitle: 'Corporate & Hospitality Transfers in Port Vila | Ace Tours',
      seoDescription: 'Professional half-day and full-day bus hire with driver in Vanuatu. Ideal for NGO transport, corporate events, and VIP client hosting in Port Vila.',
      seoKeywords: 'corporate transfers vanuatu, bus hire with driver port vila, NGO transport efate',
      geoTargeting: 'Port Vila, Vanuatu',
      listingOrder: 2
    })
    .where(eq(products.title, 'Hospitality Package'));

  // Update Half Day Tour
  await db.update(products)
    .set({
      description: ['<p>Experience the highlights of Vanuatu with our guided Half Day Tour. Discover stunning landscapes, local culture, and hidden gems with our expert guides.</p>'],
      seoTitle: 'Half Day Vanuatu Highlight Tour | Ace Tours',
      seoDescription: 'Join our guided Half Day Tour to explore the best of Efate Island. Perfect for quick trips, featuring local culture, scenic views, and expert guides.',
      seoKeywords: 'half day tour vanuatu, port vila highlights, efate island tour, guided tours vanuatu',
      geoTargeting: 'Port Vila, Efate, Vanuatu',
      listingOrder: 3
    })
    .where(eq(products.title, 'Half Day Tour'));

  console.log("Products seeded successfully.");

  // Seed CMS site-wide SEO defaults
  const settingsToSeed = [
    { key: 'seo_site_name', value: "Ace Tours & Transfers Vanuatu" },
    { key: 'seo_title_template', value: "{page} | Ace Tours Vanuatu" },
    { key: 'seo_default_description', value: "Experience the best of Vanuatu with Ace Tours & Transfers. We offer premium airport transfers, guided island tours, and reliable vehicle hire in Port Vila." },
    { key: 'seo_default_keywords', value: "vanuatu tours, port vila transfers, efate island tours, vanuatu airport shuttle, car hire port vila" },
    { key: 'seo_canonical_url', value: "https://acetours.vu" }
  ];

  for (const s of settingsToSeed) {
    try {
      await db.insert(siteSettings).values({ key: s.key, value: s.value })
        .onConflictDoUpdate({ target: siteSettings.key, set: { value: s.value }});
    } catch(err) {
      console.error(`Failed setting ${s.key}`);
    }
  }

  console.log("Site settings seeded successfully.");
  process.exit(0);
}

main().catch(err => {
  console.error("Seeding error:", err);
  process.exit(1);
});
