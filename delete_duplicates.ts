import { db } from "./server/db";
import { products, bookings, tourInstances, availabilityHolds, productBlackoutDates, pricingVersions, wishlistItems, bookingItems, resources } from "./shared/schema";
import { eq, inArray } from "drizzle-orm";

async function main() {
  console.log("Starting De-duplication Process...");

  // Roots & Routes Cultural Tour [b321c7d5] is the new, SEO optimized one!
  // OLD Roots & Routes Tour [254975c9] has 6 bookings.
  const oldRootsId = "254975c9-0ade-4c73-b6d2-15abf7f39a82";
  const newRootsId = "b321c7d5-7990-4084-b993-88da0724f593";

  console.log(`Migrating bookings from old Roots & Routes (${oldRootsId}) to new (${newRootsId})...`);
  
  // 1. Migrate Bookings table reference
  await db.update(bookings).set({ tourId: newRootsId }).where(eq(bookings.tourId, oldRootsId));
  
  // 2. Migrate Booking Items reference
  await db.update(bookingItems).set({ productId: newRootsId }).where(eq(bookingItems.productId, oldRootsId));

  // 3. Migrate Tour Instances (time slots)
  await db.update(tourInstances).set({ tourId: newRootsId }).where(eq(tourInstances.tourId, oldRootsId));

  // 4. Migrate Pricing Versions (if any exist for old)
  await db.update(pricingVersions).set({ productId: newRootsId }).where(eq(pricingVersions.productId, oldRootsId));

  // 5. Migrate Blackout Dates (if any exist for old)
  await db.update(productBlackoutDates).set({ productId: newRootsId }).where(eq(productBlackoutDates.productId, oldRootsId));

  // 6. Migrate Resources (if any exist for old)
  await db.update(resources).set({ productId: newRootsId }).where(eq(resources.productId, oldRootsId));

  // 7. Migrate Wishlist Items (if any exist for old)
  await db.update(wishlistItems).set({ tourId: newRootsId }).where(eq(wishlistItems.tourId, oldRootsId));

  
  // Now we can safely delete the old "Roots & Routes Tour"
  console.log("Deleting old Roots & Routes Tour...");
  await db.delete(products).where(eq(products.id, oldRootsId));

  // IDs to blindly delete (0 Bookings or effectively duplicates/generic placeholders)
  // [0faa77ba] Efate Scenic Tour (0 Bookings) (Duplicate of Full Day Efate Island Tour)
  // [08a2fb6e] Event Transfer Package (0 Bookings) (Duplicate of Events Transfer Package: Professional Group Logistics)
  // [e9ef85c2] Vehicle Rental (0 Bookings) (Generic, replaced by Hyundai, Ford etc)
  // [523c4a24] Bus Hire for the day (0 Bookings) (Generic, replaced by Private Bus Hire)
  // [269e51ed] VIP Transfer (transfer) (0 Bookings, will regenerate later if requested)

  const toDeleteIds = [
    "0faa77ba-0d52-47df-bc6c-17eacd68377e",
    "08a2fb6e-4fdf-45ce-8c8e-595333f26194",
    "e9ef85c2-f3fc-4bd6-b9ee-0b99440eb8fa",
    "523c4a24-9b88-43d9-95fb-6878bcde9da4",
    "269e51ed-b2eb-41ea-ad75-c347d4dabe4b"
  ];

  console.log("Deleting zero-booking generic/duplicate products...");
  
  // Cascade delete constraints might not be set up on all related tables natively in neon DB,
  // so manually delete related tracking rows of the ones going in the trash.
  for (const delId of toDeleteIds) {
      await db.delete(pricingVersions).where(eq(pricingVersions.productId, delId));
      await db.delete(productBlackoutDates).where(eq(productBlackoutDates.productId, delId));
      await db.delete(resources).where(eq(resources.productId, delId));
      await db.delete(tourInstances).where(eq(tourInstances.tourId, delId));
      await db.delete(wishlistItems).where(eq(wishlistItems.tourId, delId));
  }

  await db.delete(products).where(inArray(products.id, toDeleteIds));

  console.log("De-duplication Complete!");
  process.exit(0);
}

main().catch(console.error);
