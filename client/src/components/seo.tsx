import { Helmet } from "react-helmet-async";
import { useLocation } from "wouter";

interface SEOProps {
    title: string;
    description?: string;
    image?: string;
    type?: string;
}

export function SEO({
    title,
    description = "Experience the best of Vanuatu with Ace Tours & Transfers. Meticulously pre-planned and custom-designed tour packages in Port Vila.",
    image = "https://res.cloudinary.com/dwro1dh5q/image/upload/v1765063053605/ace-tours-assets/vanuatu_beach_hero_1765063053605.png",
    type = "website"
}: SEOProps) {
    const [location] = useLocation();
    const siteUrl = "https://ace-tours-transfers.onrender.com"; // TODO: Update with custom domain when available
    const fullUrl = `${siteUrl}${location}`;
    const siteName = "Ace Tours & Transfers Vanuatu";
    const fullTitle = `${title} | ${siteName}`;

    return (
        <Helmet>
            {/* Basic Meta Tags */}
            <title>{fullTitle}</title>
            <meta name="description" content={description} />
            <link rel="canonical" href={fullUrl} />

            {/* Open Graph / Facebook */}
            <meta property="og:type" content={type} />
            <meta property="og:url" content={fullUrl} />
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={description} />
            <meta property="og:image" content={image} />
            <meta property="og:site_name" content={siteName} />

            {/* Twitter */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:url" content={fullUrl} />
            <meta name="twitter:title" content={fullTitle} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={image} />
        </Helmet>
    );
}
