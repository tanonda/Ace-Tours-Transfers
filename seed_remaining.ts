import { db } from "./server/db";
import { sql } from "drizzle-orm";
import { contentBlocks } from "./shared/schema";

async function main() {
  console.log("Seeding CMS Blocks...");

  const heroData = {
    headline: 'Experience Vanuatu’s Natural Beauty',
    subheadline: 'Your trusted partner for premium airport transfers, reliable vehicle hire, and unforgettable guided island tours in Port Vila.',
    primaryButtonText: 'Book a Tour',
    primaryButtonLink: '/tours',
    secondaryButtonText: 'Airport Transfers',
    secondaryButtonLink: '/transfers'
  };

  await db.execute(sql`
    UPDATE ${contentBlocks}
    SET config = ${heroData}::jsonb
    WHERE slug = 'hero'
  `);

  const aboutData = {
    title: 'Vanuatu’s Premier Transport & Tour Operator',
    image: 'https://res.cloudinary.com/dwro1dh5q/image/upload/v1764939968/ace-tours-stock/1764939966139_vanuatu_rarru_waterf_a12f619f.jpg.jpg',
    content: '<p>Welcome to <strong>Ace Tours & Transfers Vanuatu</strong>. Based in the heart of Port Vila on Efate Island, we are a passionate, 100% locally-owned and operated business dedicated to showcasing the incredible beauty, culture, and hospitality of our island home.</p><p>Whether you need a swift, reliable airport transfer to your resort, a comfortable rental vehicle to explore at your own pace, or an unforgettable guided tour to our stunning waterfalls and hidden beaches, the Ace Tours family is here to make your Vanuatu vacation absolutely perfect.</p><p>With a modern fleet of air-conditioned vehicles and a team of knowledgeable, friendly local guides, we guarantee a safe, comfortable, and deeply authentic Vanuatu experience.</p>'
  };

  await db.execute(sql`
    UPDATE ${contentBlocks}
    SET config = ${aboutData}::jsonb
    WHERE slug = 'about-section'
  `);

  const promoData = {
      title: 'Book 3 Tours, Get 10% Off!',
      content: '<p>Experience more of Vanuatu with our multi-booking discount. Add any 3 tours to your cart and automatically receive a 10% discount on your entire order!</p>',
      linkText: 'Explore Tours',
      linkUrl: '/tours',
      isActive: true
  };

  await db.execute(sql`
    UPDATE ${contentBlocks}
    SET config = ${promoData}::jsonb
    WHERE slug = 'promotions-banner'
  `);

  console.log("Finished seeding operations!");
  process.exit(0);
}

main().catch(console.error);
