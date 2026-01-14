import "dotenv/config";
import * as cloudinary from "cloudinary";
import fs from "fs";

// Configure Cloudinary
cloudinary.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadAssets() {
    console.log("Starting asset upload to Cloudinary...");

    const assets = [
        {
            path: "/home/bandit/.gemini/antigravity/brain/3f4ceb3b-3997-40f1-9c9a-dcd85355b660/tour_scenic_efate_1765064478113.png",
            name: "tour_scenic_efate",
            tag: "tour"
        },
        {
            path: "/home/bandit/.gemini/antigravity/brain/3f4ceb3b-3997-40f1-9c9a-dcd85355b660/tour_cultural_roots_1765064502132.png",
            name: "tour_cultural_roots",
            tag: "tour"
        },
        {
            path: "/home/bandit/.gemini/antigravity/brain/3f4ceb3b-3997-40f1-9c9a-dcd85355b660/tour_bus_hire_1765064525077.png",
            name: "tour_bus_hire",
            tag: "tour"
        },
        {
            path: "/home/bandit/.gemini/antigravity/brain/3f4ceb3b-3997-40f1-9c9a-dcd85355b660/transfer_airport_van_1765064568811.png",
            name: "transfer_airport_van",
            tag: "transfer"
        }
    ];

    for (const asset of assets) {
        try {
            if (!fs.existsSync(asset.path)) {
                console.error(`File not found: ${asset.path}`);
                continue;
            }

            console.log(`Uploading ${asset.name}...`);
            const result = await cloudinary.v2.uploader.upload(asset.path, {
                folder: "ace-tours-assets",
                public_id: asset.name,
                overwrite: true,
                resource_type: "image"
            });

            console.log(`__UPLOAD_RESULT__:${asset.tag}:${result.secure_url}`);
        } catch (error) {
            console.error(`Failed to upload ${asset.name}:`, error);
        }
    }
}

uploadAssets();
