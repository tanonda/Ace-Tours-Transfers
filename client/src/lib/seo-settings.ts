/**
 * Admin-editable SEO settings (Admin → Settings → SEO & Metadata) and the rules
 * for combining them with each page's own SEO props.
 *
 * The canonical URL is deliberately NOT read from settings: a typo there would
 * point every page's canonical at another domain and can deindex the site. It
 * stays build-time (VITE_APP_URL).
 */
export interface SeoSettings {
  siteName?: string;
  titleTemplate?: string;
  defaultDescription?: string;
  defaultKeywords?: string[];
  ogImage?: string;
}

export interface SeoFallbacks {
  siteName: string;
  description: string;
  image: string;
  keywords: string[];
}

export interface PageSeo {
  title: string;
  description?: string;
  keywords?: string[];
  image?: string;
  isHomePage?: boolean;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function readSeoSettings(getSetting: (key: string) => unknown): SeoSettings {
  const settings: SeoSettings = {};
  const siteName = text(getSetting("seo_site_name"));
  const titleTemplate = text(getSetting("seo_title_template"));
  const defaultDescription = text(getSetting("seo_default_description"));
  const keywords = text(getSetting("seo_default_keywords"))
    ?.split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  const ogImage = text(getSetting("seo_og_image"));

  if (siteName) settings.siteName = siteName;
  if (titleTemplate) settings.titleTemplate = titleTemplate;
  if (defaultDescription) settings.defaultDescription = defaultDescription;
  if (keywords?.length) settings.defaultKeywords = keywords;
  if (ogImage && /^https?:\/\//i.test(ogImage)) settings.ogImage = ogImage;
  return settings;
}

export function resolveSeo(page: PageSeo, settings: SeoSettings, fallbacks: SeoFallbacks) {
  const siteName = settings.siteName ?? fallbacks.siteName;

  const fullTitle = settings.titleTemplate?.includes("{page}")
    ? settings.titleTemplate.replaceAll("{page}", page.title)
    : `${page.title} | ${siteName}`;

  // The homepage is the site's "default" page, so the admin default wins there;
  // other pages keep their own, more specific description.
  const description =
    (page.isHomePage && settings.defaultDescription) ||
    page.description ||
    settings.defaultDescription ||
    fallbacks.description;

  const seen = new Set<string>();
  const keywords = [...(settings.defaultKeywords ?? fallbacks.keywords), ...(page.keywords ?? [])]
    .filter((k) => {
      const key = k.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(", ");

  return {
    fullTitle,
    siteName,
    description,
    businessDescription: settings.defaultDescription ?? fallbacks.description,
    keywords,
    image: page.image || settings.ogImage || fallbacks.image,
  };
}
