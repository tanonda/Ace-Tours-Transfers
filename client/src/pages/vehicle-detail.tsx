import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { fetchVehicle } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, ChevronLeft, ChevronRight, Calendar, Fuel, Users, Settings, Wind, Shield, Wifi, Baby, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useCart } from "@/lib/cart-context";
import { useBookingDraft } from "@/lib/booking-state-context";
import { formatPriceDisplay } from "@/lib/product.types";
import { useCurrency } from "@/lib/currency-context";
import {
  addDays, format, differenceInCalendarDays,
  startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isBefore, isAfter, isSameDay, parseISO, startOfDay
} from "date-fns";

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

  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

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
        {(["pickup","return"] as const).map(mode => (
          <div key={mode} onClick={() => setSelecting(mode)}
            className={`flex-1 py-2 text-center text-[0.65rem] font-bold uppercase tracking-widest cursor-pointer transition-colors ${
              selecting === mode ? "bg-[#f4a830]/10 text-[#f4a830] border-b-2 border-[#f4a830]" : "text-[#3a342c] hover:text-[#8a826e]"
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
          {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
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
        {[1,2,3,5,7,14].map(n => (
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

// ─── Time picker ──────────────────────────────────────────────────────────────
function TimePicker({ label, productId, date, selected, onSelect }: {
  label: string; productId: string; date: string;
  selected: string | null; onSelect: (t: string) => void;
}) {
  const [slots, setSlots] = useState<{time:string;available:boolean;remaining:number}[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!date || !productId) return;
    setLoading(true);
    fetchSlots(productId, date).then(data => { setSlots(data); setLoading(false); });
  }, [date, productId]);

  const displaySlots = slots.length > 0 ? slots :
    ["06:00","06:30","07:00","07:30","08:00","08:30","09:00","09:30","10:00","10:30",
     "11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"]
    .map(t => ({ time: t, available: true, remaining: 99 }));

  if (loading) return (
    <div>
      <div className="text-[0.68rem] font-bold uppercase tracking-widest text-[#8a826e] mb-2 flex items-center gap-2">
        <Clock size={10} className="text-[#f4a830]" />{label}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {[...Array(8)].map((_,i) => <div key={i} className="h-9 rounded-lg bg-[rgba(244,168,48,0.06)] animate-pulse" />)}
      </div>
    </div>
  );

  return (
    <div>
      <div className="text-[0.68rem] font-bold uppercase tracking-widest text-[#8a826e] mb-2 flex items-center gap-2">
        <Clock size={10} className="text-[#f4a830]" />{label}
      </div>
      <div className="grid grid-cols-4 gap-1.5 max-h-[132px] overflow-y-auto">
        {displaySlots.map(slot => {
          const isSel = selected === slot.time;
          const isUnavail = !slot.available;
          return (
            <button key={slot.time} disabled={isUnavail} onClick={() => slot.available && onSelect(slot.time)}
              className={[
                "h-9 rounded-lg text-[0.73rem] font-semibold border transition-all",
                isSel ? "bg-[#f4a830] text-[#0f0d09] border-[#f4a830] font-black shadow-[0_0_8px_rgba(244,168,48,0.3)]" :
                isUnavail ? "bg-[rgba(224,85,85,0.06)] border-[rgba(224,85,85,0.15)] text-[#3a342c] cursor-not-allowed" :
                "bg-[#211e18] border-[rgba(244,168,48,0.18)] text-[#b8b0a0] hover:border-[#f4a830] hover:text-[#f4a830]"
              ].join(" ")}>
              {slot.time}
            </button>
          );
        })}
      </div>
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
  const { id } = useParams<{ id: string }>();
  const { addToCart } = useCart();
  const { updateDraft } = useBookingDraft();
  const { currency } = useCurrency();

  const [pickupDate, setPickupDate] = useState<string>("");
  const [returnDate, setReturnDate] = useState<string>("");
  const [pickupTime, setPickupTime] = useState<string | null>(null);
  const [dropoffTime, setDropoffTime] = useState<string | null>(null);

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
      const res = await apiRequest("GET", `/api/tours/${id}/reviews`);
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
    if (urlPickup) setPickupDate(urlPickup);
    if (urlReturn) setReturnDate(urlReturn);
    else if (urlPickup && urlDays)
      setReturnDate(format(addDays(parseISO(urlPickup), parseInt(urlDays)||1), "yyyy-MM-dd"));
    if (id) updateDraft({ productId: id, adultPax: 1, childPax: 0, date: urlPickup });
  }, [id, updateDraft]);

  const handleRangeChange = useCallback((pickup: string, ret: string) => {
    setPickupDate(pickup);
    setReturnDate(ret);
    setPickupTime(null);
    setDropoffTime(null);
  }, []);

  const totalPriceCents = vehicle ? vehicle.adultPriceCents * Math.max(1, hireDays) : 0;
  const canBook = !!(pickupDate && returnDate && hireDays >= 1);

  const handleAddToCart = () => {
    if (!vehicle || !pickupDate || !returnDate) return;
    addToCart({
      id: vehicle.id, title: vehicle.title,
      price: totalPriceCents, childPrice: 0,
      image: vehicle.image, type: "vehicle",
      adultPax: 1, childPax: 0,
      quantity: Math.max(1, hireDays),
      date: new Date(pickupDate),
      startTime: pickupTime || undefined,
      pickupDate, returnDate, pickupTime, dropoffTime, hireDays,
    } as any);
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
    vd.make       && { icon: "🏭", label: "Make",         value: vd.make },
    vd.model      && { icon: "🚐", label: "Model",        value: vd.model },
    vd.seats      && { icon: <Users size={15}/>, label: "Capacity", value: `${vd.seats} passengers` },
    vd.transmission && { icon: <Settings size={15}/>, label: "Transmission", value: vd.transmission },
                     { icon: <Fuel size={15}/>,    label: "Fuel",          value: "Included" },
                     { icon: "🧭",                 label: "Coverage",      value: "Efate Island" },
  ].filter(Boolean) as {icon:any;label:string;value:string}[];

  return (
    <Layout>
      <div className="min-h-screen bg-[#0f0d09] text-[#f0ece4] font-sans pt-16">

        {/* Hero */}
        <div className="relative h-[340px] overflow-hidden">
          <img src={vehicle.image} className="w-full h-full object-cover brightness-[0.42] object-center" alt={vehicle.title} />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0f0d09]/20 to-[#0f0d09]" />
          <div className="absolute inset-0 opacity-[0.025]"
            style={{ backgroundImage:"linear-gradient(#f4a830 1px,transparent 1px),linear-gradient(90deg,#f4a830 1px,transparent 1px)", backgroundSize:"44px 44px" }} />
          <div className="absolute bottom-8 left-0 right-0 max-w-[1280px] mx-auto px-6 md:px-8">
            <div className="flex items-center gap-2 text-[0.72rem] text-[#3a342c] mb-3">
              <a href="/" className="hover:text-[#f4a830] transition-colors">Home</a>
              <ChevronRight size={9} /><a href="/vehicles" className="hover:text-[#f4a830] transition-colors">Vehicle Hire</a>
              <ChevronRight size={9} /><span className="text-[#4a4438]">{vehicle.title}</span>
            </div>
            <h1 className="font-serif text-[2.5rem] md:text-5xl font-bold leading-tight mb-3">{vehicle.title}</h1>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full border border-[#4caf7d]/40 bg-[#4caf7d]/10 text-[#4caf7d] text-[0.72rem] font-semibold">✓ Available Today</span>
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

            <div className="rounded-[14px] overflow-hidden aspect-[16/9]">
              <img src={vehicle.image} className="w-full h-full object-cover" alt={vehicle.title} />
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
                {vehicle.description.map((p: string, i: number) => <p key={i}>{p}</p>)}
              </div>
            </section>

            {/* Features */}
            <section className="bg-[#1a1710] border border-[rgba(244,168,48,0.18)] rounded-[14px] p-7">
              <SectionTitle>What's Included</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(features.length > 0 ? features : [
                  "Professional licensed driver","Air conditioning",
                  "Complimentary bottled water","Free Wi-Fi on board",
                  "Child seats (on request)","Fuel & all tolls included",
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
                  { icon:"📅", label:"Minimum hire",  value: vehicle.duration || "1 day" },
                  { icon:"⛽", label:"Fuel policy",    value:"Full-to-full" },
                  { icon:"🛡️", label:"Cancellation",  value:"Free up to 24hrs" },
                ].map((item, i) => (
                  <div key={i} className="bg-[#211e18] rounded-[10px] p-4 flex flex-col gap-1">
                    <div className="text-lg mb-1">{item.icon}</div>
                    <div className="text-[0.65rem] text-[#3a342c] font-bold uppercase tracking-[0.07em]">{item.label}</div>
                    <div className="text-[#f0ece4] font-semibold text-[0.88rem]">{item.value}</div>
                  </div>
                ))}
              </div>
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
            </section>
          </div>

          {/* RIGHT — sticky booking panel */}
          <div className="sticky top-[82px] rounded-[14px] overflow-hidden border border-[rgba(244,168,48,0.2)]">

            {/* Price header */}
            <div className="bg-[#211e18] px-6 py-5 border-b border-[rgba(244,168,48,0.12)]">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-[0.72rem] text-[#3a342c]">From</span>
                <span className="font-serif text-[2rem] font-bold text-[#f4a830]">{formatPriceDisplay(vehicle.adultPriceCents, currency)}</span>
                <span className="text-[0.78rem] text-[#3a342c]">/ day</span>
              </div>
              <div className="text-[0.72rem] text-[#3a342c]">Total price based on hire duration</div>
            </div>

            <div className="bg-[#1a1710] p-5 flex flex-col gap-5">

              {/* Range calendar */}
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

              {/* Pickup time slot picker */}
              {pickupDate && (
                <div className="border-t border-[rgba(244,168,48,0.1)] pt-4">
                  <TimePicker
                    label={`Pick-up time · ${format(parseISO(pickupDate), "EEE d MMM")}`}
                    productId={vehicle.id}
                    date={pickupDate}
                    selected={pickupTime}
                    onSelect={setPickupTime}
                  />
                </div>
              )}

              {/* Drop-off time slot picker */}
              {returnDate && (
                <div className="border-t border-[rgba(244,168,48,0.1)] pt-4">
                  <TimePicker
                    label={`Drop-off time · ${format(parseISO(returnDate), "EEE d MMM")}`}
                    productId={vehicle.id}
                    date={returnDate}
                    selected={dropoffTime}
                    onSelect={setDropoffTime}
                  />
                </div>
              )}

              {/* Summary card */}
              {hireDays > 0 && (
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
                      <span className="text-[#3a342c]">{formatPriceDisplay(vehicle.adultPriceCents, currency)} × {hireDays}d</span>
                      <span className="font-semibold">{formatPriceDisplay(totalPriceCents, currency)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-[rgba(244,168,48,0.12)] font-black text-[1rem]">
                      <span>Total</span>
                      <span className="text-[#f4a830]">{formatPriceDisplay(totalPriceCents, currency)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* CTA */}
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
                {canBook
                  ? `Hire for ${hireDays} ${hireDays === 1 ? "Day" : "Days"} — ${formatPriceDisplay(totalPriceCents, currency)}`
                  : "Select pickup & return dates"}
              </Button>

              {canBook && !(pickupTime && dropoffTime) && (
                <p className="text-[0.7rem] text-[#4a4438] text-center -mt-3">
                  Select pick-up and drop-off times above to complete your booking
                </p>
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

              <div className="flex gap-4 pt-2 border-t border-[rgba(244,168,48,0.1)] text-[0.7rem] text-[#3a342c]">
                <div className="flex-1 flex items-center gap-1.5">🛡️ Free cancellation</div>
                <div className="flex-1 flex items-center gap-1.5">🔒 Instant booking</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
