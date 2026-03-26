
import { Link, useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { fetchTour } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShoppingCart, MapPin, Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp, Shield, Star, Image as ImageIcon, X, ExternalLink, MessageSquare, Mail, Phone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState, useEffect, useCallback, useRef } from "react";
import { useCart } from "@/lib/cart-context";
import { useBookingDraft } from "@/lib/booking-state-context";
import { useAvailabilityToast } from "@/hooks/useAvailabilityToast";
import { formatPriceDisplay, estimateBookingTotal, type ProductCategory } from "@/lib/product.types";
import { useCurrency } from "@/lib/currency-context";
import { AvailabilityCalendar } from "@/components/AvailabilityCalendar";
import { AvailabilityStatus } from "@/components/AvailabilityStatus";
import { SEO, cloudinaryOpt } from "@/components/seo";
import { GuestReviewForm } from "@/components/GuestReviewForm";
import { useCmsText } from "@/hooks/use-cms-text";
import { AddonsPanel, calcAddonTotal, type AddonSelections, type ProductAddonEntry } from "@/components/addons-panel";
import {
  SectionHeading,
  ContactCard,
  CancellationCard,
  WhatsIncludedSection,
  ExternalReviewBadge,
  GoogleReviewsSection,
  sanitizeHtml,
} from "@/components/shared-detail-components";


// ─── Countdown Timer Component ─────────────────────────────────────────────────

function BookingCountdownTimer({ cutoffHours = 24, tourDate, tourTime }: { cutoffHours?: number; tourDate?: string; tourTime?: string | null }) {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number; expired: boolean } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!tourDate) { setTimeLeft(null); return; }

    const compute = () => {
      const dateStr = tourTime ? `${tourDate}T${tourTime}:00` : `${tourDate}T08:30:00`;
      const tourStart = new Date(dateStr);
      const cutoff = new Date(tourStart.getTime() - cutoffHours * 60 * 60 * 1000);
      const now = new Date();
      const diff = cutoff.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, expired: true });
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft({ hours, minutes, seconds, expired: false });
      }
    };

    compute();
    intervalRef.current = setInterval(compute, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [tourDate, tourTime, cutoffHours]);

  if (!timeLeft || !tourDate) return null;

  if (timeLeft.expired) {
    return (
      <div className="flex items-center gap-2 bg-red-500/15 border border-red-500/30 rounded-[10px] px-4 py-3 text-sm">
        <XCircle className="w-4 h-4 text-red-400 shrink-0" />
        <span className="text-red-400 font-medium">Booking window has closed for this date.</span>
      </div>
    );
  }

  const isUrgent = timeLeft.hours < 2;
  const color = isUrgent ? "text-red-400 border-red-500/30 bg-red-500/10" : "text-[#f4a830] border-[rgba(244,168,48,0.3)] bg-[rgba(244,168,48,0.08)]";

  return (
    <div className={`flex items-center gap-3 ${color} border rounded-[10px] px-4 py-3`}>
      <div className="flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full ${isUrgent ? "bg-red-400 animate-pulse" : "bg-[#f4a830] animate-pulse"}`} />
        <span className="text-[0.78rem] font-semibold uppercase tracking-wider">Booking closes in</span>
      </div>
      <div className="flex items-center gap-1.5 font-mono font-bold text-[1rem] ml-auto">
        <span>{String(timeLeft.hours).padStart(2, "0")}</span>
        <span className="opacity-60">:</span>
        <span>{String(timeLeft.minutes).padStart(2, "0")}</span>
        <span className="opacity-60">:</span>
        <span>{String(timeLeft.seconds).padStart(2, "0")}</span>
      </div>
    </div>
  );
}

// ─── Cancellation Policy Modal ──────────────────────────────────────────────────

function CancellationModal({ isOpen, onClose, policy, t }: { isOpen: boolean; onClose: () => void; policy?: string; t: any }) {
  if (!isOpen) return null;

  const defaultPolicy = `
    <h3>Free Cancellation</h3>
    <p>You can cancel up to <strong>24 hours in advance</strong> of the experience for a full refund.</p>
    <h3>Late Cancellation</h3>
    <p>Cancellations made within 24 hours of the scheduled departure time are non-refundable.</p>
    <h3>No-show Policy</h3>
    <p>Guests who do not show up without prior cancellation will be charged the full booking amount.</p>
    <h3>Operator Cancellations</h3>
    <p>If the tour operator cancels the experience for any reason, you will receive a full refund.</p>
    <h3>How to Cancel</h3>
    <p>To cancel or modify your booking, please contact us via WhatsApp or email as soon as possible.</p>
  `;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative bg-[#1a1710] border border-[rgba(244,168,48,0.25)] rounded-[18px] max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[#1a1710] border-b border-[rgba(244,168,48,0.15)] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#f4a830]" />
            <h3 className="font-serif text-lg font-bold">Cancellation Policy</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-[#2d2920] flex items-center justify-center text-[#8a826e] hover:text-[#f0ece4] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div
          className="px-6 py-5 text-[0.9rem] leading-[1.75] text-[#ccc6b8] prose prose-invert prose-sm max-w-none [&_h3]:text-[#f0ece4] [&_h3]:font-semibold [&_h3]:text-base [&_h3]:mt-4 [&_h3]:mb-1 [&_strong]:text-[#f4a830]"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(policy || defaultPolicy) }}
        />
      </div>
    </div>
  );
}

// ─── Itinerary Track Component ─────────────────────────────────────────────────

function ItineraryTrack({ stops }: { stops: Array<{ id: string; name: string; duration?: string; description: string; admissionIncluded?: boolean }> }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set([stops[0]?.id]));

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!stops || stops.length === 0) return null;

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-5 top-6 bottom-6 w-[2px] bg-gradient-to-b from-[#f4a830] via-[rgba(244,168,48,0.4)] to-transparent" />

      <div className="space-y-0">
        {stops.map((stop, i) => {
          const isExpanded = expanded.has(stop.id);
          const isLast = i === stops.length - 1;
          return (
            <div key={stop.id} className="relative pl-12">
              {/* Circle marker */}
              <div className={`absolute left-[14px] top-[18px] w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center text-[0.7rem] font-bold z-10 ${i === 0
                ? "bg-[#f4a830] border-[#f4a830] text-[#0f0d09]"
                : isLast
                  ? "bg-[#4caf7d] border-[#4caf7d] text-[#0f0d09]"
                  : "bg-[#1a1710] border-[rgba(244,168,48,0.5)] text-[#f4a830]"
                }`}>
                {i + 1}
              </div>

              <div className={`mb-4 bg-[#211e18] border rounded-[12px] overflow-hidden transition-all ${isExpanded ? "border-[rgba(244,168,48,0.35)]" : "border-[rgba(244,168,48,0.15)]"}`}>
                <button
                  onClick={() => toggle(stop.id)}
                  className="w-full text-left px-5 py-4 flex items-start justify-between gap-3 hover:bg-[#2d2920] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[#f0ece4] text-[0.95rem]">{stop.name}</span>
                      {stop.admissionIncluded && (
                        <span className="text-[0.68rem] px-2 py-0.5 rounded-full bg-[#4caf7d]/15 border border-[#4caf7d]/30 text-[#4caf7d] font-medium">Admission Included</span>
                      )}
                    </div>
                    {stop.duration && (
                      <div className="flex items-center gap-1 mt-1 text-[0.78rem] text-[#8a826e]">
                        <Clock className="w-3 h-3" />
                        <span>{stop.duration}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-[#8a826e] shrink-0 mt-1">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>
                {isExpanded && stop.description && (
                  <div
                    className="px-5 pb-4 pt-0 text-[0.87rem] text-[#b8b0a0] leading-[1.7] border-t border-[rgba(244,168,48,0.1)] prose prose-invert prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-4 [&_a]:text-[#f4a830]"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(stop.description) }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Photo Gallery ──────────────────────────────────────────────────────────────

function PhotoGallery({ images, title }: { images: string[]; title: string }) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  if (!images || images.length === 0) return null;

  const main = images[0];
  const thumbs = images.slice(1, 5);
  const remaining = images.length - 5;

  return (
    <>
      {lightbox !== null && (
        <div className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <button
            disabled={lightbox === 0}
            onClick={e => { e.stopPropagation(); setLightbox(l => Math.max(0, (l ?? 0) - 1)); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white disabled:opacity-30 transition-colors"
          >
            ‹
          </button>
          <img
            src={images[lightbox]}
            alt={`${title} photo ${lightbox + 1}`}
            className="max-h-[80vh] max-w-full object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />
          <button
            disabled={lightbox === images.length - 1}
            onClick={e => { e.stopPropagation(); setLightbox(l => Math.min(images.length - 1, (l ?? 0) + 1)); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white disabled:opacity-30 transition-colors"
          >
            ›
          </button>
          <div className="absolute bottom-4 text-white/60 text-sm">{lightbox + 1} / {images.length}</div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-2 rounded-[14px] overflow-hidden aspect-[2.2/1]">
        {/* Main large image */}
        <div
          className="col-span-2 row-span-2 cursor-pointer overflow-hidden relative group"
          onClick={() => setLightbox(0)}
        >
          <img
            src={cloudinaryOpt(main, 900)}
            alt={`${title} - main photo`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="eager"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors" />
        </div>
        {/* Thumbnails grid */}
        {thumbs.map((img, i) => (
          <div
            key={i}
            className="cursor-pointer overflow-hidden relative group"
            onClick={() => setLightbox(i + 1)}
          >
            <img
              src={cloudinaryOpt(img, 400)}
              alt={`${title} photo ${i + 2}`}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
            {/* "See more" overlay on last thumb */}
            {i === thumbs.length - 1 && remaining > 0 && (
              <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center cursor-pointer"
                onClick={e => { e.stopPropagation(); setLightbox(i + 1); }}>
                <div className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center mb-1">→</div>
                <span className="text-white text-xs font-semibold">+{remaining} more</span>
              </div>
            )}
          </div>
        ))}
        {/* If fewer than 4 thumbs, fill with placeholder */}
        {Array.from({ length: Math.max(0, 4 - thumbs.length) }).map((_, i) => (
          <div key={`ph-${i}`} className="bg-[#211e18]" />
        ))}
      </div>
    </>
  );
}

// ─── Star rating display ────────────────────────────────────────────────────────

function StarRating({ value, max = 5, size = "sm" }: { value: number; max?: number; size?: "sm" | "md" }) {
  const sizeClass = size === "md" ? "text-xl" : "text-[0.9rem]";
  return (
    <span className={`${sizeClass} tracking-tight`}>
      {Array.from({ length: max }, (_, i) => {
        const filled = i < Math.floor(value);
        const half = !filled && i < value;
        return (
          <span key={i} className={filled ? "text-[#f4a830]" : half ? "text-[#f4a830]/50" : "text-[#3d3830]"}>★</span>
        );
      })}
    </span>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function TourDetail() {
  const cms = useCmsText("faq");
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { addToCart } = useCart();
  const { updateDraft } = useBookingDraft();
  const { currency } = useCurrency();

  const [adultPax, setAdultPax] = useState(2);
  const [childPax, setChildPax] = useState(0);
  const [infantPax, setInfantPax] = useState(0);
  const [petPax, setPetPax] = useState(0);
  const [addonSelections, setAddonSelections] = useState<AddonSelections>({});
  const [date, setDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [urlInitialTime, setUrlInitialTime] = useState<string | null>(null);
  const [cancellationModalOpen, setCancellationModalOpen] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);

  const { data: tour, isLoading, error } = useQuery({
    queryKey: ["tour", id, i18n.language],
    queryFn: () => fetchTour(id!),
    enabled: !!id,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["tour-reviews", id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/products/${id}/reviews`);
      return res.json();
    },
    enabled: !!id,
  });

  const { data: availability, loading: availLoading } = useAvailabilityToast(
    id && date ? { productId: id, date, adultPax, childPax, startTime: selectedTime || undefined } : null,
    { enabled: !!id && !!date }
  );

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const urlDate = sp.get("date");
    const urlGuests = sp.get("guests");
    const urlAdults = sp.get("adults");
    const urlChildren = sp.get("children");
    const urlInfants = sp.get("infants");
    const urlPets = sp.get("pets");
    const urlTime = sp.get("time");
    if (urlDate) setDate(urlDate);
    if (urlTime) { setSelectedTime(urlTime); setUrlInitialTime(urlTime); }
    const parsedAdults = urlAdults ? parseInt(urlAdults) : (urlGuests ? parseInt(urlGuests) : 2);
    const parsedChildren = urlChildren ? parseInt(urlChildren) : 0;
    const parsedInfants = urlInfants ? parseInt(urlInfants) : 0;
    const parsedPets = urlPets ? parseInt(urlPets) : 0;
    if (parsedAdults) setAdultPax(parsedAdults);
    if (parsedChildren) setChildPax(parsedChildren);
    if (parsedInfants) setInfantPax(parsedInfants);
    if (parsedPets) setPetPax(parsedPets);
    if (id) updateDraft({ productId: id, adultPax: parsedAdults, childPax: parsedChildren, infantPax: parsedInfants, petPax: parsedPets, date: urlDate || "", startTime: urlTime || undefined });
    if (urlDate || urlGuests) {
      setTimeout(() => { document.getElementById("booking-panel")?.scrollIntoView({ behavior: "smooth" }); }, 500);
    }
  }, [id, updateDraft]);

  useEffect(() => {
    if (id) updateDraft({ productId: id, adultPax, childPax, infantPax, petPax, date, startTime: selectedTime || undefined });
  }, [id, adultPax, childPax, infantPax, petPax, date, selectedTime, updateDraft]);

  const handleDateSelect = useCallback((d: string) => { setDate(d); setSelectedTime(null); }, []);
  const handleTimeSelect = useCallback((t: string) => { setSelectedTime(t); }, []);

  const [, setLocation] = useLocation();

  const handleAddToCart = () => {
    if (!tour) return;
    addToCart({
      id: tour.id,
      title: tour.title,
      price: tour.adultPriceCents,
      childPrice: tour.childPriceCents,
      image: tour.image,
      type: (tour.category || "tour") as ProductCategory,
      adultPax, childPax, infantPax, petPax,
      date: date ? new Date(date) : new Date(),
      startTime: selectedTime || undefined,
    });
    setLocation("/cart");
  };

  const averageRating = reviews.length > 0
    ? reviews.reduce((acc: number, r: any) => acc + r.rating, 0) / reviews.length
    : 0;
  const starsDisplay = Math.round(averageRating);
  const ratingCounts = [5, 4, 3, 2, 1].map(n => ({
    star: n,
    count: reviews.filter((r: any) => r.rating === n).length,
  }));

  // Parse structured tour data (new fields), fallback gracefully
  const itineraryStops: Array<{ id: string; name: string; duration?: string; description: string; admissionIncluded?: boolean }> = tour?.itineraryStops ?? [];
  const includedItems: string[] = tour?.includedItems ?? [];
  const excludedItems: string[] = tour?.excludedItems ?? [];
  const additionalInfoItems: string[] = tour?.additionalInfo ?? [];
  const travelerPhotos: string[] = tour?.travelerPhotos ?? [];
  const allPhotos = tour ? [tour.image, ...travelerPhotos].filter(Boolean) : [];
  const displayedReviews = showAllReviews ? reviews : reviews.slice(0, 5);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen bg-[#0f0d09]">
          <div className="w-8 h-8 border-4 border-[#f4a830] border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (error || !tour) {
    return (
      <Layout>
        <div className="container mx-auto px-4 pt-40 pb-20 text-center bg-[#0f0d09] min-h-screen">
          <h1 className="text-4xl font-bold mb-4 text-[#f0ece4]">{t("common.error", "Error")}</h1>
          <p className="text-[#8a826e] mb-8">{t("common.productNotFound", "Tour not found")}</p>
          <Button onClick={() => window.history.back()} className="bg-[#f4a830] text-[#0f0d09]">
            <ArrowLeft className="mr-2 h-4 w-4" /> {t("common.goBack", "Go Back")}
          </Button>
        </div>
      </Layout>
    );
  }

  const totalPax = adultPax + childPax;
  const isBooked = !availability?.isAvailable && !!date;

  const avgRating = reviews.length > 0 ? reviews.reduce((a: number, r: any) => a + r.rating, 0) / reviews.length : 0;
  const tourFaqs = [];
  for (let i = 1; i <= 20; i++) {
    // We only have 4 defaults here
    const defaultQ = i === 1 ? `What is included in the ${tour.title}?` :
      i === 2 ? "Is this tour suitable for children?" :
        i === 3 ? "What is the cancellation policy?" :
          i === 4 ? "Where does the tour depart from?" : "";
    const defaultA = i === 1 ? (Array.isArray(tour.description) ? tour.description[0] : tour.description)?.slice(0, 300) || "Please contact us for full inclusions." :
      i === 2 ? "Yes, this tour accommodates children. Child pricing is available at checkout." :
        i === 3 ? "Free cancellation up to 24 hours before your scheduled tour. Contact us for late cancellations." :
          i === 4 ? (tour.meetingPoint || "Pick-up is available from most Port Vila hotels. Please confirm your location at booking.") : "";

    const q = cms.text(`faq${i}_q`, defaultQ);
    const a = cms.text(`faq${i}_a`, defaultA); // Note we use .text here since seo takes plain text
    if (q && a) {
      tourFaqs.push({ question: q, answer: a.replace(/<[^>]+>/g, '') });
    }
  }

  const cutoffHours = tour.bookingCutoffHours ?? 24;

  return (
    <Layout>
      <SEO
        title={tour.seoTitle || tour.title}
        description={tour.seoDescription || (Array.isArray(tour.description) ? tour.description[0] : tour.description)?.replace(/<[^>]+>/g, '').slice(0, 155) || `Book ${tour.title} in Port Vila, Vanuatu.`}
        image={tour.image}
        type="product"
        keywords={[...(tour.seoKeywords ? tour.seoKeywords.split(',').map((k: string) => k.trim()) : []), tour.title, "Vanuatu tour", "Port Vila tour", tour.category || ""]}
        structuredType="TouristAttraction"
        productName={tour.title}
        productDescription={Array.isArray(tour.description) ? tour.description[0] : tour.description}
        offer={tour.adultPriceCents ? { price: tour.adultPriceCents, currency: "VUV", availability: "InStock" } : undefined}
        aggregateRating={reviews.length > 0 ? { ratingValue: avgRating, reviewCount: reviews.length } : undefined}
        reviews={reviews.slice(0, 5).map((r: any) => ({ author: r.userName || "Guest", rating: r.rating, body: r.comment, datePublished: r.createdAt?.slice(0, 10) }))}
        faqs={tourFaqs}
      />

      <CancellationModal
        isOpen={cancellationModalOpen}
        onClose={() => setCancellationModalOpen(false)}
        policy={tour.cancellationPolicy ?? undefined}
        t={t}
      />

      <div className="min-h-screen bg-[#0f0d09] text-[#f0ece4] font-sans pt-28 md:pt-32">

        {/* ── HERO ── */}
        <div className="relative aspect-video lg:aspect-[21/9] max-h-[60vh] overflow-hidden bg-[#0f0d09]">
          <img
            src={cloudinaryOpt(tour.image, 1400)}
            className="w-full h-full object-cover filter brightness-[0.45] object-center"
            alt={tour.imageAlt || `${tour.title} - Vanuatu tour`}
            loading="eager"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0f0d09]" />
          <div className="absolute bottom-7 left-0 right-0 max-w-[1320px] mx-auto px-8">
            <div className="flex items-center gap-2 text-[0.78rem] text-[#8a826e] mb-3">
              <a href="/" className="text-[#f4a830] hover:underline">Home</a>
              <span>›</span>
              <a href="/tours" className="text-[#f4a830] hover:underline">{t("nav.tours", "Tours")}</a>
              <span>›</span>
              <span className="text-[#f0ece4] opacity-50 truncate max-w-[200px]">{tour.title}</span>
            </div>
            <h1 className="font-serif text-3xl md:text-4xl font-bold leading-tight mb-3 max-w-2xl">
              {tour.title}
            </h1>
            <div className="flex flex-wrap gap-2">
              {reviews.length > 0 && (
                <span className="px-3 py-1 rounded-full border border-[#f4a830] bg-[#f4a830]/15 text-[#f4a830] text-[0.78rem] font-medium">
                  {"★".repeat(starsDisplay)} {averageRating.toFixed(1)} · {reviews.length} reviews
                </span>
              )}
              {tour.duration && (
                <span className="px-3 py-1 rounded-full border border-[rgba(244,168,48,0.2)] bg-[#1a1710]/80 text-[#8a826e] text-[0.78rem] font-medium">
                  ⏱ {tour.duration}
                </span>
              )}
              <span className="px-3 py-1 rounded-full border border-[#4caf7d]/30 bg-[#4caf7d]/10 text-[#4caf7d] text-[0.78rem] font-medium">
                ✓ Available Now
              </span>
            </div>
          </div>
        </div>

        {/* ── MAIN GRID ── */}
        <div className="max-w-[1320px] mx-auto px-4 md:px-8 py-8 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8 items-start">

          {/* ── LEFT COLUMN ── */}
          <div className="flex flex-col gap-6">

            {/* 1. Photo Gallery */}
            {allPhotos.length > 1 ? (
              <section>
                <PhotoGallery images={allPhotos} title={tour.title} />
              </section>
            ) : (
              <div className="rounded-[14px] overflow-hidden bg-[#211e18] aspect-[16/9]">
                <img
                  src={cloudinaryOpt(tour.image, 900)}
                  className="w-full h-full object-cover object-center block"
                  alt={tour.imageAlt || `${tour.title} - tour photo`}
                  loading="lazy"
                />
              </div>
            )}

            {/* 2. Overview */}
            <section className="bg-[#1a1710] border border-[rgba(244,168,48,0.18)] rounded-[14px] p-6 md:p-7">
              <SectionHeading>Overview</SectionHeading>
              <div
                className="text-[0.92rem] leading-[1.8] text-[#ccc6b8] prose prose-invert prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-[#f4a830] [&_a]:underline [&_li]:my-1 [&_p]:my-2"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(typeof tour.description === "string"
                    ? tour.description
                    : Array.isArray(tour.description) && tour.description[0]
                      ? tour.description[0]
                      : t("quickView.defaultDesc", "Experience the best of Vanuatu with this curated tour package."))
                }}
              />
            </section>

            {/* 3. What's Included */}
            {(includedItems.length > 0 || excludedItems.length > 0 || (Array.isArray(tour.description) && tour.description.length > 1)) && (
              <section className="bg-[#1a1710] border border-[rgba(244,168,48,0.18)] rounded-[14px] p-6 md:p-7">
                <SectionHeading>What's Included</SectionHeading>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* New structured included items */}
                  {includedItems.length > 0
                    ? includedItems.map((item, i) => (
                      <div key={i} className="flex items-start gap-3 text-[0.88rem] text-[#ccc6b8]">
                        <CheckCircle2 className="w-[18px] h-[18px] text-[#4caf7d] shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </div>
                    ))
                    : /* Fallback: old description[1] approach */
                    Array.isArray(tour.description) && tour.description.slice(1).map((item: string, i: number) => (
                      item.startsWith('<') ? (
                        <div key={i} className="col-span-2 text-[0.88rem] text-[#8a826e] prose prose-invert prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_li]:text-[#8a826e]" dangerouslySetInnerHTML={{ __html: sanitizeHtml(item) }} />
                      ) : (
                        <div key={i} className="flex items-start gap-3 text-[0.88rem] text-[#ccc6b8]">
                          <CheckCircle2 className="w-[18px] h-[18px] text-[#4caf7d] shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </div>
                      )
                    ))
                  }
                  {/* Excluded items */}
                  {excludedItems.map((item, i) => (
                    <div key={`ex-${i}`} className="flex items-start gap-3 text-[0.88rem] text-[#8a826e]">
                      <XCircle className="w-[18px] h-[18px] text-[#6a6055] shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 4. Meeting & Pickup */}
            {(tour.meetingPoint || tour.pickupInstructions) && (
              <section className="bg-[#1a1710] border border-[rgba(244,168,48,0.18)] rounded-[14px] p-6 md:p-7">
                <SectionHeading>
                  <MapPin className="w-5 h-5 text-[#f4a830] shrink-0" />
                  Meeting & Pickup
                </SectionHeading>

                <div className="bg-[#211e18] border border-[rgba(244,168,48,0.15)] rounded-[12px] p-5 mb-4">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-9 h-9 rounded-full bg-[#f4a830]/15 border border-[#f4a830]/30 flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4 text-[#f4a830]" />
                    </div>
                    <div className="flex-1">
                      <div className="text-[0.7rem] text-[#8a826e] uppercase tracking-wider font-semibold mb-1">Pickup Point</div>
                      <div className="text-[0.95rem] font-semibold text-[#f0ece4]">{tour.meetingPoint || "Your accommodation in Port Vila"}</div>
                      {tour.meetingPointMapUrl && (
                        <a
                          href={tour.meetingPointMapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-[#f4a830] text-[0.82rem] mt-2 hover:underline"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Open in Google Maps
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Google Maps embed — uses meetingPoint text as the place query.
                      Falls back gracefully if the Maps Embed API is unavailable. */}
                  {tour.meetingPoint && (
                    <div className="rounded-[10px] overflow-hidden border border-[rgba(244,168,48,0.12)] mb-4 bg-[#1a1710]" style={{ height: 180 }}>
                      <iframe
                        title="Meeting point map"
                        width="100%"
                        height="180"
                        style={{ border: 0, display: 'block' }}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyD-9tSrke72PouQMnMX-a7eZSW0jkFMBWY&q=${encodeURIComponent(tour.meetingPoint + ', Vanuatu')}`}
                      />
                    </div>
                  )}

                  {tour.pickupInstructions && (
                    <div className="border-t border-[rgba(244,168,48,0.1)] pt-4">
                      <div className="text-[0.7rem] text-[#8a826e] uppercase tracking-wider font-semibold mb-2">Pickup Details</div>
                      <p className="text-[0.87rem] text-[#b8b0a0] leading-[1.7]">{tour.pickupInstructions}</p>
                    </div>
                  )}
                </div>

                {tour.operatingHours && (
                  <div className="flex items-center gap-3 px-5 py-3 bg-[#211e18] border border-[rgba(244,168,48,0.15)] rounded-[12px]">
                    <Clock className="w-4 h-4 text-[#f4a830] shrink-0" />
                    <div>
                      <div className="text-[0.7rem] text-[#8a826e] uppercase tracking-wider font-semibold">Operating Hours</div>
                      <div className="text-[0.88rem] text-[#ccc6b8] font-medium">{tour.operatingHours}</div>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* 5. Itinerary */}
            {itineraryStops.length > 0 && (
              <section className="bg-[#1a1710] border border-[rgba(244,168,48,0.18)] rounded-[14px] p-6 md:p-7">
                <SectionHeading>Itinerary</SectionHeading>
                {tour.itineraryIntro && (
                  <p className="text-[0.9rem] text-[#8a826e] leading-[1.7] mb-6">
                    {tour.itineraryIntro}
                  </p>
                )}
                <ItineraryTrack stops={itineraryStops} />
              </section>
            )}

            {/* 6. Additional Information */}
            {additionalInfoItems.length > 0 && (
              <section className="bg-[#1a1710] border border-[rgba(244,168,48,0.18)] rounded-[14px] p-6 md:p-7">
                <SectionHeading>Additional Information</SectionHeading>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {additionalInfoItems.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 text-[0.87rem] text-[#b8b0a0]">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#f4a830]/60 shrink-0 mt-[7px]" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 7. Cancellation Policy + Questions — side by side */}
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Cancellation Policy Card */}
              <div className="bg-[#1a1710] border border-[rgba(244,168,48,0.18)] rounded-[14px] p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-[#f4a830]" />
                  <span className="font-semibold text-[1rem]">Cancellation Policy</span>
                </div>
                <p className="text-[0.87rem] text-[#8a826e] leading-[1.6] flex-1">
                  You can cancel up to <strong className="text-[#f0ece4]">{cutoffHours} hours</strong> in advance of the experience for a full refund.
                </p>
                <button
                  onClick={() => setCancellationModalOpen(true)}
                  className="text-[#f4a830] text-[0.82rem] font-medium hover:underline flex items-center gap-1 self-start"
                >
                  Show full policy →
                </button>
              </div>

              {/* Questions Card */}
              <div className="bg-[#1a1710] border border-[rgba(244,168,48,0.18)] rounded-[14px] p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-[#f4a830]" />
                  <span className="font-semibold text-[1rem]">Questions?</span>
                </div>
                <p className="text-[0.87rem] text-[#8a826e] leading-[1.6]">
                  {tour.productCode ? `Product code: ${tour.productCode}` : "Contact us for any queries about this tour."}
                </p>
                <div className="flex flex-col gap-2 mt-auto">
                  <a
                    href={`https://wa.me/6787114045?text=${encodeURIComponent(`Hi! I have a question about "${tour.title}". `)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-[#25D366] text-[0.82rem] hover:underline"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                    WhatsApp
                  </a>
                  {tour.supportEmail && (
                    <a href={`mailto:${tour.supportEmail}`} className="flex items-center gap-2 text-[#f4a830] text-[0.82rem] hover:underline">
                      <Mail className="w-3.5 h-3.5" />
                      {tour.supportEmail}
                    </a>
                  )}
                  {tour.supportPhone && (
                    <a href={`tel:${tour.supportPhone}`} className="flex items-center gap-2 text-[#ccc6b8] text-[0.82rem] hover:underline">
                      <Phone className="w-3.5 h-3.5" />
                      {tour.supportPhone}
                    </a>
                  )}
                </div>
              </div>
            </section>

            {/* 8. Traveler Photos */}
            {travelerPhotos.length > 0 && (
              <section className="bg-[#1a1710] border border-[rgba(244,168,48,0.18)] rounded-[14px] p-6 md:p-7">
                <SectionHeading>
                  <ImageIcon className="w-5 h-5 text-[#f4a830] shrink-0" />
                  Traveler Photos
                </SectionHeading>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {travelerPhotos.map((photo, i) => (
                    <div key={i} className="rounded-[10px] overflow-hidden aspect-square bg-[#211e18] cursor-pointer group">
                      <img
                        src={cloudinaryOpt(photo, 400)}
                        alt={`Traveler photo ${i + 1}`}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 9. Reviews */}
            <section className="bg-[#1a1710] border border-[rgba(244,168,48,0.18)] rounded-[14px] p-6 md:p-7">
              <SectionHeading>Guest Reviews</SectionHeading>

              {/* Rating summary */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pb-6 mb-6 border-b border-[rgba(244,168,48,0.15)]">
                <div className="text-center">
                  <div className="font-serif text-5xl font-bold text-[#f4a830]">{averageRating.toFixed(1)}</div>
                  <StarRating value={averageRating} size="md" />
                  <div className="text-[0.78rem] text-[#8a826e] mt-1">{reviews.length} reviews</div>
                  {/* Viator / Tripadvisor note */}
                  {reviews.length > 0 && (
                    <div className="text-[0.68rem] text-[#6a6055] mt-1">via Viator & Tripadvisor</div>
                  )}
                </div>
                {/* Star breakdown bars */}
                <div className="flex-1 w-full space-y-1.5">
                  {ratingCounts.map(({ star, count }) => (
                    <div key={star} className="flex items-center gap-2">
                      <span className="text-[0.72rem] text-[#8a826e] w-10 shrink-0">{star} stars</span>
                      <div className="flex-1 h-2 bg-[#2d2920] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#f4a830] rounded-full transition-all"
                          style={{ width: reviews.length > 0 ? `${(count / reviews.length) * 100}%` : "0%" }}
                        />
                      </div>
                      <span className="text-[0.72rem] text-[#8a826e] w-6 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* External review badge (Trustpilot or Google depending on review_provider site setting) */}
              <ExternalReviewBadge />

              {/* Individual reviews */}
              <div className="space-y-3">
                {reviews.length > 0 ? (
                  displayedReviews.map((r: any) => (
                    <div key={r.id} className="bg-[#211e18] rounded-[12px] p-5">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="font-semibold text-[0.9rem] flex items-center gap-2">
                            {r.userName || t("common.guest", "Guest")}
                            <span className="w-5 h-5 rounded-full bg-[#4caf7d]/20 border border-[#4caf7d]/40 flex items-center justify-center">
                              <CheckCircle2 className="w-3 h-3 text-[#4caf7d]" />
                            </span>
                          </div>
                          <StarRating value={r.rating} />
                        </div>
                        <div className="text-[0.72rem] text-[#8a826e]">{new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</div>
                      </div>
                      <p className="text-[0.875rem] text-[#b8b0a0] leading-[1.65]">"{r.comment}"</p>
                    </div>
                  ))
                ) : (
                  <p className="text-[0.88rem] text-[#8a826e] italic">{t("quickView.noReviews", "No reviews yet. Be the first to leave one!")}</p>
                )}
              </div>

              {reviews.length > 5 && (
                <button
                  onClick={() => setShowAllReviews(v => !v)}
                  className="mt-4 w-full py-3 border border-[rgba(244,168,48,0.2)] rounded-[10px] text-[#8a826e] text-[0.85rem] hover:border-[#f4a830] hover:text-[#f4a830] transition-colors"
                >
                  {showAllReviews ? "Show fewer reviews" : `Show all ${reviews.length} reviews`}
                </button>
              )}

              {/* Google Reviews — shown below internal reviews when review_provider = "google" */}
              <GoogleReviewsSection />

              {/* Review submission form */}
              <div className="mt-6 pt-6 border-t border-[rgba(244,168,48,0.12)]">
                <GuestReviewForm
                  productId={id!}
                  productTitle={tour.title}
                  reviewQueryKey={["tour-reviews", id!]}
                />
              </div>
            </section>


          </div>{/* end left column */}

          {/* ── RIGHT: STICKY BOOKING PANEL ── */}
          <div id="booking-panel" className="sticky top-[82px] flex flex-col gap-4">

            {/* Main booking card */}
            <div className="bg-[#1a1710] border border-[rgba(244,168,48,0.22)] rounded-[14px] overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.5)]">

              {/* Price header */}
              <div className="bg-[#211e18] px-6 py-5 border-b border-[rgba(244,168,48,0.15)]">
                {tour.pricingType === "group" ? (
                  <div>
                    <div className="text-[0.72rem] text-[#8a826e] uppercase tracking-wider mb-1">Package rate</div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-serif text-[2.1rem] font-bold text-[#f4a830]">
                        {formatPriceDisplay(tour.groupPriceCents, currency)}
                      </span>
                      {tour.groupMaxPax && (
                        <span className="text-[0.78rem] text-[#8a826e]">up to {tour.groupMaxPax} people</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-[0.72rem] text-[#8a826e] uppercase tracking-wider mb-1">From</div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-serif text-[2.1rem] font-bold text-[#f4a830]">
                        {formatPriceDisplay(tour.adultPriceCents, currency)}
                      </span>
                      <span className="text-[0.82rem] text-[#8a826e]">/ adult</span>
                    </div>
                    {tour.childPriceCents > 0 && (
                      <div className="text-[0.75rem] text-[#8a826e] mt-0.5">
                        Child: {formatPriceDisplay(tour.childPriceCents, currency)}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="px-6 py-5 flex flex-col gap-5">

                {/* Countdown + cancellation link */}
                <div className="flex flex-col gap-2">
                  <BookingCountdownTimer cutoffHours={cutoffHours} tourDate={date} tourTime={selectedTime} />
                  <button
                    onClick={() => setCancellationModalOpen(true)}
                    className="text-[0.75rem] text-[#8a826e] hover:text-[#f4a830] flex items-center gap-1.5 transition-colors self-start"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    Free cancellation · {cutoffHours}h before start
                  </button>
                </div>

                {/* Guest counters */}
                {tour.pricingType !== "group" && (
                  <div>
                    <label className="text-[0.72rem] font-semibold text-[#8a826e] tracking-[0.08em] uppercase mb-2 block">
                      Guests
                    </label>
                    <div className="flex flex-col gap-2">
                      {[
                        { label: "Adults", price: tour.adultPriceCents, value: adultPax, min: 1, max: 20, set: setAdultPax },
                        { label: "Children", price: tour.childPriceCents, value: childPax, min: 0, max: 20, set: setChildPax, freeLabel: "Free" },
                        { label: "Infants", price: 0, value: infantPax, min: 0, max: 10, set: setInfantPax, freeLabel: "Free" },
                        { label: "Pets", price: 0, value: petPax, min: 0, max: 5, set: setPetPax, freeLabel: "Free" },
                      ].map(({ label, price, value, min, max, set, freeLabel }) => (
                        <div key={label} className="flex items-center justify-between bg-[#211e18] border border-[rgba(244,168,48,0.12)] rounded-[10px] px-4 py-2.5">
                          <div>
                            <span className="text-[0.85rem] text-[#f0ece4] font-medium">{label}</span>
                            {price > 0
                              ? <span className="text-[0.7rem] text-[#8a826e] ml-2">{formatPriceDisplay(price, currency)} ea</span>
                              : freeLabel && <span className="text-[0.7rem] text-[#4caf7d] ml-2">{freeLabel}</span>
                            }
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => set((prev: number) => Math.max(min, prev - 1))}
                              className="w-7 h-7 rounded-full bg-[#1a1710] border border-[rgba(244,168,48,0.18)] text-[#f0ece4] hover:border-[#f4a830] hover:bg-[#f4a830]/15 transition-all text-lg leading-none flex items-center justify-center"
                            >−</button>
                            <span className="w-5 text-center font-bold text-[#f4a830] text-[0.95rem]">{value}</span>
                            <button
                              onClick={() => set((prev: number) => Math.min(max, prev + 1))}
                              className="w-7 h-7 rounded-full bg-[#1a1710] border border-[rgba(244,168,48,0.18)] text-[#f0ece4] hover:border-[#f4a830] hover:bg-[#f4a830]/15 transition-all text-lg leading-none flex items-center justify-center"
                            >+</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add-ons */}
                {(tour as any).addons && (tour as any).addons.length > 0 && (
                  <AddonsPanel
                    addons={(tour as any).addons as ProductAddonEntry[]}
                    selected={addonSelections}
                    onChange={setAddonSelections}
                    currency={currency}
                  />
                )}

                {/* Price breakdown */}
                <div className="bg-[#211e18] border border-[rgba(244,168,48,0.15)] rounded-[12px] overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-[rgba(244,168,48,0.08)]">
                    <span className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#8a826e]">Price Breakdown</span>
                  </div>
                  <div className="px-4 py-3 space-y-2">
                    {tour.pricingType === "group" ? (
                      <div className="flex items-center justify-between">
                        <span className="text-[0.82rem] text-[#ccc6b8]">Package rate{tour.groupMaxPax ? ` (up to ${tour.groupMaxPax})` : ""}</span>
                        <span className="text-[0.9rem] font-semibold text-[#f0ece4]">{formatPriceDisplay(tour.groupPriceCents, currency)}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-[0.82rem] text-[#ccc6b8]">{adultPax} × Adult <span className="text-[#6a6055]">@ {formatPriceDisplay(tour.adultPriceCents, currency)}</span></span>
                          <span className="text-[0.9rem] font-semibold text-[#f0ece4]">{formatPriceDisplay(tour.adultPriceCents * adultPax, currency)}</span>
                        </div>
                        {childPax > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-[0.82rem] text-[#ccc6b8]">{childPax} × Child {tour.childPriceCents > 0 ? <span className="text-[#6a6055]">@ {formatPriceDisplay(tour.childPriceCents, currency)}</span> : <span className="text-[#4caf7d]">Free</span>}</span>
                            <span className="text-[0.9rem] font-semibold text-[#f0ece4]">{tour.childPriceCents > 0 ? formatPriceDisplay(tour.childPriceCents * childPax, currency) : <span className="text-[#4caf7d]">VT 0</span>}</span>
                          </div>
                        )}
                        {adultPax >= 7 && (
                          <div className="flex items-center justify-between text-[#4caf7d] text-[0.78rem]">
                            <span>🎉 Group discount (10%)</span>
                            <span>−applied</span>
                          </div>
                        )}
                      </>
                    )}
                    {(tour as any).addons && calcAddonTotal((tour as any).addons as ProductAddonEntry[], addonSelections) > 0 && (
                      <div className="flex items-center justify-between text-[#ccc6b8]">
                        <span className="text-[0.82rem]">Add-ons</span>
                        <span className="text-[0.9rem] font-semibold">+{formatPriceDisplay(calcAddonTotal((tour as any).addons as ProductAddonEntry[], addonSelections), currency)}</span>
                      </div>
                    )}
                    <div className="border-t border-[rgba(244,168,48,0.15)] pt-2 flex items-center justify-between">
                      <span className="text-[0.75rem] font-bold text-[#8a826e] uppercase tracking-wider">{date ? "Total" : "Est. Total"}</span>
                      <div className="text-right">
                        <span className="text-[1.1rem] font-black text-[#f4a830]">
                          {formatPriceDisplay((() => {
                            const base = estimateBookingTotal(tour as any, adultPax, childPax);
                            const productTotal = tour.pricingType === "group" ? base : (adultPax >= 7 ? Math.round(base * 0.9) : base);
                            return productTotal + ((tour as any).addons ? calcAddonTotal((tour as any).addons as ProductAddonEntry[], addonSelections) : 0);
                          })(), currency)}
                        </span>
                        <span className="block text-[0.6rem] text-[#8a826e] uppercase font-bold tracking-tight">Incl. 15% VAT</span>
                      </div>
                    </div>
                    {!date && <p className="text-[0.68rem] text-[#8a826e] italic text-center">Select a date to confirm pricing</p>}
                  </div>
                </div>

                {/* Calendar */}
                <div>
                  <label className="text-[0.72rem] font-semibold text-[#8a826e] tracking-[0.08em] uppercase mb-2 block">
                    Select Date
                  </label>
                  <AvailabilityCalendar
                    tourId={id || ""}
                    selectedDate={date}
                    selectedTime={selectedTime || urlInitialTime}
                    participants={{ adults: adultPax, children: childPax }}
                    onDateSelect={handleDateSelect}
                    onTimeSelect={handleTimeSelect}
                  />
                </div>

                {/* Selected date confirmation */}
                {date && (
                  <div className="bg-[#f4a830]/12 border border-[rgba(244,168,48,0.28)] rounded-[10px] px-4 py-3">
                    <div className="text-[0.7rem] text-[#f4a830] font-semibold uppercase tracking-wider mb-1">Selected Date</div>
                    <div className="text-[0.95rem] font-semibold">
                      {new Date(date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                    </div>
                    {selectedTime && <div className="text-[0.8rem] text-[#f4a830] mt-1 font-medium">⏱ {selectedTime}</div>}
                  </div>
                )}

                {/* Availability status */}
                {id && date && (
                  <AvailabilityStatus
                    tourId={id}
                    selectedDate={new Date(date)}
                    adultPax={adultPax}
                    childPax={childPax}
                  />
                )}

                {/* CTAs */}
                {/* Trustpilot trust signal — sits above the Book Now button for maximum conversion impact */}
                <ExternalReviewBadge />

                <div className="flex flex-col gap-3">
                  <Button
                    disabled={!date || isBooked || availLoading}
                    className={`w-full h-14 rounded-[10px] text-[0.95rem] font-bold tracking-[0.02em] ${date && !isBooked
                      ? "bg-[#f4a830] text-[#0f0d09] hover:bg-[#fdc96a] shadow-[0_6px_24px_rgba(244,168,48,0.35)]"
                      : "bg-[#211e18] text-[#4a4438] cursor-not-allowed border border-[rgba(244,168,48,0.18)]"
                      }`}
                    onClick={handleAddToCart}
                  >
                    <ShoppingCart className="mr-2 h-5 w-5" />
                    {date
                      ? isBooked ? "Fully Booked — Choose Another Date" : t("cart.addToCart", "Add to Cart")
                      : t("booking.selectDateFirst", "Select a Date to Continue")}
                  </Button>
                </div>

                {/* WhatsApp */}
                <a
                  href={`https://wa.me/6787114045?text=${encodeURIComponent(`Hi! I'd like to book "${tour.title}". `)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full p-3 text-[#25D366] border border-[#25D366]/35 rounded-[10px] text-[0.875rem] hover:border-[#25D366] hover:bg-[#25D366]/8 transition-all flex items-center justify-center gap-2 font-medium"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                  💬 Ask a Question via WhatsApp
                </a>

                <div className="flex gap-4 pt-3 border-t border-[rgba(244,168,48,0.12)] text-[0.72rem] text-[#8a826e]">
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" />
                    Free cancellation {cutoffHours}h before
                  </div>
                  <div className="flex items-center gap-1.5">🔒 Instant confirmation</div>
                </div>
              </div>
            </div>

          </div>{/* end right column */}

        </div>
      </div >
    </Layout >
  );
}
