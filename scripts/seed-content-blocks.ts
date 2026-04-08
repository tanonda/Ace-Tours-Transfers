
import "dotenv/config";
import { db, initializeDatabase } from "../server/db.js";
import { contentBlocks } from "../shared/schema.js";

async function main() {
  try {
    await initializeDatabase();
    console.log("Seeding content blocks...");
    
    const blocks = [
      {
        slug: "home-page",
        label: "Home Page",
        description: "Main landing page content",
        enabled: true,
        config: {}
      },
      {
        slug: "hero",
        label: "Hero Section (Legacy)",
        description: "Main hero banner on the home page",
        enabled: true,
        config: { showCta: true, showScrollIndicator: true }
      },
      {
        slug: "about",
        label: "About Us",
        description: "Detailed about us page content",
        enabled: true,
        config: {}
      },
      {
        slug: "about-section",
        label: "About Us Section (Home)",
        description: "About section on home page",
        enabled: true,
        config: {}
      },
      {
        slug: "contact",
        label: "Contact",
        description: "Contact page details and info",
        enabled: true,
        config: {}
      },
      {
        slug: "footer",
        label: "Footer",
        description: "Site-wide footer content",
        enabled: true,
        config: {}
      },
      {
        slug: "faq",
        label: "FAQ",
        description: "Frequently asked questions",
        enabled: true,
        config: {}
      },
      {
        slug: "featured-tours",
        label: "Featured Tours",
        description: "Tour cards section on home page",
        enabled: true,
        config: { maxItems: 6 }
      },
      {
        slug: "featured-transfers",
        label: "Featured Transfers",
        description: "Transfer cards section on home page",
        enabled: true,
        config: { maxItems: 3 }
      },
      {
        slug: "testimonials",
        label: "Testimonials",
        description: "Customer testimonials section",
        enabled: true,
        config: { maxItems: 3 }
      },
      {
        slug: "contact-form",
        label: "Contact Form",
        description: "Contact form on contact page",
        enabled: true,
        config: {}
      },
      {
        slug: "promotions-banner",
        label: "Promotions Banner",
        description: "Promotional banner across the site",
        enabled: false,
        config: { bgColor: "#f2800d", message: "" }
      },
      {
        slug: "whatsapp-widget",
        label: "WhatsApp Chat Widget",
        description: "Floating WhatsApp chat button",
        enabled: true,
        config: {}
      },
      {
        slug: "newsletter",
        label: "Newsletter Subscription",
        description: "Newsletter signup form in footer",
        enabled: true,
        config: {}
      }
    ];

    for (const b of blocks) {
      await db.insert(contentBlocks).values(b).onConflictDoUpdate({
        target: contentBlocks.slug,
        set: { ...b, updatedAt: new Date() }
      });
      console.log(`Seeded content block: ${b.slug}`);
    }

    console.log("Seeding complete!");
  } catch (error: any) {
    console.error("Seeding failed:", error);
  } finally {
    process.exit(0);
  }
}

main();
