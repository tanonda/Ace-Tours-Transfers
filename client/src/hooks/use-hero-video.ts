import { useCmsText } from "@/hooks/use-cms-text";
import { HERO_VIDEO_BLOCK, resolveHeroVideo, type HeroVideoPage, type HeroVideoSettings } from "@shared/hero-video";

/**
 * The hero video for a page: Admin → CMS → Home Page → Hero video.
 * Home always uses it; Tours, Transfers and About only when ticked there.
 * The settings are English-only rows, which every language falls back to.
 */
export function useHeroVideo(page: HeroVideoPage): HeroVideoSettings {
  const cms = useCmsText(HERO_VIDEO_BLOCK);
  return resolveHeroVideo(page, (key) => cms.text(key));
}
