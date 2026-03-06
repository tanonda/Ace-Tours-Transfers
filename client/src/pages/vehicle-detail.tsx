import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { fetchVehicle } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, ChevronLeft, ChevronRight, Calendar, Fuel, Users, Settings, Wind, Shield, Wifi, Baby, Zap, CheckCircle2, AlertTriangle, XCircle, ShoppingCart, Mail, Phone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { SEO, cloudinaryOpt } from "@/components/seo";
import { GuestReviewForm } from "@/components/GuestReviewForm";
import { useCmsText } from "@/hooks/use-cms-text";
import { AddonsPanel, calcAddonTotal, type AddonSelections, type ProductAddonEntry } from "@/components/addons-panel";
import { useCart } from "@/lib/cart-context";
import { useBookingDraft } from "@/lib/booking-state-context";
import { formatPriceDisplay, estimateBookingTotal } from "@/lib/product.types";
import { useCurrency } from "@/lib/currency-context";
import {
  addDays, format, differenceInCalendarDays,
  startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isBefore, isAfter, isSameDay, parseISO, startOfDay
} from "date-fns";
import {
  BookingCountdownTimer,
  CancellationModal,
  CancellationCard,
  ContactCard,
  ExternalReviewBadge,
  GoogleReviewsSection,
  sanitizeHtml,
} from "@/components/shared-detail-components";

// ─── Slot fetcher ─────────────────────────────────────────────────────────────
async function fetchSlots(productId: string, date: string) {
  try {
    const res = await apiRequest("GET", `/api/availability/slots?serviceId=${productId}&date=${date}&guests=1`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// ─── Multi-day range calendar ─────────────────────────────────────────────────
function RangeCalendar({ pickupDate, returnDate, onRangeChange }: {
  pickupDate: string | null;
  returnDate: string | null;
  onRangeChange: (pickup: string, ret: string) => void;
}) {
  const today = startOfDay(new Date());
  const [viewMonth, setViewMonth] = useState(() =>
    pickupDate ? startOfMonth(parseISO(pickupDate)) : startOfMonth(today)
  );
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [selecting, setSelecting] = useState<"pickup" | "return">(pickupDate ? "return" : "pickup");

  const days = useMemo(() => {
    const start = startOfMonth(viewMonth);
    const end = endOfMonth(viewMonth);
    const monthDays = eachDayOfInterval({ start, end });
    return [...Array(getDay(start)).fill(null), ...monthDays];
  }, [viewMonth]);

  const pickup = pickupDate ? parseISO(pickupDate) : null;
  const ret = returnDate ? parseISO(returnDate) : null;

  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const handleDayClick = (d: Date) => {
    if (isBefore(d, today)) return;
    const ds = format(d, "yyyy-MM-dd");
    if (selecting === "pickup" || !pickup) {
      onRangeChange(ds, "");
      setSelecting("return");
    } else if (!isAfter(d, pickup)) {
      onRangeChange(ds, "");
      setSelecting("return");
    } else {
      onRangeChange(format(pickup, "yyyy-MM-dd"), ds);
      setSelecting("pickup");
    }
  };

  return (
    <div className="rounded-[14px] overflow-hidden border border-[rgba(244,168,48,0.2)] bg-[#1a1710]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[rgba(244,168,48,0.12)]">
        <button onClick={() => setViewMonth(m => addDays(startOfMonth(m), -1))}
          className="w-8 h-8 rounded-lg bg-[#211e18] border border-[rgba(244,168,48,0.18)] flex items-center justify-center text-[#8a826e] hover:border-[#f4a830] hover:text-[#f4a830] transition-all">
          <ChevronLeft size={14} />
        </button>
        <span className="font-serif text-[0.9rem] font-bold text-[#f4a830]">
          {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </span>
        <button onClick={() => setViewMonth(m => addDays(endOfMonth(m), 1))}
          className="w-8 h-8 rounded-lg bg-[#211e18] border border-[rgba(244,168,48,0.18)] flex items-center justify-center text-[#8a826e] hover:border-[#f4a830] hover:text-[#f4a830] transition-all">
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Mode tabs */}
      <div className="flex border-b border-[rgba(244,168,48,0.12)]">
        {(["pickup", "return"] as const).map(mode => (
          <div key={mode} onClick={() => setSelecting(mode)}
            className={`flex-1 py-2 text-center text-[0.65rem] font-bold uppercase tracking-widest cursor-pointer transition-colors ${selecting === mode ? "bg-[#f4a830]/10 text-[#f4a830] border-b-2 border-[#f4a830]" : "text-[#3a342c] hover:text-[#8a826e]"
              }`}>
            {mode === "pickup"
              ? (pickup ? format(pickup, "MMM d") : "Pick-up date")
              : (ret ? format(ret, "MMM d") : "Return date")
            }
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="px-3 pt-3">
        <div className="grid grid-cols-7 mb-1">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
            <div key={d} className="text-center text-[9px] font-bold uppercase tracking-widest text-[#3a342c] py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-0.5 pb-3">
          {days.map((d, i) => {
            if (!d) return <div key={`e-${i}`} />;
            const isPast = isBefore(d as Date, today);
            const isPickup = pickup && isSameDay(d as Date, pickup);
            const isReturn = ret && isSameDay(d as Date, ret);
            const rangeEnd = selecting === "return" && hoverDate && pickup
              ? (isAfter(hoverDate, pickup) ? hoverDate : null)
              : ret;
            const inRange = pickup && rangeEnd
              ? isAfter(d as Date, pickup) && isBefore(d as Date, rangeEnd)
              : false;

            return (
              <div key={(d as Date).toISOString()}
                onClick={() => !isPast && handleDayClick(d as Date)}
                onMouseEnter={() => selecting === "return" && pickup && setHoverDate(d as Date)}
                onMouseLeave={() => setHoverDate(null)}
                className={[
                  "flex items-center justify-center h-9 text-[0.8rem] font-semibold cursor-pointer transition-all select-none rounded-lg",
                  isPast ? "text-[#2a2620] cursor-not-allowed" :
                    isPickup || isReturn ? "bg-[#f4a830] text-[#0f0d09] font-black shadow-[0_0_10px_rgba(244,168,48,0.35)]" :
                      inRange ? "bg-[rgba(244,168,48,0.12)] text-[#f4a830] rounded-none" :
                        "text-[#b8b0a0] hover:bg-[#211e18] hover:text-[#f4a830]"
                ].join(" ")}
              >
                {format(d as Date, "d")}
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick select */}
      <div className="px-3 pb-3 pt-1 border-t border-[rgba(244,168,48,0.1)] flex items-center gap-2 flex-wrap">
        <span className="text-[0.62rem] font-bold uppercase tracking-widest text-[#3a342c]">Quick:</span>
        {[1, 2, 3, 5, 7, 14].map(n => (
          <button key={n} onClick={() => {
            const base = pickup || today;
            onRangeChange(format(base, "yyyy-MM-dd"), format(addDays(base, n), "yyyy-MM-dd"));
            setSelecting("pickup");
          }}
            className="px-2.5 py-1 rounded-full text-[0.68rem] font-bold border border-[rgba(244,168,48,0.2)] text-[#8a826e] hover:border-[#f4a830] hover:text-[#f4a830] transition-all">
            {n}d
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Time picker (with availability awareness + toast) ────────────────────────
function TimePicker({ label, productId, date, selected, onSelect, onAvailabilityLoaded }: {
  label: string; productId: string; date: string;
  selected: string | null;
  onSelect: (t: string, remaining: number) => void;
  onAvailabilityLoaded?: (hasAny: boolean, totalSlots: number, availableSlots: number) => void;
}) {
  const [slots, setSlots] = useState<{ time: string; available: boolean; remaining: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const prevDate = useRef<string>("");

  useEffect(() => {
    if (!date || !productId) return;
    if (date === prevDate.current) return;
    prevDate.current = date;
    setLoading(true);
    fetchSlots(productId, date).then(data => {
      setSlots(data);
      setLoading(false);
      if (onAvailabilityLoaded && data.length > 0) {
        const avail = data.filter((s: any) => s.available).length;
        onAvailabilityLoaded(avail > 0, data.length, avail);
      }
    });
  }, [date, productId, onAvailabilityLoaded]);

  const displaySlots = slots.length > 0 ? slots :
    ["06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
      "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"]
      .map(t => ({ time: t, available: true, remaining: 99 }));

  // Legend summary
  const hasRealSlots = slots.length > 0;
  const availCount = hasRealSlots ? slots.filter(s => s.available).length : null;
  const totalCount = hasRealSlots ? slots.length : null;
  const allUnavail = hasRealSlots && availCount === 0;

  if (loading) return (
    <div>
      <div className="text-[0.68rem] font-bold uppercase tracking-widest text-[#8a826e] mb-2 flex items-center gap-2">
        <Clock size={10} className="text-[#f4a830]" />{label}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {[...Array(8)].map((_, i) => <div key={i} className="h-9 rounded-lg bg-[rgba(244,168,48,0.06)] animate-pulse" />)}
      </div>
    </div>
  );

  return (
    <div>
      <div className="text-[0.68rem] font-bold uppercase tracking-widest text-[#8a826e] mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2"><Clock size={10} className="text-[#f4a830]" />{label}</span>
        {hasRealSlots && (
          <span className={`text-[0.62rem] font-bold px-2 py-0.5 rounded-full ${allUnavail ? "bg-[rgba(224,85,85,0.12)] text-[#e05555] border border-[rgba(224,85,85,0.25)]" :
            availCount! <= 2 ? "bg-[rgba(244,168,48,0.12)] text-[#f4a830] border border-[rgba(244,168,48,0.25)]" :
              "bg-[rgba(76,175,125,0.12)] text-[#4caf7d] border border-[rgba(76,175,125,0.25)]"
            }`}>
            {allUnavail ? "Fully booked" : `${availCount} of ${totalCount} open`}
          </span>
        )}
      </div>

      {allUnavail ? (
        <div className="flex items-center gap-2 py-4 px-3 rounded-lg bg-[rgba(224,85,85,0.06)] border border-[rgba(224,85,85,0.15)]">
          <XCircle size={15} className="text-[#e05555] shrink-0" />
          <p className="text-[0.78rem] text-[#e05555]">No slots available for this date. Please choose a different day.</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-1.5 max-h-[132px] overflow-y-auto">
          {displaySlots.map(slot => {
            const isSel = selected === slot.time;
            const isUnavail = !slot.available;
            const isLow = slot.available && slot.remaining <= 3 && slot.remaining < 99;
            return (
              <div key={slot.time} className="relative">
                <button disabled={isUnavail} onClick={() => slot.available && onSelect(slot.time, slot.remaining)}
                  title={isUnavail ? "Not available" : isLow ? `Only ${slot.remaining} left` : undefined}
                  className={[
                    "h-9 w-full rounded-lg text-[0.73rem] font-semibold border transition-all",
                    isSel ? "bg-[#f4a830] text-[#0f0d09] border-[#f4a830] font-black shadow-[0_0_8px_rgba(244,168,48,0.3)]" :
                      isUnavail ? "bg-[rgba(224,85,85,0.06)] border-[rgba(224,85,85,0.15)] text-[#2a2620] cursor-not-allowed line-through decoration-[rgba(224,85,85,0.4)]" :
                        isLow ? "bg-[rgba(244,168,48,0.08)] border-[rgba(244,168,48,0.35)] text-[#f4a830] hover:border-[#f4a830]" :
                          "bg-[#211e18] border-[rgba(244,168,48,0.18)] text-[#b8b0a0] hover:border-[#f4a830] hover:text-[#f4a830]"
                  ].join(" ")}>
                  {slot.time}
                </button>
                {isLow && !isSel && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#f4a830] rounded-full border border-[#0f0d09]" title={`Only ${slot.remaining} left`} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      {hasRealSlots && !allUnavail && (
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <span className="flex items-center gap-1 text-[0.6rem] text-[#3a342c]">
            <span className="w-2.5 h-2.5 rounded bg-[#211e18] border border-[rgba(244,168,48,0.18)]" />Available
          </span>
          <span className="flex items-center gap-1 text-[0.6rem] text-[#3a342c]">
            <span className="w-2.5 h-2.5 rounded bg-[rgba(244,168,48,0.08)] border border-[rgba(244,168,48,0.35)]" />Low availability
          </span>
          <span className="flex items-center gap-1 text-[0.6rem] text-[#3a342c]">
            <span className="w-2.5 h-2.5 rounded bg-[rgba(224,85,85,0.06)] border border-[rgba(224,85,85,0.15)]" />Booked
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Feature icon helper ──────────────────────────────────────────────────────
const FEAT_ICONS: [string, React.ReactNode][] = [
  ["a/c", <Wind size={13} />], ["air conditioning", <Wind size={13} />],
  ["wifi", <Wifi size={13} />], ["wi-fi", <Wifi size={13} />],
  ["gps", <Zap size={13} />], ["navigation", <Zap size={13} />],
  ["child", <Baby size={13} />], ["baby", <Baby size={13} />],
  ["insurance", <Shield size={13} />], ["fuel", <Fuel size={13} />],
];
function featIcon(feat: string) {
  const k = feat.toLowerCase();
  for (const [match, icon] of FEAT_ICONS) if (k.includes(match)) return icon;
  return <span className="text-[0.68rem] font-bold">✓</span>;
}

// ─── Section heading ──────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-serif text-[1.12rem] font-bold mb-5 flex items-center gap-3
      after:content-[''] after:flex-1 after:h-px after:bg-[rgba(244,168,48,0.14)]">
      {children}
    </h2>
  );
}

function SummaryRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex justify-between items-start">
      <span className="text-[#4a4438] text-[0.82rem]">{label}</span>
      <div className="text-right">
        <div className="font-semibold text-[0.84rem]">{value}</div>
        {sub && <div className="text-[0.7rem] text-[#f4a830]">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function VehicleDetail() {
  const cms = useCmsText("faq");
  const { id } = useParams<{ id: string }>();
  const { addToCart } = useCart();
  const { updateDraft } = useBookingDraft();
  const { currency } = useCurrency();
  const { toast } = useToast();

  const [pickupDate, setPickupDate] = useState<string>("");
  const [returnDate, setReturnDate] = useState<string>("");
  const [pickupTime, setPickupTime] = useState<string | null>(null);
  const [dropoffTime, setDropoffTime] = useState<string | null>(null);
  const [availabilityStatus, setAvailabilityStatus] = useState<"unknown" | "available" | "limited" | "unavailable">("unknown");
  const [cancellationModalOpen, setCancellationModalOpen] = useState(false);

  const hireDays = pickupDate && returnDate
    ? Math.max(1, differenceInCalendarDays(parseISO(returnDate), parseISO(pickupDate)))
    : 0;

  const { data: vehicle, isLoading, error } = useQuery({
    queryKey: ["vehicle", id],
    queryFn: () => fetchVehicle(id!),
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

  const averageRating = reviews.length > 0
    ? reviews.reduce((acc: number, r: any) => acc + r.rating, 0) / reviews.length : 0;
  const starsDisplay = Math.round(averageRating);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const urlPickup = sp.get("pickup") || sp.get("date") || "";
    const urlReturn = sp.get("return") || "";
    const urlDays = sp.get("days");
    const urlPickupTime = sp.get("pickupTime") || sp.get("time");
    const urlReturnTime = sp.get("returnTime");

    if (urlPickup) setPickupDate(urlPickup);
    if (urlReturn) setReturnDate(urlReturn);
    else if (urlPickup && urlDays)
      setReturnDate(format(addDays(parseISO(urlPickup), parseInt(urlDays) || 1), "yyyy-MM-dd"));

    if (urlPickupTime) setPickupTime(urlPickupTime);
    if (urlReturnTime) setDropoffTime(urlReturnTime);
    if (id) updateDraft({
      productId: id,
      adultPax: 1,
      childPax: 0,
      date: urlPickup,
      startTime: urlPickupTime || undefined,
      endTime: urlReturnTime || undefined
    });
  }, [id, updateDraft]);

  const handleRangeChange = useCallback((pickup: string, ret: string) => {
    setPickupDate(pickup);
    setReturnDate(ret);
    setPickupTime(null);
    setDropoffTime(null);
    setAvailabilityStatus("unknown");
  }, []);

  const handleAvailabilityLoaded = useCallback((hasAny: boolean, total: number, available: number) => {
    if (!hasAny) {
      setAvailabilityStatus("unavailable");
      toast({
        title: "No availability",
        description: "This vehicle is fully booked on the selected date. Please choose a different pickup date.",
        variant: "destructive",
      });
    } else if (available <= 2) {
      setAvailabilityStatus("limited");
      toast({
        title: `Only ${available} slot${available === 1 ? "" : "s"} left!`,
        description: "High demand — select your time soon to secure this vehicle.",
      });
    } else {
      setAvailabilityStatus("available");
      toast({
        title: "Vehicle available",
        description: `${available} of ${total} time slots open on this date.`,
      });
    }
  }, [toast]);

  // Use groupPriceCents as the day rate for group/flat-rate vehicles, adultPriceCents for per-person
  const isGroupPricing = vehicle?.pricingType === "group";
  const dayRateCents = vehicle ? (isGroupPricing ? (vehicle.groupPriceCents || vehicle.adultPriceCents) : vehicle.adultPriceCents) : 0;
  const totalPriceCents = dayRateCents * Math.max(1, hireDays);
  const [addonSelections, setAddonSelections] = useState<AddonSelections>({});
  const addonTotal = (vehicle as any)?.addons ? calcAddonTotal((vehicle as any).addons as ProductAddonEntry[], addonSelections) : 0;
  const grandTotal = totalPriceCents + addonTotal;
  const canBook = !!(pickupDate && returnDate && hireDays >= 1 && availabilityStatus !== "unavailable");

  const [, setLocation] = useLocation();

  const handleAddToCart = () => {
    if (!vehicle || !pickupDate || !returnDate) return;
    addToCart({
      id: vehicle.id, title: vehicle.title,
      // Pass per-day unit price — cart quantity (hireDays) handles the multiplication.
      // Previously passed totalPriceCents here which caused client-side fallback to double-count days.
      price: vehicle.adultPriceCents, childPrice: 0,
      image: vehicle.image, type: "vehicle",
      adultPax: 1, childPax: 0,
      infantPax: 0, petPax: 0,
      quantity: Math.max(1, hireDays),
      date: new Date(pickupDate),
      startTime: pickupTime || undefined,
      endTime: dropoffTime || undefined,
      pickupDate, returnDate, pickupTime, dropoffTime, hireDays,
    } as any);
    setLocation("/cart");
  };

  if (isLoading) return (
    <Layout><div className="flex items-center justify-center min-h-screen bg-[#0f0d09]">
      <div className="w-8 h-8 border-4 border-[#f4a830] border-t-transparent rounded-full animate-spin" />
    </div></Layout>
  );

  if (error || !vehicle) return (
    <Layout><div className="container mx-auto px-4 pt-40 pb-20 text-center bg-[#0f0d09] min-h-screen">
      <h1 className="text-4xl font-bold mb-4 text-[#f0ece4]">Vehicle Not Found</h1>
      <Button onClick={() => window.history.back()} className="bg-[#f4a830] text-[#0f0d09]">
        <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
      </Button>
    </div></Layout>
  );

  const vd = (vehicle.vehicleDetails as any) || {};
  const features: string[] = vd.features || [];

  const specs = [
    vd.make && { icon: "🏭", label: "Make", value: vd.make },
    vd.model && { icon: "🚐", label: "Model", value: vd.model },
    vd.seats && { icon: <Users size={15} />, label: "Capacity", value: `${vd.seats} passengers` },
    vd.transmission && { icon: <Settings size={15} />, label: "Transmission", value: vd.transmission },
    { icon: <Fuel size={15} />, label: "Fuel", value: "Included" },
    { icon: "🧭", label: "Coverage", value: "Efate Island" },
  ].filter(Boolean) as { icon: any; label: string; value: string }[];

  const vehicleFaqs = [];
  for (let i = 1; i <= 20; i++) {
    const defaultQ = i === 1 ? `What is included in hiring the ${vehicle.title}?` :
      i === 2 ? "Do I need an international driver's licence?" :
        i === 3 ? "What is the cancellation policy?" :
          i === 4 ? "Can I hire the vehicle with a driver?" : "";
    const defaultA = i === 1 ? `The ${vehicle.title} hire includes fuel, insurance, and GPS navigation for Efate Island. Driver is optional.` :
      i === 2 ? "Yes, an international driving permit is required for self-drive hire in Vanuatu." :
        i === 3 ? "Free cancellation up to 24 hours before your hire start time." :
          i === 4 ? "Yes, a professional local driver can be arranged for your convenience. Please ask us via WhatsApp." : "";

    const q = cms.text(`faq${i}_q`, defaultQ);
    const a = cms.text(`faq${i}_a`, defaultA);
    if (q && a) {
      vehicleFaqs.push({ question: q, answer: a.replace(/<[^>]+>/g, '') });
    }
  }

  const cutoffHours = vehicle.bookingCutoffHours ?? 24;

  return (
    <Layout>
      <SEO
        title={vehicle.seoTitle || `${vehicle.title} - Vehicle Hire`}
        description={vehicle.seoDescription || `Hire the ${vehicle.title} in Port Vila, Vanuatu. ${vd.seats ? `Seats up to ${vd.seats} passengers.` : ""} Self-drive or with driver. Book with Ace Tours & Transfers.`}
        image={vehicle.image}
        type="product"
        keywords={[...(vehicle.seoKeywords ? vehicle.seoKeywords.split(',').map((k: string) => k.trim()) : []), vehicle.title, "car hire Vanuatu", "vehicle hire Port Vila", "self drive Vanuatu", vd.make || "", vd.model || ""]}
        structuredType="Product"
        productName={vehicle.title}
        offer={vehicle.adultPriceCents ? { price: vehicle.adultPriceCents, currency: "VUV", availability: "InStock" } : undefined}
        aggregateRating={reviews.length > 0 ? { ratingValue: averageRating, reviewCount: reviews.length } : undefined}
        reviews={reviews.slice(0, 5).map((r: any) => ({ author: r.userName || "Guest", rating: r.rating, body: r.comment, datePublished: r.createdAt?.slice(0, 10) }))}
        faqs={vehicleFaqs}
      />

      <CancellationModal
        isOpen={cancellationModalOpen}
        onClose={() => setCancellationModalOpen(false)}
        policy={vehicle.cancellationPolicy || undefined}
      />

      <div className="min-h-screen bg-[#0f0d09] text-[#f0ece4] font-sans pt-28 md:pt-32">

        {/* Hero */}
        <div className="relative h-[340px] overflow-hidden bg-[#0f0d09]">
          <img src={cloudinaryOpt(vehicle.image, 1200)} className="w-full h-full object-cover brightness-[0.42] object-center" alt={vehicle.imageAlt || `${vehicle.title} - vehicle hire Vanuatu`} loading="eager" fetchPriority="high" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0f0d09]/20 to-[#0f0d09]" />
          <div className="absolute inset-0 opacity-[0.025]"
            style={{ backgroundImage: "linear-gradient(#f4a830 1px,transparent 1px),linear-gradient(90deg,#f4a830 1px,transparent 1px)", backgroundSize: "44px 44px" }} />
          <div className="absolute bottom-8 left-0 right-0 max-w-[1280px] mx-auto px-6 md:px-8">
            <div className="flex items-center gap-2 text-[0.72rem] text-[#3a342c] mb-3">
              <a href="/" className="hover:text-[#f4a830] transition-colors">Home</a>
              <ChevronRight size={9} /><a href="/vehicles" className="hover:text-[#f4a830] transition-colors">Vehicle Hire</a>
              <ChevronRight size={9} /><span className="text-[#4a4438]">{vehicle.title}</span>
            </div>
            <h1 className="font-serif text-[2.5rem] md:text-5xl font-bold leading-tight mb-3">{vehicle.title}</h1>
            <div className="flex flex-wrap gap-2">
              <span className={`px-3 py-1 rounded-full border text-[0.72rem] font-semibold ${availabilityStatus === "unavailable" ? "border-[#e05555]/40 bg-[#e05555]/10 text-[#e05555]" :
                availabilityStatus === "limited" ? "border-[#f4a830]/40 bg-[#f4a830]/10 text-[#f4a830]" :
                  availabilityStatus === "available" ? "border-[#4caf7d]/40 bg-[#4caf7d]/10 text-[#4caf7d]" :
                    "border-[#4caf7d]/40 bg-[#4caf7d]/10 text-[#4caf7d]"
                }`}>
                {availabilityStatus === "unavailable" ? "✗ Fully Booked" :
                  availabilityStatus === "limited" ? "⚡ Limited Availability" :
                    availabilityStatus === "available" ? "✓ Available" :
                      "✓ Check Dates Below"}
              </span>
              <span className="px-3 py-1 rounded-full border border-[#f4a830]/35 bg-[#f4a830]/8 text-[#f4a830] text-[0.72rem] font-semibold">
                {reviews.length > 0 ? `★ ${averageRating.toFixed(1)} · ${reviews.length} reviews` : "★ No reviews yet"}
              </span>
              {vd.seats && <span className="px-3 py-1 rounded-full border border-[rgba(244,168,48,0.18)] bg-[#1a1710]/80 text-[#8a826e] text-[0.72rem]">🚐 Up to {vd.seats} passengers</span>}
              {vd.transmission && <span className="px-3 py-1 rounded-full border border-[rgba(244,168,48,0.18)] bg-[#1a1710]/80 text-[#8a826e] text-[0.72rem]">⚙️ {vd.transmission}</span>}
            </div>
          </div>
        </div>

        {/* Main grid */}
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-10 grid grid-cols-1 lg:grid-cols-[1fr_440px] gap-8 items-start">

          {/* LEFT */}
          <div className="flex flex-col gap-7">

            <div className="rounded-[14px] overflow-hidden bg-[#211e18] aspect-[16/9]">
              <img src={cloudinaryOpt(vehicle.image, 900)} className="w-full h-full object-cover object-center" alt={vehicle.imageAlt || `${vehicle.title} - photo`} loading="lazy" />
            </div>

            {/* Specs */}
            <section className="bg-[#1a1710] border border-[rgba(244,168,48,0.18)] rounded-[14px] p-7">
              <SectionTitle>Vehicle Specs</SectionTitle>
              {specs.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {specs.map((s, i) => (
                    <div key={i} className="bg-[#211e18] border border-[rgba(244,168,48,0.1)] rounded-[10px] p-4 flex flex-col gap-1.5">
                      <div className="text-[#f4a830] opacity-60 text-base">{s.icon}</div>
                      <div className="text-[0.65rem] text-[#3a342c] font-bold uppercase tracking-[0.07em]">{s.label}</div>
                      <div className="text-[0.9rem] font-semibold text-[#f0ece4] leading-tight">{s.value}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[0.85rem] text-[#3a342c] italic">Specs not yet configured for this vehicle.</p>
              )}
            </section>

            {/* About */}
            <section className="bg-[#1a1710] border border-[rgba(244,168,48,0.18)] rounded-[14px] p-7">
              <SectionTitle>About This Vehicle</SectionTitle>
              <div className="space-y-3 text-[0.9rem] leading-[1.8] text-[#ccc6b8]">
                {vehicle.description.map((p: string, i: number) =>
                  p.startsWith('<') ? (
                    <div key={i} className="prose prose-invert prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-[#f4a830] [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-[#f4a830] [&_blockquote]:pl-3 [&_blockquote]:italic" dangerouslySetInnerHTML={{ __html: sanitizeHtml(p) }} />
                  ) : (
                    <p key={i}>{p}</p>
                  )
                )}
              </div>
            </section>

            {/* Features */}
            <section className="bg-[#1a1710] border border-[rgba(244,168,48,0.18)] rounded-[14px] p-7">
              <SectionTitle>What's Included</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(features.length > 0 ? features : [
                  "Professional licensed driver", "Air conditioning",
                  "Complimentary bottled water", "Free Wi-Fi on board",
                  "Child seats (on request)", "Fuel & all tolls included",
                ]).map((feat, i) => (
                  <div key={i} className="flex items-center gap-3 bg-[#211e18] border border-[rgba(244,168,48,0.1)] rounded-[8px] px-4 py-3">
                    <div className="w-7 h-7 rounded-lg bg-[#4caf7d]/10 border border-[#4caf7d]/22 flex items-center justify-center text-[#4caf7d] shrink-0">
                      {featIcon(feat)}
                    </div>
                    <span className="text-[0.84rem] text-[#b8b0a0]">{feat}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Hire terms */}
            <section className="bg-[#1a1710] border border-[rgba(244,168,48,0.18)] rounded-[14px] p-7">
              <SectionTitle>Hire Terms</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { icon: "📅", label: "Minimum hire", value: vehicle.duration || "1 day" },
                  { icon: "⛽", label: "Fuel policy", value: "Full-to-full" },
                  { icon: "🛡️", label: "Cancellation", value: `Free up to ${cutoffHours}hrs` },
                ].map((item, i) => (
                  <div key={i} className="bg-[#211e18] rounded-[10px] p-4 flex flex-col gap-1">
                    <div className="text-lg mb-1">{item.icon}</div>
                    <div className="text-[0.65rem] text-[#3a342c] font-bold uppercase tracking-[0.07em]">{item.label}</div>
                    <div className="text-[#f0ece4] font-semibold text-[0.88rem]">{item.value}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Cancellation Policy + Questions — side by side */}
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <CancellationCard
                cutoffHours={cutoffHours}
                onShowFullPolicy={() => setCancellationModalOpen(true)}
              />
              <ContactCard
                productTitle={vehicle.title}
                productCode={vehicle.productCode || undefined}
                supportEmail={vehicle.supportEmail || undefined}
                supportPhone={vehicle.supportPhone || undefined}
              />
            </section>

            {/* Reviews */}
            <section className="bg-[#1a1710] border border-[rgba(244,168,48,0.18)] rounded-[14px] p-7">
              <SectionTitle>Guest Reviews</SectionTitle>
              <div className="flex items-center gap-6 pb-5 mb-5 border-b border-[rgba(244,168,48,0.1)]">
                <div className="font-serif text-5xl font-bold text-[#f4a830]">
                  {reviews.length > 0 ? averageRating.toFixed(1) : "–"}
                </div>
                <div className="flex-1">
                  <div className="text-[#f4a830] text-[1rem] tracking-[2px] mb-1">
                    {"★".repeat(starsDisplay)}{"☆".repeat(5 - starsDisplay)}
                  </div>
                  <div className="text-[0.78rem] text-[#3a342c]">
                    Based on {reviews.length} verified {reviews.length === 1 ? "booking" : "bookings"}
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {reviews.length > 0 ? reviews.slice(0, 3).map((r: any) => (
                  <div key={r.id} className="bg-[#211e18] rounded-[10px] p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-semibold text-[0.88rem]">{r.authorName || r.userName || "Guest"}</div>
                        <div className="text-[#f4a830] text-[0.72rem]">{"★".repeat(r.rating)}</div>
                      </div>
                      <div className="text-[0.7rem] text-[#3a342c]">{new Date(r.createdAt).toLocaleDateString()}</div>
                    </div>
                    <p className="text-[0.83rem] text-[#b8b0a0] leading-[1.65] italic">"{r.comment}"</p>
                  </div>
                )) : (
                  <p className="text-[0.85rem] text-[#3a342c] italic">No reviews yet — be the first to share your experience.</p>
                )}
              </div>

              {/* Review submission form */}
              <div className="mt-5 pt-5 border-t border-[rgba(244,168,48,0.1)]">
                <GuestReviewForm
                  productId={id!}
                  productTitle={vehicle.title}
                  reviewQueryKey={["product-reviews", id!]}
                />
              </div>
            </section>
          </div>

          {/* RIGHT — sticky booking panel */}
          <div className="sticky top-[82px] rounded-[14px] overflow-hidden border border-[rgba(244,168,48,0.2)]">

            {/* Price header */}
            <div className="bg-[#211e18] px-6 py-5 border-b border-[rgba(244,168,48,0.12)]">
              {vehicle.contactForPrice ? (
                <>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-serif text-[2rem] font-bold text-[#f4a830]">Contact for Price</span>
                  </div>
                  <div className="text-[0.72rem] text-[#3a342c]">
                    Enquire directly to receive a custom quote for this vehicle.
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-[0.72rem] text-[#3a342c]">{isGroupPricing ? "Package rate" : "From"}</span>
                    <span className="font-serif text-[2rem] font-bold text-[#f4a830]">{formatPriceDisplay(dayRateCents, currency)}</span>
                    <span className="text-[0.78rem] text-[#3a342c]">/ day</span>
                  </div>
                  <div className="text-[0.72rem] text-[#3a342c]">
                    {isGroupPricing ? `Flat rate${vehicle.groupMaxPax ? ` — up to ${vehicle.groupMaxPax} people` : ""}` : "Total price based on hire duration"}
                  </div>
                </>
              )}
            </div>

            <div className="bg-[#1a1710] p-5 flex flex-col gap-5">

              {/* Countdown + cancellation link */}
              <div className="flex flex-col gap-2">
                <BookingCountdownTimer cutoffHours={cutoffHours} serviceDate={pickupDate} serviceTime={pickupTime} />
                <button
                  onClick={() => setCancellationModalOpen(true)}
                  className="text-[0.75rem] text-[#8a826e] hover:text-[#f4a830] flex items-center gap-1.5 transition-colors self-start"
                >
                  <Shield className="w-3.5 h-3.5" />
                  Free cancellation · {cutoffHours}h before start
                </button>
              </div>

              {/* Range calendar */}
              {!vehicle.contactForPrice && (
                <div>
                  <div className="text-[0.65rem] font-bold uppercase tracking-widest text-[#8a826e] mb-2 flex items-center gap-2">
                    <Calendar size={9} className="text-[#f4a830]" /> Select Hire Period
                  </div>
                  <RangeCalendar
                    pickupDate={pickupDate || null}
                    returnDate={returnDate || null}
                    onRangeChange={handleRangeChange}
                  />
                </div>
              )}

              {/* Pickup time slot picker */}
              {pickupDate && !vehicle.contactForPrice && (
                <div className="border-t border-[rgba(244,168,48,0.1)] pt-4">
                  <TimePicker
                    label={`Pick-up time · ${format(parseISO(pickupDate), "EEE d MMM")}`}
                    productId={vehicle.id}
                    date={pickupDate}
                    selected={pickupTime}
                    onSelect={(t, remaining) => {
                      setPickupTime(t);
                      if (remaining <= 3 && remaining < 99) {
                        toast({ title: `⚡ Only ${remaining} spot${remaining === 1 ? "" : "s"} at ${t}`, description: "Book now before it fills up!" });
                      }
                    }}
                    onAvailabilityLoaded={handleAvailabilityLoaded}
                  />
                </div>
              )}

              {/* Drop-off time slot picker */}
              {returnDate && !vehicle.contactForPrice && (
                <div className="border-t border-[rgba(244,168,48,0.1)] pt-4">
                  <TimePicker
                    label={`Drop-off time · ${format(parseISO(returnDate), "EEE d MMM")}`}
                    productId={vehicle.id}
                    date={returnDate}
                    selected={dropoffTime}
                    onSelect={(t, _remaining) => setDropoffTime(t)}
                  />
                </div>
              )}

              {/* Summary card */}
              {hireDays > 0 && !vehicle.contactForPrice && (
                <div className="bg-[#211e18] border border-[rgba(244,168,48,0.2)] rounded-[12px] p-4">
                  <div className="text-[0.62rem] font-bold uppercase tracking-widest text-[#f4a830] mb-3">Hire Summary</div>
                  <div className="space-y-2">
                    <SummaryRow
                      label="Pick-up"
                      value={format(parseISO(pickupDate), "EEE, d MMM yyyy")}
                      sub={pickupTime ? `at ${pickupTime}` : "⏰ time not yet selected"}
                    />
                    {returnDate && (
                      <SummaryRow
                        label="Drop-off"
                        value={format(parseISO(returnDate), "EEE, d MMM yyyy")}
                        sub={dropoffTime ? `at ${dropoffTime}` : "⏰ time not yet selected"}
                      />
                    )}
                    <div className="flex justify-between pt-2 border-t border-[rgba(244,168,48,0.12)]">
                      <span className="text-[#3a342c] text-[0.82rem]">Duration</span>
                      <span className="font-black text-[#f4a830] text-[0.9rem]">{hireDays} {hireDays === 1 ? "day" : "days"}</span>
                    </div>
                    <div className="flex justify-between text-[0.83rem]">
                      <span className="text-[#3a342c]">{formatPriceDisplay(dayRateCents, currency)} × {hireDays}d</span>
                      <span className="font-semibold">{formatPriceDisplay(totalPriceCents, currency)}</span>
                    </div>
                    {addonTotal > 0 && (
                      <div className="flex justify-between text-[0.83rem]">
                        <span className="text-[#3a342c]">Add-ons</span>
                        <span className="font-semibold">+{formatPriceDisplay(addonTotal, currency)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t border-[rgba(244,168,48,0.12)] font-black text-[1rem]">
                      <span>Total</span>
                      <span className="text-[#f4a830]">{formatPriceDisplay(grandTotal, currency)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Availability status banner */}
              {availabilityStatus !== "unknown" && (
                <div className={`flex items-start gap-2.5 p-3 rounded-[10px] border text-[0.78rem] ${availabilityStatus === "unavailable" ? "bg-[rgba(224,85,85,0.07)] border-[rgba(224,85,85,0.2)] text-[#e05555]" :
                  availabilityStatus === "limited" ? "bg-[rgba(244,168,48,0.07)] border-[rgba(244,168,48,0.2)] text-[#f4a830]" :
                    "bg-[rgba(76,175,125,0.07)] border-[rgba(76,175,125,0.2)] text-[#4caf7d]"
                  }`}>
                  {availabilityStatus === "unavailable" ? <XCircle size={15} className="shrink-0 mt-0.5" /> :
                    availabilityStatus === "limited" ? <AlertTriangle size={15} className="shrink-0 mt-0.5" /> :
                      <CheckCircle2 size={15} className="shrink-0 mt-0.5" />}
                  <span>
                    {availabilityStatus === "unavailable" ? "This vehicle is fully booked on your selected pickup date. Choose a different day." :
                      availabilityStatus === "limited" ? "Very few slots remain for your pickup date. Select a time quickly to secure your booking." :
                        "Great news — this vehicle has good availability on your selected dates."}
                  </span>
                </div>
              )}

              {/* Add-ons */}
              {(vehicle as any).addons && (vehicle as any).addons.length > 0 && (
                <AddonsPanel
                  addons={(vehicle as any).addons as ProductAddonEntry[]}
                  selected={addonSelections}
                  onChange={setAddonSelections}
                  currency={currency}
                />
              )}

              {/* Review provider badge (Trustpilot or Google, controlled by admin review_provider setting) */}
              <ExternalReviewBadge />

              {/* CTA */}
              {vehicle.contactForPrice ? (
                <div className="space-y-4">
                  {vehicle.supportPhone && (
                    <a
                      href={`tel:${vehicle.supportPhone.replace(/\s/g, '')}`}
                      className="w-full flex justify-center items-center h-14 rounded-[10px] text-[0.95rem] font-black tracking-[0.02em] transition-all bg-[#4caf7d] hover:bg-[#5dbd8f] text-[#0f0d09]"
                    >
                      <Phone className="mr-2 h-5 w-5" />
                      Call {vehicle.supportPhone}
                    </a>
                  )}
                  {vehicle.supportEmail && (
                    <a
                      href={`mailto:${vehicle.supportEmail}`}
                      className="w-full flex justify-center items-center h-14 rounded-[10px] text-[0.95rem] font-black tracking-[0.02em] transition-all border border-[#f4a830]/30 hover:border-[#f4a830] text-[#f4a830]"
                    >
                      <Mail className="mr-2 h-5 w-5" />
                      Email Inquiry
                    </a>
                  )}
                  {!vehicle.supportPhone && !vehicle.supportEmail && (
                    <div className="text-center text-[#f4a830] text-sm p-4 border border-[#f4a830]/20 rounded-lg">
                      Please use the contact details provided in the description to inquire.
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Button
                    disabled={!canBook}
                    onClick={handleAddToCart}
                    className={[
                      "w-full h-14 rounded-[10px] text-[0.95rem] font-black tracking-[0.02em] transition-all",
                      canBook
                        ? "bg-[#f4a830] text-[#0f0d09] hover:bg-[#fdc96a] shadow-[0_8px_28px_rgba(244,168,48,0.35)]"
                        : "bg-[#211e18] text-[#2a2620] cursor-not-allowed border border-[rgba(244,168,48,0.1)] hover:bg-[#211e18]"
                    ].join(" ")}
                  >
                    <ShoppingCart className="mr-2 h-5 w-5" />
                    {availabilityStatus === "unavailable"
                      ? "Fully Booked — Choose Different Dates"
                      : canBook
                        ? "Add to Cart"
                        : "Select pickup & return dates"
                    }
                  </Button>

                  {canBook && !(pickupTime && dropoffTime) && (
                    <p className="text-[0.7rem] text-[#4a4438] text-center -mt-3">
                      Select pick-up and drop-off times above to complete your booking
                    </p>
                  )}
                </>
              )}

              {/* WhatsApp */}
              <a
                href={`https://wa.me/6787114045?text=${encodeURIComponent(
                  `Hi! I'd like to hire the "${vehicle.title}"` +
                  (pickupDate ? ` from ${format(parseISO(pickupDate), "d MMM yyyy")}${pickupTime ? ` at ${pickupTime}` : ""}` : "") +
                  (returnDate ? ` to ${format(parseISO(returnDate), "d MMM yyyy")}${dropoffTime ? ` at ${dropoffTime}` : ""}` : "") + "."
                )}`}
                target="_blank" rel="noopener noreferrer"
                className="w-full py-3 text-[#25D366] border border-[#25D366]/30 rounded-[10px] text-[0.875rem] hover:border-[#25D366] hover:bg-[#25D366]/8 transition-all flex items-center justify-center gap-2 font-medium"
              >
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
        </div>
      </div>
    </Layout>
  );
}
