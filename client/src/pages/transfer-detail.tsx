
import { Link, useParams } from "wouter";
// HTML passthrough — install dompurify later for sanitisation:
//   npm install dompurify @types/dompurify
// Then replace this function with the DOMPurify version.
function sanitizeHtml(html: string): string {
  return html;
}
import { useQuery } from "@tanstack/react-query";
import { fetchTour } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState, useEffect, useCallback } from "react";
import { useCart } from "@/lib/cart-context";
import { useBookingDraft } from "@/lib/booking-state-context";
import { formatPriceDisplay, estimateBookingTotal, type ProductCategory } from "@/lib/product.types";
import { useCurrency } from "@/lib/currency-context";
import { AvailabilityCalendar } from "@/components/AvailabilityCalendar";
import { SEO, cloudinaryOpt } from "@/components/seo";
import { GuestReviewForm } from "@/components/GuestReviewForm";
import { AddonsPanel, calcAddonTotal, type AddonSelections, type ProductAddonEntry } from "@/components/addons-panel";
import { useRealtimeAvailability } from "@/hooks/useRealtimeAvailability";

const WHATSAPP_NUMBER = "6787114045";

export default function TransferDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
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

  // Availability guard — mirrors tour-detail logic
  const { data: availability, loading: availLoading } = useRealtimeAvailability(
    id && date ? { productId: id, date, adultPax, childPax, startTime: selectedTime || undefined } : null
  );
  const isBooked = !availability?.isAvailable && !!date;

  const { data: transfer, isLoading, error } = useQuery({
    queryKey: ["tour", id],
    queryFn: () => fetchTour(id!),
    enabled: !!id,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["product-reviews", id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/tours/${id}/reviews`);
      return res.json();
    },
    enabled: !!id,
  });

  const averageRating = reviews.length > 0
    ? reviews.reduce((acc: number, r: any) => acc + r.rating, 0) / reviews.length
    : 0;
  const starsDisplay = Math.round(averageRating);

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
    if (urlTime) {
      setSelectedTime(urlTime);
      setUrlInitialTime(urlTime);
    }
    const parsedAdults = urlAdults ? parseInt(urlAdults) : (urlGuests ? parseInt(urlGuests) : 2);
    const parsedChildren = urlChildren ? parseInt(urlChildren) : 0;
    const parsedInfants = urlInfants ? parseInt(urlInfants) : 0;
    const parsedPets = urlPets ? parseInt(urlPets) : 0;

    if (parsedAdults) setAdultPax(parsedAdults);
    if (parsedChildren) setChildPax(parsedChildren);
    if (parsedInfants) setInfantPax(parsedInfants);
    if (parsedPets) setPetPax(parsedPets);
    if (id) updateDraft({
      productId: id,
      adultPax: parsedAdults,
      childPax: parsedChildren,
      infantPax: parsedInfants,
      petPax: parsedPets,
      date: urlDate || "",
      startTime: urlTime || undefined
    });
  }, [id, updateDraft]);

  useEffect(() => {
    if (id) updateDraft({ productId: id, adultPax, childPax, infantPax, petPax, date, startTime: selectedTime || undefined });
  }, [id, adultPax, childPax, infantPax, petPax, date, selectedTime, updateDraft]);

  const handleDateSelect = useCallback((d: string) => { setDate(d); setSelectedTime(null); }, []);
  const handleTimeSelect = useCallback((t: string) => { setSelectedTime(t); }, []);

  const handleAddToCart = () => {
    if (!transfer) return;
    addToCart({
      id: transfer.id,
      title: transfer.title,
      price: transfer.adultPriceCents,
      childPrice: transfer.childPriceCents,
      image: transfer.image,
      type: (transfer.category || "transfer") as ProductCategory,
      adultPax,
      childPax,
      infantPax,
      petPax,
      date: date ? new Date(date) : new Date(),
      startTime: selectedTime || undefined,
    });
  };

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

  // Instant total — respects pricingType (per_person or group)
  const adultSubtotal = transfer.adultPriceCents * adultPax;
  const childSubtotal = transfer.childPriceCents * childPax;
  const isGroupPricing = transfer.pricingType === "group";
  const baseTotal = estimateBookingTotal(transfer, adultPax, childPax);
  const instantTotal = isGroupPricing ? baseTotal : (adultPax >= 7 ? Math.round(baseTotal * 0.9) : baseTotal);
  const addonTotal = transfer.addons ? calcAddonTotal(transfer.addons as ProductAddonEntry[], addonSelections) : 0;
  const grandTotal = instantTotal + addonTotal;

  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    `Hi! I have a question about "${transfer.title}". `
  )}`;

  const avgRating = reviews.length > 0
    ? reviews.reduce((a: number, r: any) => a + r.rating, 0) / reviews.length : 0;

  const transferFaqs = [
    { question: `What is included in the ${transfer.title}?`, answer: (Array.isArray(transfer.description) ? transfer.description[0] : transfer.description)?.slice(0, 300) || "Please contact us for full inclusions." },
    { question: "Where does the transfer pick me up?", answer: "We pick up from your hotel, cruise terminal, or the airport. Please provide your location at booking." },
    { question: "What is the cancellation policy?", answer: "Free cancellation up to 24 hours before your scheduled transfer time." },
    { question: "Can I book a private transfer?", answer: "Yes, all our transfers can be arranged as private service. Contact us via WhatsApp for private transfer pricing." },
  ];

  return (
    <Layout>
      <SEO
        title={transfer.seoTitle || transfer.title}
        description={transfer.seoDescription || (Array.isArray(transfer.description) ? transfer.description[0] : transfer.description)?.replace(/<[^>]+>/g, '').slice(0, 155) || `Book ${transfer.title} in Port Vila, Vanuatu. Reliable transfer service with Ace Tours & Transfers.`}
        image={transfer.image}
        type="product"
        keywords={[...(transfer.seoKeywords ? transfer.seoKeywords.split(',').map((k: string) => k.trim()) : []), transfer.title, "Vanuatu transfer", "Port Vila transport", "airport transfer Vanuatu"]}
        structuredType="TouristAttraction"
        productName={transfer.title}
        productDescription={Array.isArray(transfer.description) ? transfer.description[0] : transfer.description}
        offer={transfer.adultPriceCents ? { price: transfer.adultPriceCents, currency: "VUV", availability: "InStock" } : undefined}
        aggregateRating={reviews.length > 0 ? { ratingValue: avgRating, reviewCount: reviews.length } : undefined}
        reviews={reviews.slice(0, 5).map((r: any) => ({ author: r.userName || "Guest", rating: r.rating, body: r.comment, datePublished: r.createdAt?.slice(0, 10) }))}
        faqs={transferFaqs}
      />
      <div className="min-h-screen bg-[#0f0d09] text-[#f0ece4] font-sans pt-16">

        {/* HERO */}
        <div className="relative h-[340px] overflow-hidden bg-[#0f0d09]">
          <img src={cloudinaryOpt(transfer.image, 1200)} className="w-full h-full object-cover filter brightness-[0.5] object-center" alt={transfer.imageAlt || `${transfer.title} - Vanuatu transfer`} loading="eager" fetchPriority="high" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0f0d09]" />
          <div className="absolute bottom-8 left-0 right-0 max-w-[1280px] mx-auto px-8">
            <div className="flex items-center gap-2 text-[0.8rem] text-[#8a826e] mb-3">
              <a href="/" className="text-[#f4a830] hover:underline">Home</a>
              <span>›</span>
              <a href="/transfers" className="text-[#f4a830] hover:underline">{t("nav.transfers", "Transfers")}</a>
              <span>›</span>
              <span className="text-[#f0ece4] opacity-50">{transfer.title}</span>
            </div>
            <h1 className="font-serif text-4xl md:text-5xl font-bold leading-tight mb-3">{transfer.title}</h1>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full border border-[#4caf7d] bg-[#4caf7d]/15 text-[#4caf7d] text-[0.78rem] font-medium">✓ {t("tour.availableNow", "Available Now")}</span>
              <span className="px-3 py-1 rounded-full border border-[#f4a830] bg-[#f4a830]/15 text-[#f4a830] text-[0.78rem] font-medium">🚐 {t("nav.transfers", "Transfer Service")}</span>
              {transfer.duration && <span className="px-3 py-1 rounded-full border border-[rgba(244,168,48,0.18)] bg-[#1a1710] text-[#8a826e] text-[0.78rem] font-medium">⏱ {transfer.duration}</span>}
            </div>
          </div>
        </div>

        {/* MAIN GRID */}
        <div className="max-w-[1280px] mx-auto px-8 py-10 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8 items-start">

          {/* LEFT */}
          <div className="flex flex-col gap-7">

            {/* Photo — matching tour/vehicle detail: fill container with cover */}
            <div className="rounded-[14px] overflow-hidden bg-[#211e18]" style={{ height: '480px' }}>
              <img src={cloudinaryOpt(transfer.image, 900)} className="w-full h-full object-cover object-center block" alt={transfer.imageAlt || `${transfer.title} - photo`} loading="lazy" />
            </div>

            {/* Description */}
            <div className="bg-[#1a1710] border border-[rgba(244,168,48,0.18)] rounded-[14px] p-7">
              <div className="font-serif text-[1.2rem] font-bold mb-5 flex items-center gap-3 after:content-[''] after:flex-1 after:h-[1px] after:bg-[rgba(244,168,48,0.18)]">Transfer Details</div>
              <div
                className="text-[0.92rem] leading-[1.75] text-[#ccc6b8] prose prose-invert prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-[#f4a830] [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-[#f4a830] [&_blockquote]:pl-3 [&_blockquote]:italic"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(typeof transfer.description === "string"
                    ? transfer.description
                    : Array.isArray(transfer.description) && transfer.description[0]
                      ? transfer.description[0]
                      : "Reliable, professional transfer service across Vanuatu.")}}
              />
            </div>

            {/* Included */}
            {Array.isArray(transfer.description) && transfer.description.length > 1 && (
              <div className="bg-[#1a1710] border border-[rgba(244,168,48,0.18)] rounded-[14px] p-7">
                <div className="font-serif text-[1.2rem] font-bold mb-5 flex items-center gap-3 after:content-[''] after:flex-1 after:h-[1px] after:bg-[rgba(244,168,48,0.18)]">What's Included</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {transfer.description.slice(1).map((item, i) => (
                    item.startsWith('<') ? (
                      <div key={i} className="col-span-2 text-[0.88rem] text-[#8a826e] prose prose-invert prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_li]:text-[#8a826e] [&_p]:my-1" dangerouslySetInnerHTML={{ __html: sanitizeHtml(item)}} />
                    ) : (
                      <div key={i} className="flex items-center gap-3 text-[0.88rem] text-[#8a826e]">
                        <div className="w-[22px] h-[22px] rounded-full bg-[#4caf7d]/15 border border-[#4caf7d] flex items-center justify-center text-[0.65rem] text-[#4caf7d] shrink-0">✓</div>
                        <span>{item}</span>
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}

            {/* Rates */}
            <div className="bg-[#1a1710] border border-[rgba(244,168,48,0.18)] rounded-[14px] p-7">
              <div className="font-serif text-[1.2rem] font-bold mb-5 flex items-center gap-3 after:content-[''] after:flex-1 after:h-[1px] after:bg-[rgba(244,168,48,0.18)]">Rates & Options</div>
              {isGroupPricing ? (
                <div>
                  <div className="flex justify-between items-center text-[1rem] mb-3 pb-3 border-b border-[rgba(244,168,48,0.1)]">
                    <span className="text-[#8a826e]">Group / Package Rate</span>
                    <span className="font-bold text-[#f0ece4]">{formatPriceDisplay(transfer.groupPriceCents, currency)}</span>
                  </div>
                  {transfer.groupMaxPax && (
                    <p className="text-[0.8rem] text-[#8a826e]">Flat rate — up to {transfer.groupMaxPax} people included</p>
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-center text-[1rem] mb-3 pb-3 border-b border-[rgba(244,168,48,0.1)]">
                    <span className="text-[#8a826e]">Per Adult</span>
                    <span className="font-bold text-[#f0ece4]">{formatPriceDisplay(transfer.adultPriceCents, currency)}</span>
                  </div>
                  {transfer.childPriceCents > 0 && (
                    <div className="flex justify-between items-center text-[1rem]">
                      <span className="text-[#8a826e]">Per Child</span>
                      <span className="font-bold text-[#f0ece4]">{formatPriceDisplay(transfer.childPriceCents, currency)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Reviews */}
            <div className="bg-[#1a1710] border border-[rgba(244,168,48,0.18)] rounded-[14px] p-7">
              <div className="font-serif text-[1.2rem] font-bold mb-5 flex items-center gap-3 after:content-[''] after:flex-1 after:h-[1px] after:bg-[rgba(244,168,48,0.18)]">Guest Reviews</div>
              <div className="flex items-center gap-6 pb-5 mb-5 border-b border-[rgba(244,168,48,0.18)]">
                <div className="font-serif text-6xl font-bold text-[#f4a830]">
                  {reviews.length > 0 ? averageRating.toFixed(1) : "–"}
                </div>
                <div className="flex-1">
                  <div className="text-[#f4a830] text-[1.1rem] tracking-[2px]">
                    {"★".repeat(starsDisplay)}{"☆".repeat(5 - starsDisplay)}
                  </div>
                  <div className="text-[0.82rem] text-[#8a826e] mt-1">
                    Based on {reviews.length} verified {reviews.length === 1 ? "booking" : "bookings"}
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {reviews.length > 0 ? (
                  reviews.slice(0, 3).map((r: any) => (
                    <div key={r.id} className="bg-[#211e18] rounded-[10px] p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-semibold text-[0.9rem]">{r.authorName || r.userName || "Guest"}</div>
                          <div className="text-[#f4a830] text-[0.78rem]">{"★".repeat(r.rating)}</div>
                        </div>
                        <div className="text-[0.75rem] text-[#8a826e]">{new Date(r.createdAt).toLocaleDateString()}</div>
                      </div>
                      <p className="text-[0.855rem] text-[#b8b0a0] leading-[1.6] italic">"{r.comment}"</p>
                    </div>
                  ))
                ) : (
                  <p className="text-[0.88rem] text-[#8a826e] italic">No reviews yet. Be the first to leave one!</p>
                )}
              </div>

              {/* Review submission form */}
              <div className="mt-5 pt-5 border-t border-[rgba(244,168,48,0.12)]">
                <GuestReviewForm
                  productId={id!}
                  productTitle={transfer.title}
                  reviewQueryKey={["product-reviews", id!]}
                />
              </div>
            </div>

          </div>

          {/* RIGHT: STICKY BOOKING PANEL */}
          <div className="sticky top-[82px] bg-[#1a1710] border border-[rgba(244,168,48,0.18)] rounded-[14px] overflow-hidden">

            {/* Price header */}
            <div className="bg-[#211e18] px-6 py-5 border-b border-[rgba(244,168,48,0.18)]">
              {isGroupPricing ? (
                <div>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-[0.78rem] text-[#8a826e]">Package rate</span>
                    <span className="font-serif text-[2rem] font-bold text-[#f4a830]">{formatPriceDisplay(transfer.groupPriceCents, currency)}</span>
                  </div>
                  {transfer.groupMaxPax && (
                    <div className="text-[0.78rem] text-[#8a826e]">Flat rate — up to {transfer.groupMaxPax} people</div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-[0.78rem] text-[#8a826e]">From</span>
                    <span className="font-serif text-[2rem] font-bold text-[#f4a830]">{formatPriceDisplay(transfer.adultPriceCents, currency)}</span>
                    <span className="text-[0.8rem] text-[#8a826e]">/ person</span>
                  </div>
                  {transfer.childPriceCents > 0 && (
                    <div className="text-[0.78rem] text-[#8a826e]">
                      Child: {formatPriceDisplay(transfer.childPriceCents, currency)} · Children pricing available
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-5 flex flex-col gap-5">

              {/* Guest counters — hidden for group/package pricing */}
              {!isGroupPricing && (
              <div>
                <label className="text-[0.75rem] font-semibold text-[#8a826e] tracking-[0.07em] uppercase mb-2 block">Passengers</label>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between bg-[#211e18] border border-[rgba(244,168,48,0.18)] rounded-[10px] px-4 py-2">
                    <div>
                      <span className="text-[0.85rem] text-[#f0ece4] font-medium">Adults</span>
                      <span className="text-[0.72rem] text-[#8a826e] ml-2">{formatPriceDisplay(transfer.adultPriceCents, currency)} ea</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setAdultPax(p => Math.max(1, p - 1))} className="w-[28px] h-[28px] rounded-full bg-[#1a1710] border border-[rgba(244,168,48,0.18)] text-[#f0ece4] hover:border-[#f4a830] hover:bg-[#f4a830]/15 transition-all text-lg flex items-center justify-center">−</button>
                      <span className="w-6 text-center font-bold text-[#f4a830]">{adultPax}</span>
                      <button onClick={() => setAdultPax(p => Math.min(20, p + 1))} className="w-[28px] h-[28px] rounded-full bg-[#1a1710] border border-[rgba(244,168,48,0.18)] text-[#f0ece4] hover:border-[#f4a830] hover:bg-[#f4a830]/15 transition-all text-lg flex items-center justify-center">+</button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-[#211e18] border border-[rgba(244,168,48,0.18)] rounded-[10px] px-4 py-2">
                    <div>
                      <span className="text-[0.85rem] text-[#f0ece4] font-medium">Children</span>
                      {transfer.childPriceCents > 0
                        ? <span className="text-[0.72rem] text-[#8a826e] ml-2">{formatPriceDisplay(transfer.childPriceCents, currency)} ea</span>
                        : <span className="text-[0.72rem] text-[#4caf7d] ml-2">Free</span>
                      }
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setChildPax(p => Math.max(0, p - 1))} className="w-[28px] h-[28px] rounded-full bg-[#1a1710] border border-[rgba(244,168,48,0.18)] text-[#f0ece4] hover:border-[#f4a830] hover:bg-[#f4a830]/15 transition-all text-lg flex items-center justify-center">−</button>
                      <span className="w-6 text-center font-bold text-[#f4a830]">{childPax}</span>
                      <button onClick={() => setChildPax(p => Math.min(20, p + 1))} className="w-[28px] h-[28px] rounded-full bg-[#1a1710] border border-[rgba(244,168,48,0.18)] text-[#f0ece4] hover:border-[#f4a830] hover:bg-[#f4a830]/15 transition-all text-lg flex items-center justify-center">+</button>
                    </div>
                  </div>
                  {/* Infants */}
                  <div className="flex items-center justify-between bg-[#211e18] border border-[rgba(244,168,48,0.18)] rounded-[10px] px-4 py-2">
                    <div>
                      <span className="text-[0.85rem] text-[#f0ece4] font-medium">Infants</span>
                      <span className="text-[0.72rem] text-[#4caf7d] ml-2">Free</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setInfantPax(p => Math.max(0, p - 1))} className="w-[28px] h-[28px] rounded-full bg-[#1a1710] border border-[rgba(244,168,48,0.18)] text-[#f0ece4] hover:border-[#f4a830] hover:bg-[#f4a830]/15 transition-all text-lg flex items-center justify-center">−</button>
                      <span className="w-6 text-center font-bold text-[#f4a830]">{infantPax}</span>
                      <button onClick={() => setInfantPax(p => Math.min(10, p + 1))} className="w-[28px] h-[28px] rounded-full bg-[#1a1710] border border-[rgba(244,168,48,0.18)] text-[#f0ece4] hover:border-[#f4a830] hover:bg-[#f4a830]/15 transition-all text-lg flex items-center justify-center">+</button>
                    </div>
                  </div>
                  {/* Pets */}
                  <div className="flex items-center justify-between bg-[#211e18] border border-[rgba(244,168,48,0.18)] rounded-[10px] px-4 py-2">
                    <div>
                      <span className="text-[0.85rem] text-[#f0ece4] font-medium">Pets</span>
                      <span className="text-[0.72rem] text-[#4caf7d] ml-2">Free</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setPetPax(p => Math.max(0, p - 1))} className="w-[28px] h-[28px] rounded-full bg-[#1a1710] border border-[rgba(244,168,48,0.18)] text-[#f0ece4] hover:border-[#f4a830] hover:bg-[#f4a830]/15 transition-all text-lg flex items-center justify-center">−</button>
                      <span className="w-6 text-center font-bold text-[#f4a830]">{petPax}</span>
                      <button onClick={() => setPetPax(p => Math.min(5, p + 1))} className="w-[28px] h-[28px] rounded-full bg-[#1a1710] border border-[rgba(244,168,48,0.18)] text-[#f0ece4] hover:border-[#f4a830] hover:bg-[#f4a830]/15 transition-all text-lg flex items-center justify-center">+</button>
                    </div>
                  </div>
                </div>
              </div>
              )} {/* end !isGroupPricing guest counters */}

              {/* Add-ons */}
              {transfer.addons && transfer.addons.length > 0 && (
                <AddonsPanel
                  addons={transfer.addons as ProductAddonEntry[]}
                  selected={addonSelections}
                  onChange={setAddonSelections}
                  currency={currency}
                />
              )}

              {/* INSTANT PRICING BREAKDOWN — always visible, recalculates on every +/- tap */}
              <div className="bg-[#211e18] border border-[rgba(244,168,48,0.18)] rounded-[12px] overflow-hidden">
                <div className="px-4 py-3 border-b border-[rgba(244,168,48,0.1)]">
                  <span className="text-[0.7rem] font-black uppercase tracking-[0.1em] text-[#8a826e]">Price Breakdown</span>
                </div>
                <div className="px-4 py-3 space-y-2">
                  {isGroupPricing ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[0.82rem] text-[#ccc6b8]">Package rate</span>
                        {transfer.groupMaxPax && (
                          <span className="text-[0.72rem] text-[#8a826e]">up to {transfer.groupMaxPax} people</span>
                        )}
                      </div>
                      <span className="text-[0.9rem] font-semibold text-[#f0ece4]">{formatPriceDisplay(transfer.groupPriceCents, currency)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[0.82rem] text-[#ccc6b8]">{adultPax} × Adult</span>
                          <span className="text-[0.72rem] text-[#8a826e]">@ {formatPriceDisplay(transfer.adultPriceCents, currency)}</span>
                        </div>
                        <span className="text-[0.9rem] font-semibold text-[#f0ece4]">{formatPriceDisplay(adultSubtotal, currency)}</span>
                      </div>
                      {childPax > 0 && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[0.82rem] text-[#ccc6b8]">{childPax} × Child</span>
                            {transfer.childPriceCents > 0
                              ? <span className="text-[0.72rem] text-[#8a826e]">@ {formatPriceDisplay(transfer.childPriceCents, currency)}</span>
                              : <span className="text-[0.72rem] text-[#4caf7d]">Free</span>
                            }
                          </div>
                          <span className="text-[0.9rem] font-semibold text-[#f0ece4]">
                            {transfer.childPriceCents > 0 ? formatPriceDisplay(childSubtotal, currency) : <span className="text-[#4caf7d]">VT 0</span>}
                          </span>
                        </div>
                      )}
                      {infantPax > 0 && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[0.82rem] text-[#ccc6b8]">{infantPax} × Infant</span>
                            <span className="text-[0.72rem] text-[#4caf7d]">Free</span>
                          </div>
                          <span className="text-[0.9rem] font-semibold text-[#4caf7d]">VT 0</span>
                        </div>
                      )}
                      {petPax > 0 && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[0.82rem] text-[#ccc6b8]">{petPax} × Pet</span>
                            <span className="text-[0.72rem] text-[#4caf7d]">Free</span>
                          </div>
                          <span className="text-[0.9rem] font-semibold text-[#4caf7d]">VT 0</span>
                        </div>
                      )}
                      {adultPax >= 7 && (
                        <div className="flex items-center justify-between text-[#4caf7d]">
                          <span className="text-[0.78rem]">🎉 Group discount (10%)</span>
                          <span className="text-[0.82rem] font-semibold">−applied</span>
                        </div>
                      )}
                    </>
                  )}
                  <div className="border-t border-[rgba(244,168,48,0.18)] pt-2 mt-1 flex items-center justify-between">
                    <span className="text-[0.8rem] font-bold text-[#8a826e] uppercase tracking-wider">{date ? "Total" : "Est. Total"}</span>
                    <div className="text-right">
                      {addonTotal > 0 && (
                        <span className="text-[0.75rem] text-[#8a826e] block">
                          {formatPriceDisplay(instantTotal, currency)} + {formatPriceDisplay(addonTotal, currency)} add-ons
                        </span>
                      )}
                      <span className="text-[1.15rem] font-black text-[#f4a830] block leading-none">{formatPriceDisplay(grandTotal, currency)}</span>
                      <span className="text-[0.62rem] text-[#8a826e] uppercase font-bold tracking-tighter">Includes 15% VAT</span>
                    </div>
                  </div>
                  {!date && <p className="text-[0.68rem] text-[#8a826e] italic text-center pt-1">Select a date to confirm availability</p>}
                </div>
              </div>

              {/* Calendar */}
              <div>
                <label className="text-[0.75rem] font-semibold text-[#8a826e] tracking-[0.07em] uppercase mb-2 block">Select Date</label>
                <AvailabilityCalendar
                  tourId={transfer.id}
                  selectedDate={date}
                  selectedTime={selectedTime || urlInitialTime}
                  participants={{ adults: adultPax, children: childPax }}
                  onDateSelect={handleDateSelect}
                  onTimeSelect={handleTimeSelect}
                />
              </div>

              {/* Selected date */}
              {date && (
                <div className="bg-[#f4a830]/15 border border-[rgba(244,168,48,0.3)] rounded-[10px] px-4 py-3 animate-in fade-in slide-in-from-top-2">
                  <div className="text-[0.72rem] text-[#f4a830] font-semibold uppercase tracking-[0.06em] mb-1">Selected Date</div>
                  <div className="text-[0.95rem] font-semibold">{new Date(date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
                  {selectedTime && <div className="text-[0.8rem] text-[#f4a830] mt-1 font-medium">⏱ {selectedTime}</div>}
                </div>
              )}

              {/* CTAs */}
              <div className="flex flex-col gap-3">
                <Button
                  disabled={!date || isBooked || availLoading}
                  className={`w-full h-14 rounded-[10px] text-[0.95rem] font-bold tracking-[0.02em] ${date && !isBooked ? "bg-[#f4a830] text-[#0f0d09] hover:bg-[#fdc96a] shadow-[0_6px_24px_rgba(244,168,48,0.4)]" : "bg-[#211e18] text-[#4a4438] cursor-not-allowed border border-[rgba(244,168,48,0.18)] hover:bg-[#211e18]"}`}
                  onClick={handleAddToCart}
                >
                  <ShoppingCart className="mr-2 h-5 w-5" />
                  {date
                    ? isBooked ? "Fully Booked — Choose Another Date" : "Add to Cart"
                    : "Select a Date to Continue"
                  }
                </Button>
                <Link
                  href={`/reservations?tab=book-new&service=${encodeURIComponent(transfer.title)}&adults=${adultPax}&children=${childPax}&date=${date}`}
                >
                  <button
                    disabled={!date || isBooked || availLoading}
                    className={`w-full h-12 rounded-[10px] text-[0.875rem] font-bold border-2 transition-all ${date && !isBooked ? "bg-transparent border-[#f4a830] text-[#f4a830] hover:bg-[#f4a830]/10" : "border-[rgba(244,168,48,0.18)] text-[#4a4438] cursor-not-allowed"}`}
                  >
                    Book Now
                  </button>
                </Link>
              </div>

              {/* WhatsApp Ask a Question */}
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full p-3 text-[#25D366] border border-[#25D366]/40 rounded-[10px] text-[0.875rem] hover:border-[#25D366] hover:bg-[#25D366]/10 transition-all flex items-center justify-center gap-2 font-medium"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current shrink-0" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                💬 Ask a Question via WhatsApp
              </a>

              <div className="flex gap-4 pt-4 border-t border-[rgba(244,168,48,0.18)] text-[0.73rem] text-[#8a826e]">
                <div className="flex flex-1 items-center gap-2">🛡️ Free cancellation 24h before</div>
                <div className="flex flex-1 items-center gap-2">🔒 Instant confirmation</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}
