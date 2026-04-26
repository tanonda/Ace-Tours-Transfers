
import { Link, useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { fetchTour } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShoppingCart, Shield, MapPin, Clock, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState, useEffect, useCallback } from "react";
import { useCart } from "@/lib/cart-context";
import { useBookingDraft } from "@/lib/booking-state-context";
import { formatPriceDisplay, estimateBookingTotal, type ProductCategory } from "@/lib/product.types";
import { useCurrency } from "@/lib/currency-context";
import { AvailabilityCalendar } from "@/components/AvailabilityCalendar";
import { AvailabilityStatus } from "@/components/AvailabilityStatus";
import { SEO, cloudinaryOpt } from "@/components/seo";
import { GuestReviewForm } from "@/components/GuestReviewForm";
import { useCmsText } from "@/hooks/use-cms-text";
import { AddonsPanel, calcAddonTotal, type AddonSelections, type ProductAddonEntry } from "@/components/addons-panel";
import { useAvailabilityToast } from "@/hooks/useAvailabilityToast";
import {
  BookingCountdownTimer,
  CancellationModal,
  SectionHeading,
  ContactCard,
  CancellationCard,
  WhatsIncludedSection,
  ExternalReviewBadge,
  GoogleReviewsSection,
  sanitizeHtml,
} from "@/components/shared-detail-components";

// ─── Star rating display ────────────────────────────────────────────────────
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

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function TransferDetail() {
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

  const { data: transfer, isLoading, error } = useQuery({
    queryKey: ["tour", id, i18n.language],
    queryFn: () => fetchTour(id!),
    enabled: !!id,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["product-reviews", id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/products/${id}/reviews`);
      return res.json();
    },
    enabled: !!id,
  });

  const { data: availability, loading: availLoading } = useAvailabilityToast(
    id && date ? { productId: id, date, adultPax, childPax, startTime: selectedTime || undefined } : null
  );

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const urlDate = sp.get("date");
    const urlAdults = sp.get("adults");
    const urlChildren = sp.get("children");
    const urlGuests = sp.get("guests");
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
    if (id) updateDraft({
      productId: id, adultPax: parsedAdults, childPax: parsedChildren,
      infantPax: parsedInfants, petPax: parsedPets, date: urlDate || "",
      startTime: urlTime || undefined,
    });
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
    if (!transfer) return;
    addToCart({
      id: transfer.id,
      title: transfer.title,
      price: transfer.adultPriceCents,
      childPrice: transfer.childPriceCents,
      image: transfer.image,
      type: (transfer.category || "transfer") as ProductCategory,
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

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen bg-[#0f0d09]">
          <div className="w-8 h-8 border-4 border-[#f4a830] border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (error || !transfer) {
    return (
      <Layout>
        <div className="container mx-auto px-4 pt-40 pb-20 text-center bg-[#0f0d09] min-h-screen">
          <h1 className="text-4xl font-bold mb-4 text-[#f0ece4]">{t("common.error", "Error")}</h1>
          <p className="text-[#8a826e] mb-8">{t("common.productNotFound", "Transfer not found")}</p>
          <Button onClick={() => window.history.back()} className="bg-[#f4a830] text-[#0f0d09]">
            <ArrowLeft className="mr-2 h-4 w-4" /> {t("common.goBack", "Go Back")}
          </Button>
        </div>
      </Layout>
    );
  }

  const totalPax = adultPax + childPax;
  const isBooked = !availability?.isAvailable && !!date;
  const isGroupPricing = transfer.pricingType === "group";
  const baseTotal = estimateBookingTotal(transfer as any, adultPax, childPax);
  const instantTotal = isGroupPricing ? baseTotal : (adultPax >= 7 ? Math.round(baseTotal * 0.9) : baseTotal);
  const addonTotal = (transfer as any).addons ? calcAddonTotal((transfer as any).addons as ProductAddonEntry[], addonSelections) : 0;
  const grandTotal = instantTotal + addonTotal;

  const includedItems: string[] = transfer?.includedItems ?? [];
  const excludedItems: string[] = transfer?.excludedItems ?? [];
  const cutoffHours = transfer.bookingCutoffHours ?? 24;
  const displayedReviews = showAllReviews ? reviews : reviews.slice(0, 5);

  const transferFaqs = [];
  for (let i = 1; i <= 20; i++) {
    const defaultQ = i === 1 ? `What is included in the ${transfer.title}?` :
      i === 2 ? "Where does the transfer pick me up?" :
        i === 3 ? "What is the cancellation policy?" :
          i === 4 ? "Can I book a private transfer?" : "";
    const defaultA = i === 1 ? (Array.isArray(transfer.description) ? transfer.description[0] : transfer.description)?.slice(0, 300) || "Please contact us for full inclusions." :
      i === 2 ? (transfer.meetingPoint || "We pick up from your hotel, cruise terminal, or the airport. Please provide your location at booking.") :
        i === 3 ? `Free cancellation up to ${cutoffHours} hours before your scheduled transfer time.` :
          i === 4 ? "Yes, all our transfers can be arranged as private service. Contact us via WhatsApp for private transfer pricing." : "";

    const q = cms.text(`faq${i}_q`, defaultQ);
    const a = cms.text(`faq${i}_a`, defaultA);
    if (q && a) {
      transferFaqs.push({ question: q, answer: a.replace(/<[^>]+>/g, '') });
    }
  }

  return (
    <Layout>
      <SEO
        title={transfer.seoTitle || transfer.title}
        description={transfer.seoDescription || (Array.isArray(transfer.description) ? transfer.description[0] : transfer.description)?.replace(/<[^>]+>/g, '').slice(0, 155) || `Book ${transfer.title} in Port Vila, Vanuatu.`}
        image={transfer.image}
        type="product"
        keywords={[...(transfer.seoKeywords ? transfer.seoKeywords.split(',').map((k: string) => k.trim()) : []), transfer.title, "Vanuatu transfer", "Port Vila transport", "airport transfer Vanuatu"]}
        structuredType="TouristAttraction"
        productName={transfer.title}
        productDescription={Array.isArray(transfer.description) ? transfer.description[0] : transfer.description}
        offer={transfer.adultPriceCents ? { price: transfer.adultPriceCents, currency: "VUV", availability: "InStock" } : undefined}
        aggregateRating={reviews.length > 0 ? { ratingValue: averageRating, reviewCount: reviews.length } : undefined}
        reviews={reviews.slice(0, 5).map((r: any) => ({ author: r.userName || "Guest", rating: r.rating, body: r.comment, datePublished: r.createdAt?.slice(0, 10) }))}
        faqs={transferFaqs}
      />

      <CancellationModal
        isOpen={cancellationModalOpen}
        onClose={() => setCancellationModalOpen(false)}
        policy={transfer.cancellationPolicy ?? undefined}
      />

      <div className="min-h-screen bg-[#0f0d09] text-[#f0ece4] font-sans pt-28 md:pt-32">

        {/* ── HERO ── */}
        <div className="relative aspect-video lg:aspect-[21/9] max-h-[60vh] overflow-hidden bg-[#0f0d09]">
          <img
            src={cloudinaryOpt(transfer.image, 1400)}
            className="w-full h-full object-cover filter brightness-[0.45] object-center"
            alt={transfer.imageAlt || `${transfer.title} - Vanuatu transfer`}
            loading="eager"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0f0d09]" />
          <div className="absolute bottom-7 left-0 right-0 max-w-[1320px] mx-auto px-8">
            <div className="flex items-center gap-2 text-[0.78rem] text-[#8a826e] mb-3">
              <a href="/" className="text-[#f4a830] hover:underline">Home</a>
              <span>›</span>
              <a href="/transfers" className="text-[#f4a830] hover:underline">{t("nav.transfers", "Transfers")}</a>
              <span>›</span>
              <span className="text-[#f0ece4] opacity-50 truncate max-w-[200px]">{transfer.title}</span>
            </div>
            <h1 className="font-serif text-3xl md:text-4xl font-bold leading-tight mb-3 max-w-2xl">
              {transfer.title}
            </h1>
            <div className="flex flex-wrap gap-2">
              {reviews.length > 0 && (
                <span className="px-3 py-1 rounded-full border border-[#f4a830] bg-[#f4a830]/15 text-[#f4a830] text-[0.78rem] font-medium">
                  {"★".repeat(starsDisplay)} {averageRating.toFixed(1)} · {reviews.length} reviews
                </span>
              )}
              {transfer.duration && (
                <span className="px-3 py-1 rounded-full border border-[rgba(244,168,48,0.2)] bg-[#1a1710]/80 text-[#8a826e] text-[0.78rem] font-medium">
                  ⏱ {transfer.duration}
                </span>
              )}
              <span className="px-3 py-1 rounded-full border border-[#4caf7d]/30 bg-[#4caf7d]/10 text-[#4caf7d] text-[0.78rem] font-medium">
                ✓ Available Now
              </span>
              <span className="px-3 py-1 rounded-full border border-[#f4a830]/40 bg-[#f4a830]/10 text-[#f4a830] text-[0.78rem] font-medium">
                🚐 Transfer Service
              </span>
            </div>
          </div>
        </div>

        {/* ── MAIN GRID ── */}
        <div className="max-w-[1320px] mx-auto px-4 md:px-8 py-8 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8 items-start">

          {/* ── LEFT COLUMN ── */}
          <div className="flex flex-col gap-6">

            {/* 1. Photo */}
            <div className="rounded-[14px] overflow-hidden bg-[#211e18] aspect-[16/9]">
              <img
                src={cloudinaryOpt(transfer.image, 900)}
                className="w-full h-full object-cover object-center block"
                alt={transfer.imageAlt || `${transfer.title} - transfer photo`}
                loading="lazy"
              />
            </div>

            {/* 2. Overview */}
            <section className="bg-[#1a1710] border border-[rgba(244,168,48,0.18)] rounded-[14px] p-6 md:p-7">
              <SectionHeading>Transfer Details</SectionHeading>
              <div
                className="text-[0.92rem] leading-[1.8] text-[#ccc6b8] prose prose-invert prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-[#f4a830] [&_a]:underline [&_li]:my-1 [&_p]:my-2"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(typeof transfer.description === "string"
                    ? transfer.description
                    : Array.isArray(transfer.description) && transfer.description[0]
                      ? transfer.description[0]
                      : "Reliable, professional transfer service across Vanuatu.")
                }}
              />
            </section>

            {/* 3. What's Included */}
            <WhatsIncludedSection
              includedItems={includedItems}
              excludedItems={excludedItems}
              descriptionFallback={
                Array.isArray(transfer.description) && transfer.description.length > 1
                  ? transfer.description.slice(1)
                  : []
              }
            />

            {/* 4. Meeting & Pickup */}
            {(transfer.meetingPoint || transfer.pickupInstructions) && (
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
                      <div className="text-[0.95rem] font-semibold text-[#f0ece4]">{transfer.meetingPoint || "Your accommodation in Port Vila"}</div>
                      {transfer.meetingPointMapUrl && (
                        <a href={transfer.meetingPointMapUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-[#f4a830] text-[0.82rem] mt-2 hover:underline">
                          <ExternalLink className="w-3.5 h-3.5" /> Open in Google Maps
                        </a>
                      )}
                    </div>
                  </div>
                  {transfer.meetingPoint && import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY && (
                    <div className="rounded-[10px] overflow-hidden border border-[rgba(244,168,48,0.12)] mb-4 bg-[#1a1710]" style={{ height: 180 }}>
                      <iframe
                        title="Meeting point map"
                        width="100%" height="180"
                        style={{ border: 0, display: 'block' }}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        src={`https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY}&q=${encodeURIComponent(transfer.meetingPoint + ', Vanuatu')}`}
                      />
                    </div>
                  )}
                  {transfer.pickupInstructions && (
                    <div className="border-t border-[rgba(244,168,48,0.1)] pt-4">
                      <div className="text-[0.7rem] text-[#8a826e] uppercase tracking-wider font-semibold mb-2">Pickup Details</div>
                      <p className="text-[0.87rem] text-[#b8b0a0] leading-[1.7]">{transfer.pickupInstructions}</p>
                    </div>
                  )}
                </div>
                {transfer.operatingHours && (
                  <div className="flex items-center gap-3 px-5 py-3 bg-[#211e18] border border-[rgba(244,168,48,0.15)] rounded-[12px]">
                    <Clock className="w-4 h-4 text-[#f4a830] shrink-0" />
                    <div>
                      <div className="text-[0.7rem] text-[#8a826e] uppercase tracking-wider font-semibold">Operating Hours</div>
                      <div className="text-[0.88rem] text-[#ccc6b8] font-medium">{transfer.operatingHours}</div>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* 5. Cancellation Policy + Questions — side by side */}
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <CancellationCard
                cutoffHours={cutoffHours}
                onShowFullPolicy={() => setCancellationModalOpen(true)}
              />
              <ContactCard
                productTitle={transfer.title}
                productCode={transfer.productCode ?? undefined}
                supportEmail={transfer.supportEmail ?? undefined}
                supportPhone={transfer.supportPhone ?? undefined}
              />
            </section>

            {/* 6. Reviews */}
            <section className="bg-[#1a1710] border border-[rgba(244,168,48,0.18)] rounded-[14px] p-6 md:p-7">
              <SectionHeading>Guest Reviews</SectionHeading>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pb-6 mb-6 border-b border-[rgba(244,168,48,0.15)]">
                <div className="text-center">
                  <div className="font-serif text-5xl font-bold text-[#f4a830]">{reviews.length > 0 ? averageRating.toFixed(1) : "–"}</div>
                  <StarRating value={averageRating} size="md" />
                  <div className="text-[0.78rem] text-[#8a826e] mt-1">{reviews.length} reviews</div>
                </div>
                <div className="flex-1 w-full space-y-1.5">
                  {ratingCounts.map(({ star, count }) => (
                    <div key={star} className="flex items-center gap-2">
                      <span className="text-[0.72rem] text-[#8a826e] w-10 shrink-0">{star} stars</span>
                      <div className="flex-1 h-2 bg-[#2d2920] rounded-full overflow-hidden">
                        <div className="h-full bg-[#f4a830] rounded-full transition-all"
                          style={{ width: reviews.length > 0 ? `${(count / reviews.length) * 100}%` : "0%" }} />
                      </div>
                      <span className="text-[0.72rem] text-[#8a826e] w-6 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                {reviews.length > 0 ? (
                  displayedReviews.map((r: any) => (
                    <div key={r.id} className="bg-[#211e18] rounded-[12px] p-5">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="font-semibold text-[0.9rem]">{r.userName || "Guest"}</div>
                          <StarRating value={r.rating} />
                        </div>
                        <div className="text-[0.72rem] text-[#8a826e]">{new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</div>
                      </div>
                      <p className="text-[0.875rem] text-[#b8b0a0] leading-[1.65]">"{r.comment}"</p>
                    </div>
                  ))
                ) : (
                  <p className="text-[0.88rem] text-[#8a826e] italic">No reviews yet. Be the first to leave one!</p>
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
              <div className="mt-6 pt-6 border-t border-[rgba(244,168,48,0.12)]">
                <GuestReviewForm
                  productId={id!}
                  productTitle={transfer.title}
                  reviewQueryKey={["product-reviews", id!]}
                />
              </div>
            </section>
          </div>{/* end left column */}

          {/* ── RIGHT: STICKY BOOKING PANEL ── */}
          <div id="booking-panel" className="sticky top-[82px] flex flex-col gap-4">
            <div className="bg-[#1a1710] border border-[rgba(244,168,48,0.22)] rounded-[14px] overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.5)]">

              {/* Price header */}
              <div className="bg-[#211e18] px-6 py-5 border-b border-[rgba(244,168,48,0.15)]">
                {isGroupPricing ? (
                  <div>
                    <div className="text-[0.72rem] text-[#8a826e] uppercase tracking-wider mb-1">Package rate</div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-serif text-[2.1rem] font-bold text-[#f4a830]">
                        {formatPriceDisplay(transfer.groupPriceCents, currency)}
                      </span>
                      {transfer.groupMaxPax && (
                        <span className="text-[0.78rem] text-[#8a826e]">up to {transfer.groupMaxPax} people</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-[0.72rem] text-[#8a826e] uppercase tracking-wider mb-1">From</div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-serif text-[2.1rem] font-bold text-[#f4a830]">
                        {formatPriceDisplay(transfer.adultPriceCents, currency)}
                      </span>
                      <span className="text-[0.82rem] text-[#8a826e]">/ adult</span>
                    </div>
                    {transfer.childPriceCents > 0 && (
                      <div className="text-[0.75rem] text-[#8a826e] mt-0.5">
                        Child: {formatPriceDisplay(transfer.childPriceCents, currency)}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="px-6 py-5 flex flex-col gap-5">

                {/* Countdown + cancellation link */}
                <div className="flex flex-col gap-2">
                  <BookingCountdownTimer cutoffHours={cutoffHours} serviceDate={date} serviceTime={selectedTime} />
                  <button
                    onClick={() => setCancellationModalOpen(true)}
                    className="text-[0.75rem] text-[#8a826e] hover:text-[#f4a830] flex items-center gap-1.5 transition-colors self-start"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    Free cancellation · {cutoffHours}h before start
                  </button>
                </div>

                {/* Guest counters */}
                {!isGroupPricing && (
                  <div>
                    <label className="text-[0.72rem] font-semibold text-[#8a826e] tracking-[0.08em] uppercase mb-2 block">
                      Passengers
                    </label>
                    <div className="flex flex-col gap-2">
                      {[
                        { label: "Adults", price: transfer.adultPriceCents, value: adultPax, min: 1, max: 20, set: setAdultPax },
                        { label: "Children", price: transfer.childPriceCents, value: childPax, min: 0, max: 20, set: setChildPax, freeLabel: "Free" },
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
                            <button onClick={() => set((prev: number) => Math.max(min, prev - 1))}
                              className="w-7 h-7 rounded-full bg-[#1a1710] border border-[rgba(244,168,48,0.18)] text-[#f0ece4] hover:border-[#f4a830] hover:bg-[#f4a830]/15 transition-all text-lg leading-none flex items-center justify-center">−</button>
                            <span className="w-5 text-center font-bold text-[#f4a830] text-[0.95rem]">{value}</span>
                            <button onClick={() => set((prev: number) => Math.min(max, prev + 1))}
                              className="w-7 h-7 rounded-full bg-[#1a1710] border border-[rgba(244,168,48,0.18)] text-[#f0ece4] hover:border-[#f4a830] hover:bg-[#f4a830]/15 transition-all text-lg leading-none flex items-center justify-center">+</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add-ons */}
                {(transfer as any).addons && (transfer as any).addons.length > 0 && (
                  <AddonsPanel
                    addons={(transfer as any).addons as ProductAddonEntry[]}
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
                    {isGroupPricing ? (
                      <div className="flex items-center justify-between">
                        <span className="text-[0.82rem] text-[#ccc6b8]">Package rate{transfer.groupMaxPax ? ` (up to ${transfer.groupMaxPax})` : ""}</span>
                        <span className="text-[0.9rem] font-semibold text-[#f0ece4]">{formatPriceDisplay(transfer.groupPriceCents, currency)}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-[0.82rem] text-[#ccc6b8]">{adultPax} × Adult <span className="text-[#6a6055]">@ {formatPriceDisplay(transfer.adultPriceCents, currency)}</span></span>
                          <span className="text-[0.9rem] font-semibold text-[#f0ece4]">{formatPriceDisplay(transfer.adultPriceCents * adultPax, currency)}</span>
                        </div>
                        {childPax > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-[0.82rem] text-[#ccc6b8]">{childPax} × Child {transfer.childPriceCents > 0 ? <span className="text-[#6a6055]">@ {formatPriceDisplay(transfer.childPriceCents, currency)}</span> : <span className="text-[#4caf7d]">Free</span>}</span>
                            <span className="text-[0.9rem] font-semibold text-[#f0ece4]">{transfer.childPriceCents > 0 ? formatPriceDisplay(transfer.childPriceCents * childPax, currency) : <span className="text-[#4caf7d]">VT 0</span>}</span>
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
                    {addonTotal > 0 && (
                      <div className="flex items-center justify-between text-[#ccc6b8]">
                        <span className="text-[0.82rem]">Add-ons</span>
                        <span className="text-[0.9rem] font-semibold">+{formatPriceDisplay(addonTotal, currency)}</span>
                      </div>
                    )}
                    <div className="border-t border-[rgba(244,168,48,0.15)] pt-2 flex items-center justify-between">
                      <span className="text-[0.75rem] font-bold text-[#8a826e] uppercase tracking-wider">{date ? "Total" : "Est. Total"}</span>
                      <div className="text-right">
                        <span className="text-[1.1rem] font-black text-[#f4a830]">
                          {formatPriceDisplay(grandTotal, currency)}
                        </span>
                        <span className="block text-[0.6rem] text-[#8a826e] uppercase font-bold tracking-tight">Incl. 15% VAT</span>
                      </div>
                    </div>
                    {!date && <p className="text-[0.68rem] text-[#8a826e] italic text-center">Select a date to confirm pricing</p>}
                  </div>
                </div>

                {/* Calendar */}
                <div>
                  <label className="text-[0.72rem] font-semibold text-[#8a826e] tracking-[0.08em] uppercase mb-2 block">Select Date</label>
                  <AvailabilityCalendar
                    tourId={transfer.id}
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

                {/* Review provider badge (Trustpilot or Google, controlled by admin review_provider setting) */}
                <ExternalReviewBadge />

                {/* CTA */}
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
                      ? isBooked ? "Fully Booked — Choose Another Date" : "Add to Cart"
                      : "Select a Date to Continue"
                    }
                  </Button>
                </div>

                {/* WhatsApp */}
                <a
                  href={`https://wa.me/6787114045?text=${encodeURIComponent(`Hi! I'd like to book "${transfer.title}". `)}`}
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
      </div>
    </Layout>
  );
}
