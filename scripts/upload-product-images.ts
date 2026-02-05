import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";
import { db } from "../server/db.js";
import { tours as toursTable } from "../shared/schema.js";
import { eq, like } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

/**
 * Upload Product Images to Cloudinary
 * 
 * This script:
 * 1. Reads product images from client/public/
 * 2. Uploads them to Cloudinary under ace-tours-products/ folder
 * 3. Updates the database with the new Cloudinary URLs
 */

// Image to product title mapping
const imageMapping: { pattern: string; title: string }[] = [
  // Tours
  { pattern: "tour_efate_scenic", title: "Efate Scenic Tour" },
  { pattern: "tour_roots_routes", title: "Roots & Routes Tour" },
  { pattern: "tour_blue_lagoon_turtle", title: "Blue Lagoon & Turtle Bay Combo" },
  { pattern: "tour_pele_island", title: "Pele Island Beach Day" },
  // Transfers
  { pattern: "transfer_airport", title: "Airport Transfer" },
  { pattern: "transfer_wharf", title: "Wharf / Cruise Ship Transfer" },
  { pattern: "transfer_dinner", title: "Dinner Transfer (Round Trip)" },
  { pattern: "transfer_vip", title: "VIP Executive Transfer" },
  // Vehicles
  { pattern: "vehicle_hilux", title: "Toyota Hilux 4WD" },
  { pattern: "vehicle_i10", title: "Hyundai Grand i10" },
  { pattern: "vehicle_jimny", title: "Suzuki Jimny" },
  { pattern: "vehicle_hiace", title: "Toyota Hiace Bus" },
  { pattern: "vehicle_cerato", title: "Kia Cerato Sedan" },
  { pattern: "vehicle_ranger", title: "Ford Ranger Wildtrak" },
];

async function uploadImage(filePath: string, publicId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      filePath,
      {
        folder: "ace-tours-products",
        public_id: publicId,
        resource_type: "image",
        overwrite: true,
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else if (result) {
          resolve(result.secure_url);
        } else {
          reject(new Error("No result from Cloudinary"));
        }
      }
    );
  });
}

async function main() {
  console.log("🚀 Starting Cloudinary product image upload...\n");

  // Check Cloudinary configuration
  if (!process.env.CLOUDINARY_URL) {
    console.error("❌ CLOUDINARY_URL environment variable is not set!");
    console.log("\nPlease set it in your .env file:");
    console.log('CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME');
    process.exit(1);
  }

  const publicDir = path.join(process.cwd(), "client", "public");
  const imageFiles = fs.readdirSync(publicDir).filter(f => f.endsWith(".png"));

  console.log(`📁 Found ${imageFiles.length} PNG files in client/public/\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const mapping of imageMapping) {
    // Find the matching image file
    const imageFile = imageFiles.find(f => f.startsWith(mapping.pattern));
    
    if (!imageFile) {
      console.log(`⚠️  No image found for pattern: ${mapping.pattern}`);
      errorCount++;
      continue;
    }

    const filePath = path.join(publicDir, imageFile);
    const publicId = mapping.pattern; // Use pattern as public ID for cleaner URLs

    try {
      console.log(`⬆️  Uploading: ${imageFile} → ${mapping.title}`);
      
      // Upload to Cloudinary
      const cloudinaryUrl = await uploadImage(filePath, publicId);
      console.log(`   ✅ Uploaded: ${cloudinaryUrl}`);

      // Update database
      const result = await db
        .update(toursTable)
        .set({ image: cloudinaryUrl })
        .where(eq(toursTable.title, mapping.title));

      console.log(`   📝 Database updated for: ${mapping.title}\n`);
      successCount++;
    } catch (error: any) {
      const errorMessage = error?.message || error?.error?.message || JSON.stringify(error, null, 2);
      console.error(`   ❌ Failed: ${errorMessage}`);
      errorCount++;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`✅ Successfully uploaded: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log("=".repeat(50));

  process.exit(errorCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
