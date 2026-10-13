import { v2 as cloudinary } from 'cloudinary';
import { config } from '../../config.js';
import { HERO_LOOP_EAGER, HERO_VIDEO_FORMATS } from '../../../shared/hero-video.js';

export interface VideoUploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  /** Versions Cloudinary builds right after upload (see HERO_LOOP_EAGER). */
  eager: string;
  eagerAsync: true;
  /** Cloudinary rejects any other format (comma list, signed). */
  allowedFormats: string;
  signature: string;
}

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

  /** Our Cloudinary cloud name (from CLOUDINARY_URL), or null when uploads aren't configured. */
  cloudName(): string | null {
    if (!this.enabled) return null;
    return cloudinary.config().cloud_name ?? null;
  }

  /**
   * Signed parameters for one direct browser upload into `folder`. Large files (the
   * hero video) go straight from the admin's browser to Cloudinary and never pass
   * through this 512 MB server. The API secret stays here; only the signature leaves.
   */
  signVideoUpload(folder: string): VideoUploadSignature {
    const { cloud_name, api_key, api_secret } = cloudinary.config();
    if (!this.enabled || !cloud_name || !api_key || !api_secret) {
      throw new Error("Cloudinary service is not enabled. Please set CLOUDINARY_URL.");
    }
    const timestamp = Math.round(Date.now() / 1000);
    const eager = HERO_LOOP_EAGER;
    const allowedFormats = HERO_VIDEO_FORMATS.join(",");
    const signature = cloudinary.utils.api_sign_request(
      { allowed_formats: allowedFormats, eager, eager_async: true, folder, timestamp },
      api_secret,
    );
    return { cloudName: cloud_name, apiKey: api_key, timestamp, folder, eager, eagerAsync: true, allowedFormats, signature };
  }
}

export const cloudinaryService = new CloudinaryService();
