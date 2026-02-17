
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { fetchTour } from "@/lib/api";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState, useEffect, useCallback } from "react";
import { useCart } from "@/lib/cart-context";
import { useBookingDraft } from "@/lib/booking-state-context";
import { formatPrice, type ProductCategory } from "@/lib/product.types";
import { useCurrency } from "@/lib/currency-context";
import { AvailabilityCalendar } from "@/components/AvailabilityCalendar";
import { BookingModal } from "@/components/booking-modal";

export default function TransferDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { addToCart } = useCart();
  const { updateDraft } = useBookingDraft();
  const { currency } = useCurrency();

  const [adultPax, setAdultPax] = useState(2);
  const [childPax, setChildPax] = useState(0);
  const [date, setDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const { data: transfer, isLoading, error } = useQuery({
    queryKey: ["tour", id],
    queryFn: () => fetchTour(id!),
    enabled: !!id,
  });

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const urlDate = sp.get("date");
    const urlGuests = sp.get("guests");
    if (urlDate) setDate(urlDate);
    if (urlGuests) setAdultPax(parseInt(urlGuests) || 2);
    if (id) updateDraft({ productId: id, adultPax: parseInt(urlGuests || "2") || 2, childPax: 0, date: urlDate || "" });
  }, [id, updateDraft]);

  useEffect(() => {
    if (id) updateDraft({ productId: id, adultPax, childPax, date });
  }, [id, adultPax, childPax, date, updateDraft]);

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

  return (
    <Layout>
      <div className="min-h-screen bg-[#0f0d09] text-[#f0ece4] font-sans pt-16">

        {/* ── HERO ── */}
        <div className="relative h-[340px] overflow-hidden">
          <img
            src={transfer.image}
            className="w-full h-full object-cover filter brightness-[0.5] object-center"
            alt={transfer.title}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0f0d09]" />
          <div className="absolute bottom-8 left-0 right-0 max-w-[1280px] mx-auto px-8">
            <div className="flex items-center gap-2 text-[0.8rem] text-[#8a826e] mb-3">
              <a href="/" className="text-[#f4a830] hover:underline">Home</a>
              <span>›</span>
              <a href="/transfers" className="text-[#f4a830] hover:underline">{t("nav.transfers", "Transfers")}</a>
              <span>›</span>
              <span className="text-[#f0ece4] opacity-50">{transfer.title}</span>
            </div>
            <h1 className="font-serif text-4xl md:text-5xl font-bold leading-tight mb-3">
              {transfer.title}
            </h1>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full border border-[#4caf7d] bg-[#4caf7d]/15 text-[#4caf7d] text-[0.78rem] font-medium">
                ✓ {t("tour.availableNow", "Available Now")}
              </span>
              <span className="px-3 py-1 rounded-full border border-[#f4a830] bg-[#f4a830]/15 text-[#f4a830] text-[0.78rem] font-medium">
                🚐 {t("nav.transfers", "Transfer Service")}
              </span>
              {transfer.duration && (
                <span className="px-3 py-1 rounded-full border border-[rgba(244,168,48,0.18)] bg-[#1a1710] text-[#8a826e] text-[0.78rem] font-medium">
                  ⏱ {transfer.duration}
                </span>
              )}
              {transfer.minPax && (
                <span className="px-3 py-1 rounded-full border border-[rgba(244,168,48,0.18)] bg-[#1a1710] text-[#8a826e] text-[0.78rem] font-medium">
                  👥 {t("tour.from", "From")} {transfer.minPax}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── MAIN GRID ── */}
        <div className="max-w-[1280px] mx-auto px-8 py-10 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8 items-start">

          {/* ── LEFT COLUMN ── */}
          <div className="flex flex-col gap-7">

            {/* Photo gallery */}
            <div className="grid grid-cols-2 grid-rows-[200px_140px] gap-2 rounded-[14px] overflow-hidden">
              <div className="col-start-1 row-start-1 row-end-3 overflow-hidden">
                <img
                  src={transfer.image}
                  className="w-full h-full object-cover hover:scale-[1.03] transition-transform duration-500 cursor-pointer"
                  alt={transfer.title}
                />
              </div>
              <div className="overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=800&q=80"
                  className="w-full h-full object-cover hover:scale-[1.03] transition-transform duration-500 cursor-pointer"
                  alt="Transfer vehicle"
                />
              </div>
              <div className="relative overflow-hidden group cursor-pointer">
                <img
                  src="https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=600&q=80"
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                  alt="Transfer vehicle"
                />
                <div className="absolute inset-0 bg-black/55 flex items-center justify-center font-semibold text-white">
                  + {t("gallery.more", "4 more")}
                </div>
              </div>
            </div>

            {/* Transfer Details */}
            <div className="bg-[#1a1710] border border-[rgba(244,168,48,0.18)] rounded-[14px] p-7">
              <div className="font-serif text-[1.2rem] font-bold mb-5 flex items-center gap-3 after:content-[''] after:flex-1 after:h-[1px] after:bg-[rgba(244,168,48,0.18)]">
                {t("quickView.overview", "Transfer Details")}
              </div>
              <p className="text-[0.92rem] leading-[1.75] text-[#ccc6b8]">
                {typeof transfer.description === "string"
                  ? transfer.description
                  : Array.isArray(transfer.description) && transfer.description[0]
                    ? transfer.description[0]
                    : t("quickView.defaultDesc", "Reliable, professional transfer service across Vanuatu.")}
              </p>
            </div>

            {/* What's Included */}
            {Array.isArray(transfer.description) && transfer.description.length > 1 && (
              <div className="bg-[#1a1710] border border-[rgba(244,168,48,0.18)] rounded-[14px] p-7">
                <div className="font-serif text-[1.2rem] font-bold mb-5 flex items-center gap-3 after:content-[''] after:flex-1 after:h-[1px] after:bg-[rgba(244,168,48,0.18)]">
                  {t("quickView.whatsIncluded", "What's Included")}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {transfer.description.slice(1).map((item, i) => (
                    <div key={i} className="flex items-center gap-3 text-[0.88rem] text-[#8a826e]">
                      <div className="w-[22px] h-[22px] rounded-full bg-[#4caf7d]/15 border border-[#4caf7d] flex items-center justify-center text-[0.65rem] text-[#4caf7d] shrink-0">✓</div>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rates */}
            <div className="bg-[#1a1710] border border-[rgba(244,168,48,0.18)] rounded-[14px] p-7">
              <div className="font-serif text-[1.2rem] font-bold mb-5 flex items-center gap-3 after:content-[''] after:flex-1 after:h-[1px] after:bg-[rgba(244,168,48,0.18)]">
                {t("quickView.ratesOptions", "Rates & Options")}
              </div>
              <div className="flex justify-between items-center text-[1rem] mb-3 pb-3 border-b border-[rgba(244,168,48,0.1)]">
                <span className="text-[#8a826e]">{t("quickView.adult", "Per Person")}</span>
                <span className="font-bold text-[#f0ece4]">{formatPrice(transfer.adultPriceCents)}</span>
              </div>
              {transfer.childPriceCents > 0 && (
                <div className="flex justify-between items-center text-[1rem]">
                  <span className="text-[#8a826e]">{t("quickView.child", "Child")}</span>
                  <span className="font-bold text-[#f0ece4]">{formatPrice(transfer.childPriceCents)}</span>
                </div>
              )}
            </div>

            {/* Reviews */}
            <div className="bg-[#1a1710] border border-[rgba(244,168,48,0.18)] rounded-[14px] p-7">
              <div className="font-serif text-[1.2rem] font-bold mb-5 flex items-center gap-3 after:content-[''] after:flex-1 after:h-[1px] after:bg-[rgba(244,168,48,0.18)]">
                {t("quickView.recentReviews", "Guest Reviews")}
              </div>
              <div className="flex items-center gap-6 pb-5 mb-5 border-b border-[rgba(244,168,48,0.18)]">
                <div className="font-serif text-6xl font-bold text-[#f4a830]">5.0</div>
                <div className="flex-1">
                  <div className="text-[#f4a830] text-[1.1rem] tracking-[2px]">★★★★★</div>
                  <div className="text-[0.82rem] text-[#8a826e] mt-1">{t("reviews.basedOn", "Based on")} 8 {t("reviews.verified", "verified bookings")}</div>
                </div>
              </div>
              <div className="bg-[#211e18] rounded-[10px] p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-semibold text-[0.9rem]">John T.</div>
                    <div className="text-[#f4a830] text-[0.78rem]">★★★★★</div>
                  </div>
                  <div className="text-[0.75rem] text-[#8a826e]">{t("quickView.daysAgo", "3 days ago")}</div>
                </div>
                <p className="text-[0.855rem] text-[#b8b0a0] leading-[1.6] italic">"{t("quickView.transferReview", "Very professional and punctual service. The driver was helpful with our luggage.")}"</p>
              </div>
            </div>

          </div>{/* end left column */}

          {/* ── RIGHT: STICKY BOOKING PANEL ── */}
          <div className="sticky top-[82px] bg-[#1a1710] border border-[rgba(244,168,48,0.18)] rounded-[14px] overflow-hidden">

            {/* Price header */}
            <div className="bg-[#211e18] px-6 py-5 border-b border-[rgba(244,168,48,0.18)]">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-[0.78rem] text-[#8a826e]">{t("tour.from", "From")}</span>
                <span className="font-serif text-[2rem] font-bold text-[#f4a830]">
                  {formatPrice(transfer.adultPriceCents)}
                </span>
                <span className="text-[0.8rem] text-[#8a826e]">/ {t("quickView.adult", "person")}</span>
              </div>
              <div className="text-[0.78rem] text-[#8a826e]">{t("tour.privateTransferNote", "Private transfer — your group only")}</div>
            </div>

            <div className="px-6 py-5 flex flex-col gap-5">

              {/* Guest counters */}
              <div>
                <label className="text-[0.75rem] font-semibold text-[#8a826e] tracking-[0.07em] uppercase mb-2 block">
                  {t("booking.guests", "Passengers")}
                </label>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between bg-[#211e18] border border-[rgba(244,168,48,0.18)] rounded-[10px] px-4 py-2">
                    <span className="text-[0.85rem] text-[#8a826e]">{t("booking.adults", "Adults")}</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setAdultPax(prev => Math.max(1, prev - 1))}
                        className="w-[28px] h-[28px] rounded-full bg-[#1a1710] border border-[rgba(244,168,48,0.18)] text-[#f0ece4] hover:border-[#f4a830] hover:bg-[#f4a830]/15 transition-all text-lg leading-none"
                      >−</button>
                      <span className="w-6 text-center font-semibold">{adultPax}</span>
                      <button
                        onClick={() => setAdultPax(prev => Math.min(20, prev + 1))}
                        className="w-[28px] h-[28px] rounded-full bg-[#1a1710] border border-[rgba(244,168,48,0.18)] text-[#f0ece4] hover:border-[#f4a830] hover:bg-[#f4a830]/15 transition-all text-lg leading-none"
                      >+</button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-[#211e18] border border-[rgba(244,168,48,0.18)] rounded-[10px] px-4 py-2">
                    <span className="text-[0.85rem] text-[#8a826e]">{t("booking.children", "Children")}</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setChildPax(prev => Math.max(0, prev - 1))}
                        className="w-[28px] h-[28px] rounded-full bg-[#1a1710] border border-[rgba(244,168,48,0.18)] text-[#f0ece4] hover:border-[#f4a830] hover:bg-[#f4a830]/15 transition-all text-lg leading-none"
                      >−</button>
                      <span className="w-6 text-center font-semibold">{childPax}</span>
                      <button
                        onClick={() => setChildPax(prev => Math.min(20, prev + 1))}
                        className="w-[28px] h-[28px] rounded-full bg-[#1a1710] border border-[rgba(244,168,48,0.18)] text-[#f0ece4] hover:border-[#f4a830] hover:bg-[#f4a830]/15 transition-all text-lg leading-none"
                      >+</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Calendar */}
              <div>
                <label className="text-[0.75rem] font-semibold text-[#8a826e] tracking-[0.07em] uppercase mb-2 block">
                  {t("itinerary.bookingInfo", "Select Date")}
                </label>
                <AvailabilityCalendar
                  tourId={transfer.id}
                  selectedDate={date}
                  participants={{ adults: adultPax, children: childPax }}
                  onDateSelect={handleDateSelect}
                  onTimeSelect={handleTimeSelect}
                />
              </div>

              {/* Selected date confirmation */}
              {date && (
                <div className="bg-[#f4a830]/15 border border-[rgba(244,168,48,0.3)] rounded-[10px] px-4 py-3 animate-in fade-in slide-in-from-top-2">
                  <div className="text-[0.72rem] text-[#f4a830] font-semibold uppercase tracking-[0.06em] mb-1">
                    {t("booking.selectedDate", "Selected Date")}
                  </div>
                  <div className="text-[0.95rem] font-semibold">
                    {new Date(date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  </div>
                  {selectedTime && (
                    <div className="text-[0.8rem] text-[#f4a830] mt-1 font-medium">⏱ {selectedTime}</div>
                  )}
                </div>
              )}

              {/* Pricing breakdown */}
              {date && (
                <div className="border-t border-[rgba(244,168,48,0.18)] pt-4">
                  <div className="flex justify-between text-[0.85rem] text-[#8a826e] mb-2">
                    <span>{adultPax} × {t("quickView.adult", "adult")}</span>
                    <span>{formatPrice(transfer.adultPriceCents * adultPax)}</span>
                  </div>
                  {childPax > 0 && (
                    <div className="flex justify-between text-[0.85rem] text-[#8a826e] mb-2">
                      <span>{childPax} × {t("quickView.child", "child")}</span>
                      <span>{formatPrice(transfer.childPriceCents * childPax)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-[0.95rem] border-t border-[rgba(244,168,48,0.18)] pt-2 mt-1">
                    <span>Total</span>
                    <span className="text-[#f4a830]">
                      {formatPrice((transfer.adultPriceCents * adultPax) + (transfer.childPriceCents * childPax))}
                    </span>
                  </div>
                </div>
              )}

              {/* CTAs */}
              <div className="flex flex-col gap-3">
                <Button
                  disabled={!date}
                  className={`w-full h-14 rounded-[10px] text-[0.95rem] font-bold tracking-[0.02em] ${
                    date
                      ? "bg-[#f4a830] text-[#0f0d09] hover:bg-[#fdc96a] shadow-[0_6px_24px_rgba(244,168,48,0.4)]"
                      : "bg-[#211e18] text-[#4a4438] cursor-not-allowed border border-[rgba(244,168,48,0.18)] hover:bg-[#211e18]"
                  }`}
                  onClick={handleAddToCart}
                >
                  <ShoppingCart className="mr-2 h-5 w-5" />
                  {date
                    ? t("cart.addToCart", "Add to Cart")
                    : t("booking.selectDateFirst", "Select a Date to Continue")}
                </Button>

                <BookingModal
                  preselectedService={transfer.title}
                  initialAdultPax={String(adultPax)}
                  initialChildPax={String(childPax)}
                  initialDate={date ? new Date(date) : undefined}
                  trigger={
                    <button
                      disabled={!date}
                      className={`w-full h-12 rounded-[10px] text-[0.875rem] font-bold border-2 transition-all ${
                        date
                          ? "bg-transparent border-[#f4a830] text-[#f4a830] hover:bg-[#f4a830]/10"
                          : "border-[rgba(244,168,48,0.18)] text-[#4a4438] cursor-not-allowed"
                      }`}
                    >
                      {t("tour.bookNow", "Book Now")}
                    </button>
                  }
                />
              </div>

              <button className="w-full p-3 text-[#8a826e] border border-[rgba(244,168,48,0.18)] rounded-[10px] text-[0.875rem] hover:border-[#f4a830] hover:text-[#f4a830] transition-all">
                💬 {t("common.askQuestion", "Ask a Question")}
              </button>

              <div className="flex gap-4 pt-4 border-t border-[rgba(244,168,48,0.18)] text-[0.73rem] text-[#8a826e]">
                <div className="flex flex-1 items-center gap-2">🛡️ {t("booking.freeCancellation", "Free cancellation 24h before")}</div>
                <div className="flex flex-1 items-center gap-2">🔒 {t("booking.instantConfirmation", "Instant confirmation")}</div>
              </div>
            </div>
          </div>{/* end booking panel */}

        </div>
      </div>
    </Layout>
  );
}
