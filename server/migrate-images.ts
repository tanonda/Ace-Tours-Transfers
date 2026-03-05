import "dotenv/config";
import * as cloudinary from "cloudinary";
import { storage } from "./storage.js";
import fs from "fs";
import path from "path";

// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Function to upload image to Cloudinary
const uploadToCloudinary = (filePath: string, filename: string, folder: string = 'ace-tours-uploads'): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.v2.uploader.upload_stream(
      {
        folder,
        public_id: `${Date.now()}_${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`,
        resource_type: 'image',
        transformation: [
          { width: 1200, height: 1200, crop: 'limit' },
          { quality: 'auto' }
        ]
      },
      (error: any, result: any) => {
        if (error) {
          reject(error);
        } else if (result) {
          resolve(result.secure_url);
        } else {
          reject(new Error('Upload failed: No result returned'));
        }
      }
    );

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(uploadStream);
  });
};

async function migrateImages() {
  console.log("Starting image migration to Cloudinary...");

  const imageMappings: { [key: string]: string } = {};

  try {
    // 1. Upload stock images
    const stockImagesDir = path.join(process.cwd(), 'attached_assets', 'stock_images');
    const stockImages = fs.readdirSync(stockImagesDir).filter(file =>
      file.match(/\.(jpg|jpeg|png|webp)$/i)
    );

    console.log(`Found ${stockImages.length} stock images to migrate...`);

    for (const image of stockImages) {
      const localPath = path.join(stockImagesDir, image);
      const cloudinaryPath = `/attached_assets/stock_images/${image}`;

      try {
        console.log(`Uploading stock image: ${image}`);
        const cloudinaryUrl = await uploadToCloudinary(localPath, image, 'ace-tours-stock');
        imageMappings[cloudinaryPath] = cloudinaryUrl;
        console.log(`✓ Uploaded ${image} to ${cloudinaryUrl}`);
      } catch (error) {
        console.error(`✗ Failed to upload ${image}:`, error);
      }
    }

    // 2. Upload uploaded images
    const uploadsDir = path.join(process.cwd(), 'attached_assets', 'uploads');
    if (fs.existsSync(uploadsDir)) {
      const uploadedImages = fs.readdirSync(uploadsDir).filter(file =>
        file.match(/\.(jpg|jpeg|png|webp)$/i)
      );

      console.log(`Found ${uploadedImages.length} uploaded images to migrate...`);

      for (const image of uploadedImages) {
        const localPath = path.join(uploadsDir, image);
        const cloudinaryPath = `/attached_assets/uploads/${image}`;

        try {
          console.log(`Uploading uploaded image: ${image}`);
          const cloudinaryUrl = await uploadToCloudinary(localPath, image, 'ace-tours-uploads');
          imageMappings[cloudinaryPath] = cloudinaryUrl;
          console.log(`✓ Uploaded ${image} to ${cloudinaryUrl}`);
        } catch (error) {
          console.error(`✗ Failed to upload ${image}:`, error);
        }
      }
    }

    // 3. Update tours in database
    console.log("Updating tour images in database...");
    const productsList = await storage.getProducts();

    for (const tour of productsList) {
      if (tour.image && tour.image.startsWith('/attached_assets/') && imageMappings[tour.image]) {
        try {
          await storage.updateProduct(tour.id, { image: imageMappings[tour.image] });
          console.log(`✓ Updated tour "${tour.title}" image to Cloudinary URL`);
        } catch (error) {
          console.error(`✗ Failed to update tour "${tour.title}":`, error);
        }
      }
    }

    // 4. Update CMS content images
    console.log("Updating CMS content images in database...");
    const contentBlocks = await storage.getContentBlocks();

    for (const block of contentBlocks) {
      const cmsContents = await storage.getCmsContent(block.slug);

      for (const content of cmsContents) {
        if (content.value && content.value.startsWith('/attached_assets/') &&
          content.contentType === 'image' && imageMappings[content.value]) {
          try {
            await storage.updateCmsContent(content.id, { value: imageMappings[content.value] });
            console.log(`✓ Updated CMS content "${content.contentKey}" image to Cloudinary URL`);
          } catch (error) {
            console.error(`✗ Failed to update CMS content "${content.contentKey}":`, error);
          }
        }
      }
    }

    console.log("Image migration completed!");
    console.log(`Migrated ${Object.keys(imageMappings).length} images to Cloudinary`);

    // Optional: Clean up local files (uncomment if you want to remove local files after migration)
    // console.log("Cleaning up local image files...");
    // for (const localPath of Object.keys(imageMappings)) {
    //   const fullPath = path.join(process.cwd(), localPath.substring(1));
    //   if (fs.existsSync(fullPath)) {
    //     fs.unlinkSync(fullPath);
    //     console.log(`Removed local file: ${localPath}`);
    //   }
    // }

  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

migrateImages().catch((error) => {
  console.error("Migration script failed:", error);
  process.exit(1);
});