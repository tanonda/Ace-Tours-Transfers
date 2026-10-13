/**
 * CSP sources the hero video needs (see shared/hero-video.ts):
 * - media: the background loop, served by Cloudinary
 * - frames: the Short players, created only when a visitor clicks play
 * - images: YouTube's thumbnail for the Short card
 * - connect: the admin's browser uploads the video straight to Cloudinary
 */
export const HERO_VIDEO_CSP = {
  mediaSrc: ["'self'", "https://res.cloudinary.com"],
  frameSrc: ["https://www.youtube-nocookie.com", "https://www.instagram.com", "https://www.facebook.com"],
  imgSrc: ["https://i.ytimg.com"],
  connectSrc: ["https://api.cloudinary.com"],
};
