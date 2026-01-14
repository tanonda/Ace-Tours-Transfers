import "dotenv/config";
import { storage } from "./storage.js";

async function updateMissingImages() {
  console.log("Updating remaining tours with missing images...");

  try {
    // Use the modern_tourist_shutt_9102d81d.jpg Cloudinary URL for bus services
    const busImageUrl = "https://res.cloudinary.com/dwro1dh5q/image/upload/v1764940861/ace-tours-stock/1764940858150_modern_tourist_shutt_9102d81d.jpg.jpg";

    // Update "Bus Hire for the Day" (ID: 3)
    await storage.updateTour("3", { image: busImageUrl });
    console.log("✓ Updated 'Bus Hire for the Day' with Cloudinary image");

    // Update "Event Transfer" (ID: 5)
    await storage.updateTour("5", { image: busImageUrl });
    console.log("✓ Updated 'Event Transfer' with Cloudinary image");

    console.log("All tours now use Cloudinary images!");
  } catch (error) {
    console.error("Error updating tours:", error);
    process.exit(1);
  }

  process.exit(0);
}

updateMissingImages().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});