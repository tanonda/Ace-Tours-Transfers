import fs from "fs";
import path from "path";

function cleanupLocalImages() {
  console.log("Cleaning up local image files...");

  const attachedAssetsDir = path.join(process.cwd(), 'attached_assets');

  try {
    // Remove stock_images directory
    const stockImagesDir = path.join(attachedAssetsDir, 'stock_images');
    if (fs.existsSync(stockImagesDir)) {
      fs.rmSync(stockImagesDir, { recursive: true, force: true });
      console.log("✓ Removed stock_images directory");
    }

    // Remove uploads directory
    const uploadsDir = path.join(attachedAssetsDir, 'uploads');
    if (fs.existsSync(uploadsDir)) {
      fs.rmSync(uploadsDir, { recursive: true, force: true });
      console.log("✓ Removed uploads directory");
    }

    // Check if attached_assets directory is empty
    const remainingFiles = fs.readdirSync(attachedAssetsDir);
    if (remainingFiles.length === 0) {
      fs.rmdirSync(attachedAssetsDir);
      console.log("✓ Removed empty attached_assets directory");
    } else {
      console.log(`⚠ attached_assets directory not empty, contains: ${remainingFiles.join(', ')}`);
    }

    console.log("Local image cleanup completed!");
  } catch (error) {
    console.error("Error during cleanup:", error);
    process.exit(1);
  }

  process.exit(0);
}

cleanupLocalImages();