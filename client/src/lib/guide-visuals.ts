import type { Article } from "@shared/schema";

export interface GuideVisual {
  image: string;
  location: string;
  kicker: string;
  imagePosition?: string;
}

const GUIDE_VISUALS: Record<string, GuideVisual> = {
  "port-vila-airport-transfer-guide": {
    image: "/assets/guides/port-vila-airport-welcome.webp",
    location: "Bauerfield · Port Vila",
    kicker: "Arrival guide",
    imagePosition: "center",
  },
  "efate-island-day-tours-from-port-vila": {
    image: "/assets/guides/efate-coastal-road.webp",
    location: "Efate Island",
    kicker: "On the road",
    imagePosition: "center",
  },
  "blue-lagoon-vanuatu-tour-tips": {
    image: "/assets/guides/blue-lagoon-efate.webp",
    location: "East Efate",
    kicker: "Swim guide",
    imagePosition: "center",
  },
  "port-vila-cruise-transfer-and-shore-tour-guide": {
    image: "/assets/guides/port-vila-cruise-day.webp",
    location: "Port Vila Harbour",
    kicker: "Shore day",
    imagePosition: "center",
  },
  "best-things-to-do-in-vanuatu": {
    image: "/assets/guides/vanuatu-coast-field-guide.webp",
    location: "Vanuatu",
    kicker: "Island field guide",
    imagePosition: "center",
  },
  "things-to-do-in-port-vila-vanuatu": {
    image: "/assets/guides/port-vila-culture.webp",
    location: "Port Vila · Efate",
    kicker: "Local favourites",
    imagePosition: "center",
  },
  "efate-vanuatu-3-day-itinerary": {
    image: "/assets/guides/efate-itinerary-planning.webp",
    location: "Efate Island",
    kicker: "3-day route",
    imagePosition: "center",
  },
  "vanuatu-attractions-which-island-to-visit": {
    image: "/assets/guides/vanuatu-island-comparison.webp",
    location: "Across Vanuatu",
    kicker: "Island chooser",
    imagePosition: "center",
  },
};

const DEFAULT_VISUAL: GuideVisual = {
  image: "/assets/guides/vanuatu-coast-field-guide.webp",
  location: "Vanuatu",
  kicker: "Travel guide",
  imagePosition: "center",
};

export function getGuideVisual(article: Pick<Article, "slug" | "coverImage">): GuideVisual {
  return GUIDE_VISUALS[article.slug] ?? {
    ...DEFAULT_VISUAL,
    image: article.coverImage || DEFAULT_VISUAL.image,
  };
}

export function guideReadTime(bodyHtml: string): number {
  const words = bodyHtml.replace(/<[^>]*>/g, " ").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(2, Math.ceil(words / 210));
}

export const FEATURED_GUIDE_SLUG = "best-things-to-do-in-vanuatu";

