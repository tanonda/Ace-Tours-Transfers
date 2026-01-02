import { v2 as cloudinary } from 'cloudinary';
import { config } from '../../config';

/**
 * CloudinaryService
 * 
 * Handles image uploads to Cloudinary.
 * Integrates with the central configuration.
 */
export class CloudinaryService {
  private enabled: boolean;

  constructor() {
    this.enabled = config.cloudinary.enabled;
    if (!this.enabled) {
      console.warn('[CLOUDINARY] Service disabled. CLOUDINARY_URL not set.');
    } else {
      // Configuration is automatically picked up from CLOUDINARY_URL env var by the SDK
      console.log('[CLOUDINARY] Service initialized and enabled.');
    }
  }

  /**
   * Upload an image to Cloudinary
   * @param fileBuffer The image file buffer
   * @param folder The folder to store the image in (defaults to 'ace-tours')
   * @returns The secure URL of the uploaded image
   */
  async uploadImage(fileBuffer: Buffer, folder: string = 'ace-tours'): Promise<string> {
    if (!this.enabled) {
      throw new Error('Cloudinary service is not enabled. Please set CLOUDINARY_URL.');
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'auto' },
        (error, result) => {
          if (error) {
            console.error('[CLOUDINARY] Upload error:', error);
            return reject(new Error(`Cloudinary upload failed: ${error.message}`));
          }
          if (!result) {
            return reject(new Error('Cloudinary upload failed: No result returned'));
          }
          resolve(result.secure_url);
        }
      );

      uploadStream.end(fileBuffer);
    });
  }
}

export const cloudinaryService = new CloudinaryService();
