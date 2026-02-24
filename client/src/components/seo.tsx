import { Helmet } from "react-helmet-async";
import { useLocation } from "wouter";

const SITE_URL = "https://ace-tours-transfers.onrender.com";
const SITE_NAME = "Ace Tours & Transfers Vanuatu";
const DEFAULT_DESC =
  "Experience the best of Vanuatu with Ace Tours & Transfers. Meticulously pre-planned and custom-designed tour packages, airport transfers, and vehicle hire in Port Vila, Efate Island.";
const DEFAULT_IMAGE =
  "https://res.cloudinary.com/dwro1dh5q/image/upload/f_auto,q_auto,w_1200/v1765063053605/ace-tours-assets/vanuatu_beach_hero_1765063053605.png";

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
}

export function SEO({
  title,
  description = DEFAULT_DESC,
  image = DEFAULT_IMAGE,
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
}: SEOProps) {
  const [loc] = useLocation();
  const fullUrl = `${SITE_URL}${loc}`;
  const fullTitle = `${title} | ${SITE_NAME}`;
  const ogImage = cloudinaryOpt(image, 1200, "auto");

  const jsonLdBlocks: object[] = [];

  const localBusiness: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "TouristInformationCenter",
    name: SITE_NAME,
    url: SITE_URL,
    description: DEFAULT_DESC,
    telephone: "+678-711-4045",
    email: "info@acetours.com.vu",
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
        dayOfWeek: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
        opens: "07:00",
        closes: "18:00",
      },
    ],
    priceRange: "$$",
    currenciesAccepted: "VUV, AUD, USD",
    areaServed: "Vanuatu",
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
    "Vanuatu tours", "Port Vila", "Efate Island", "Vanuatu tourism",
    ...keywords,
  ].join(", ");

  return (
    <Helmet>
      <html lang="en" />
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
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_AU" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={fullUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
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
