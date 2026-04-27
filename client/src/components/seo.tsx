import { Helmet } from "react-helmet-async";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";

// Canonical site URL for client-rendered SEO tags (canonical link, OG, JSON-LD).
// Override via VITE_APP_URL at build time — Vite bakes it into the client bundle.
// NOTE: the sitemap handler in server/routes.ts uses APP_URL (server-side, runtime)
// for the same purpose. Both env vars should be set to the same canonical domain
// in production, or both left unset to fall through to the default below.
const SITE_URL =
  (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://acetoursvanuatu.com";
const SITE_NAME = "Ace Tours & Transfers Vanuatu";
const DEFAULT_DESC =
  "Experience the best of Efate Island with Ace Tours & Transfers. Meticulously pre-planned and custom-designed tour packages, airport transfers, and vehicle hire in Port Vila and across Efate Island, Vanuatu.";
const DEFAULT_IMAGE =
  "https://res.cloudinary.com/dwro1dh5q/image/upload/f_auto,q_auto,w_1200/v1765063053605/ace-tours-assets/vanuatu_beach_hero_1765063053605.png";

// Map i18next language codes → valid OG locale strings
const OG_LOCALE_MAP: Record<string, string> = {
  en: "en_AU",
  fr: "fr_FR",
  es: "es_ES",
  zh: "zh_CN",
  bi: "en_VU", // Bislama — no official OG code, closest is en_VU
};

export function cloudinaryOpt(url: string, w = 800, q = "auto"): string {
  if (!url?.includes("res.cloudinary.com")) return url;
  return url.replace("/upload/", `/upload/f_auto,q_${q},w_${w}/`);
}

export interface ReviewSchema {
  author: string;
  rating: number;
  body?: string;
  datePublished?: string;
}

export interface OfferSchema {
  price: number;
  currency: string;
  availability?: "InStock" | "OutOfStock" | "LimitedAvailability";
}

export interface FAQItem {
  question: string;
  answer: string;
}

interface SEOProps {
  title: string;
  description?: string;
  image?: string;
  imageAlt?: string;
  type?: string;
  keywords?: string[];
  structuredType?: "TouristAttraction" | "Product" | "LocalBusiness";
  productName?: string;
  productDescription?: string;
  location?: string;
  offer?: OfferSchema;
  aggregateRating?: { ratingValue: number; reviewCount: number };
  reviews?: ReviewSchema[];
  faqs?: FAQItem[];
  extraJsonLd?: Record<string, unknown>;
  /** Emit a WebSite schema with SearchAction — set true only on the home page */
  isHomePage?: boolean;
}

export function SEO({
  title,
  description = DEFAULT_DESC,
  image = DEFAULT_IMAGE,
  imageAlt,
  type = "website",
  keywords = [],
  structuredType,
  productName,
  productDescription,
  location = "Port Vila, Efate Island, Vanuatu",
  offer,
  aggregateRating,
  reviews = [],
  faqs = [],
  extraJsonLd,
  isHomePage = false,
}: SEOProps) {
  const [loc] = useLocation();
  const { i18n } = useTranslation();
  const fullUrl = `${SITE_URL}${loc}`;
  const fullTitle = `${title} | ${SITE_NAME}`;
  const ogImage = cloudinaryOpt(image, 1200, "auto");
  const ogLocale = OG_LOCALE_MAP[i18n.language] ?? "en_AU";
  const resolvedImageAlt = imageAlt || `${title} — Ace Tours & Transfers Vanuatu`;

  const jsonLdBlocks: object[] = [];

  // ── LocalBusiness / TouristInformationCenter (emitted on every page) ──
  const localBusiness: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": ["TouristInformationCenter", "LocalBusiness"],
    name: SITE_NAME,
    url: SITE_URL,
    description: DEFAULT_DESC,
    telephone: "+678-711-4045",
    email: "acetoursvanuatu@outlook.com",
    image: DEFAULT_IMAGE,
    address: {
      "@type": "PostalAddress",
      streetAddress: "Kumul Highway",
      addressLocality: "Port Vila",
      addressCountry: "VU",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: -17.7334,
      longitude: 168.3273,
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        opens: "07:00",
        closes: "18:00",
      },
    ],
    priceRange: "$$",
    currenciesAccepted: "VUV, AUD, USD",
    areaServed: "Vanuatu",
    sameAs: [
      "https://www.facebook.com/acetoursvanuatu",
      "https://www.instagram.com/acetoursvanuatu",
    ],
  };
  if (aggregateRating) {
    localBusiness.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: aggregateRating.ratingValue.toFixed(1),
      bestRating: "5",
      reviewCount: aggregateRating.reviewCount,
    };
  }
  jsonLdBlocks.push(localBusiness);

  // ── WebSite + SearchAction (home page only) ──
  if (isHomePage) {
    jsonLdBlocks.push({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/tours?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    });
  }

  // ── Product / TouristAttraction (detail pages) ──
  if (structuredType && productName) {
    const priceInMajor = offer ? offer.price / 100 : undefined;
    const productSchema: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": structuredType === "TouristAttraction" ? "TouristAttraction" : "Product",
      name: productName,
      description: productDescription || description,
      image: ogImage,
      url: fullUrl,
      brand: { "@type": "Brand", name: SITE_NAME },
    };
    if (offer) {
      productSchema.offers = {
        "@type": "Offer",
        price: priceInMajor?.toFixed(2),
        priceCurrency: offer.currency,
        availability: `https://schema.org/${offer.availability ?? "InStock"}`,
        url: fullUrl,
        seller: { "@type": "Organization", name: SITE_NAME },
      };
    }
    if (aggregateRating) {
      productSchema.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: aggregateRating.ratingValue.toFixed(1),
        bestRating: "5",
        reviewCount: aggregateRating.reviewCount,
      };
    }
    if (reviews.length > 0) {
      productSchema.review = reviews.slice(0, 5).map((r) => ({
        "@type": "Review",
        reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
        author: { "@type": "Person", name: r.author },
        ...(r.body && { reviewBody: r.body }),
        ...(r.datePublished && { datePublished: r.datePublished }),
      }));
    }
    if (extraJsonLd) Object.assign(productSchema, extraJsonLd);
    jsonLdBlocks.push(productSchema);
  }

  // ── FAQPage schema ──
  if (faqs.length > 0) {
    jsonLdBlocks.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    });
  }

  const allKeywords = [
    "Ace Tours Vanuatu", "Ace Transfers", "Efate Island Day Tours", "Port Vila Airport Transfer",
    "Vanuatu tourism", "Efate tours", "Blue Lagoon tour Vanuatu",
    ...keywords,
  ].join(", ");

  return (
    <Helmet>
      <html lang={i18n.language || "en"} />
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={allKeywords} />
      <link rel="canonical" href={fullUrl} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={resolvedImageAlt} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content={ogLocale} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={fullUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      <meta name="twitter:image:alt" content={resolvedImageAlt} />
      <meta name="geo.region" content="VU" />
      <meta name="geo.placename" content="Port Vila, Vanuatu" />
      <meta name="geo.position" content="-17.7334;168.3273" />
      <meta name="ICBM" content="-17.7334, 168.3273" />
      <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
      {jsonLdBlocks.map((block, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(block)}
        </script>
      ))}
    </Helmet>
  );
}
