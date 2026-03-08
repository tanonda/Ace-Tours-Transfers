import { db } from "./server/db";
import { products } from "./shared/schema";
import { eq } from "drizzle-orm";
import { v2 as cloudinary } from "cloudinary";

// Cloudinary config should be automatically picked up from process.env.CLOUDINARY_URL
// if it exists, otherwise we explicitly configure it from individual keys if present
if (!process.env.CLOUDINARY_URL && process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

async function main() {
  console.log("Uploading images to Cloudinary with SEO optimization...");
  
  const mappings = [
    { title: "Mele Cascades Waterfall Tour", path: "/home/bandit/Documents/Ace-Tours-Transfers/attached_assets/images/mele_cascades_1772981707199.png", seoName: "mele-cascades-waterfall-tour-port-vila-vanuatu" },
    { title: "Ekasup Cultural Village Tour", path: "/home/bandit/Documents/Ace-Tours-Transfers/attached_assets/images/ekasup_village_1772981725789.png", seoName: "ekasup-cultural-village-tour-vanuatu" },
    { title: "Port Vila City & Market Tour", path: "/home/bandit/Documents/Ace-Tours-Transfers/attached_assets/images/vila_city_market_1772981742791.png", seoName: "port-vila-city-market-tour" },
    { title: "Havannah Harbour Sunset Cruise & Dinner", path: "/home/bandit/Documents/Ace-Tours-Transfers/attached_assets/images/sunset_dinner_cruise_1772981762728.png", seoName: "havannah-harbour-sunset-dinner-cruise" },
    { title: "Hideaway Island Resort Transfer", path: "/home/bandit/Documents/Ace-Tours-Transfers/attached_assets/images/hideaway_transfer_1772981781516.png", seoName: "hideaway-island-resort-transfer-port-vila" },
    { title: "Havannah Harbour Resort Area Transfer", path: "/home/bandit/Documents/Ace-Tours-Transfers/attached_assets/images/havannah_transfer_1772981801762.png", seoName: "havannah-harbour-resort-transfer-vanuatu" },
    { title: "Toyota Prado SUV (7-Seater)", path: "/home/bandit/Documents/Ace-Tours-Transfers/attached_assets/images/prado_suv_1772981864527.png", seoName: "toyota-prado-suv-car-hire-port-vila" },
    { title: "15-Seater Minibus", path: "/home/bandit/Documents/Ace-Tours-Transfers/attached_assets/images/minibus_1772981883603.png", seoName: "15-seater-minibus-rental-vanuatu" },
    { title: "Hospitality Package", path: "/home/bandit/Documents/Ace-Tours-Transfers/attached_assets/images/hospitality_transfer_1772981900394.png", seoName: "luxury-hospitality-transfer-vanuatu" },
    { title: "Events Transfer Package: Professional Group Logistics", path: "/home/bandit/Documents/Ace-Tours-Transfers/attached_assets/images/events_transport_1772981918262.png", seoName: "events-transfer-package-group-logistics-port-vila" },
    { title: "Dinner Transfer (Round Trip)", path: "/home/bandit/Documents/Ace-Tours-Transfers/attached_assets/images/dinner_transfer_1772981935394.png", seoName: "dinner-transfer-round-trip-port-vila" }
  ];
  
  for (const map of mappings) {
      try {
        console.log(`Uploading ${map.title}...`);
        // Upload to Cloudinary with SEO-friendly public_id, and convert to optimized format
        const result = await cloudinary.uploader.upload(map.path, {
            folder: "ace-tours-products",
            public_id: map.seoName,
            format: "webp",          // Force WebP for size optimization (SEO)
            quality: "auto:best",    // Auto-optimize quality
            tags: ["vanuatu", "port vila", map.category || "tourism"] // Geo-tags
        });
        
        console.log(`Uploaded to Cloudinary: ${result.secure_url}`);
        
        // Update database with the secure URL
        await db.update(products).set({ image: result.secure_url }).where(eq(products.title, map.title));
        console.log(`Updated DB for ${map.title}`);
      } catch (err) {
        console.error(`Error uploading ${map.title}:`, err);
      }
  }

  console.log("Cloudinary Upload and DB Mapping Complete!");
  process.exit(0);
}

main().catch(console.error);
