
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { fetchVehicle } from "@/lib/api";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState, useEffect, useCallback } from "react";
import { useCart } from "@/lib/cart-context";
import { useBookingDraft } from "@/lib/booking-state-context";
import { formatPriceDisplay } from "@/lib/product.types";
import { useCurrency } from "@/lib/currency-context";
import { AvailabilityCalendar } from "@/components";

export default function VehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { addToCart } = useCart();
  const { updateDraft } = useBookingDraft();
  const { currency } = useCurrency();

  const [date, setDate] = useState<string>("");
  const [guests, setGuests] = useState<number>(2);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const { data: vehicle, isLoading, error } = useQuery({
    queryKey: ["vehicle", id],
    queryFn: () => fetchVehicle(id!),
    enabled: !!id,
  });

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const urlDate = searchParams.get("date");
    const urlGuests = searchParams.get("guests");

    if (urlDate) setDate(urlDate);
    if (urlGuests) setGuests(parseInt(urlGuests) || 2);

    if (id) {
      updateDraft({
        productId: id,
        adultPax: parseInt(urlGuests || "2") || 2,
        childPax: 0,
        date: urlDate || "",
      });
    }
  }, [id, updateDraft]);

  const handleDateSelect = useCallback((d: string) => {
    setDate(d);
    setSelectedTime(null);
  }, []);

  const handleTimeSelect = useCallback((t: string) => {
    setSelectedTime(t);
  }, []);

  const handleAddToCart = () => {
    if (!vehicle) return;
    addToCart({
      id: vehicle.id,
      title: vehicle.title,
      price: vehicle.adultPriceCents,
      childPrice: 0,
      image: vehicle.image,
      type: "vehicle",
      adultPax: guests,
      childPax: 0,
      quantity: 1, // Full day rental
      date: date ? new Date(date) : new Date(),
      startTime: selectedTime || undefined,
    });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen bg-[#0f0d09]">
          <div className="w-8 h-8 border-4 border-[#f4a830] border-t-transparent rounded-full animate-spin"></div>
        </div>
      </Layout>
    );
  }

  if (error || !vehicle) {
    return (
      <Layout>
        <div className="container mx-auto px-4 pt-40 pb-20 text-center bg-[#0f0d09] min-h-screen">
          <h1 className="text-4xl font-bold mb-4 text-[#f0ece4]">Error</h1>
          <p className="text-[#8a826e] mb-8">Vehicle not found</p>
          <Button onClick={() => window.history.back()} className="bg-[#f4a830] text-[#0f0d09]">
            <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
          </Button>
        </div>
      </Layout>
    );
  }

  const vehicleDetails = vehicle.vehicleDetails as any;

  return (
    <Layout>
      <div className="min-h-screen bg-[#0f0d09] text-[#f0ece4] font-sans pt-16">
        {/* Hero Section */}
        <div className="relative h-[320px] overflow-hidden">
          <img src={vehicle.image} className="w-full h-full object-cover filter brightness-[0.55] object-center" alt={vehicle.title} />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0f0d09]" />
          <div className="absolute bottom-8 left-0 right-0 max-w-[1280px] mx-auto px-8">
            <div className="flex items-center gap-2 text-[0.8rem] text-[#8a826e] mb-3">
              <a href="/" className="text-[#f4a830]">Home</a> <span>›</span>
              <a href="/vehicles" className="text-[#f4a830]">Vehicle Hire</a> <span>›</span>
              <span className="text-[#f0ece4] opacity-50">{vehicle.title}</span>
            </div>
            <h1 className="font-serif text-4xl md:text-5xl font-bold leading-tight mb-3">
              {vehicle.title}
            </h1>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full border border-[#4caf7d] bg-[#4caf7d]/15 text-[#4caf7d] text-[0.78rem] font-medium">✓ Available Today</span>
              <span className="px-3 py-1 rounded-full border border-[#f4a830] bg-[#f4a830]/15 text-[#f4a830] text-[0.78rem] font-medium">★ 4.9 — 127 Reviews</span>
              <span className="px-3 py-1 rounded-full border border-[rgba(244,168,48,0.18)] bg-[#1a1710] text-[#8a826e] text-[0.78rem] font-medium">🚐 Up to {vehicleDetails?.seats || 12} Guests</span>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="max-w-[1280px] mx-auto px-8 py-10 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8 items-start">

          {/* Left Column */}
          <div className="flex flex-col gap-7">

            {/* Photo */}
            <div className="rounded-[14px] overflow-hidden bg-[#211e18] flex items-center justify-center">
              <img src={vehicle.image} className="w-full h-auto max-h-[540px] object-contain block" alt={vehicle.title} />
            </div>

            {/* Specs */}
            <div className="bg-[#1a1710] border border-[rgba(244,168,48,0.18)] rounded-[14px] p-7">
              <div className="font-serif text-[1.2rem] font-bold mb-5 flex items-center gap-3 after:content-[''] after:flex-1 after:h-[1px] after:bg-[rgba(244,168,48,0.18)]">Vehicle Specs</div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { icon: '🚐', label: 'Type', value: vehicleDetails?.model || 'Minivan' },
                  { icon: '👥', label: 'Capacity', value: `${vehicleDetails?.seats || 12} Guests` },
                  { icon: '🧳', label: 'Luggage', value: '12 Bags' },
                  { icon: '❄️', label: 'A/C', value: 'Full Climate' },
                  { icon: '⛽', label: 'Fuel', value: 'Included' },
                  { icon: '🧭', label: 'Coverage', value: 'Efate Island' },
                ].map((spec, i) => (
                  <div key={i} className="bg-[#211e18] border border-[rgba(244,168,48,0.18)] rounded-[10px] p-4 flex flex-col gap-1">
                    <div className="text-[1.3rem]">{spec.icon}</div>
                    <div className="text-[0.72rem] text-[#8a826e] font-medium uppercase tracking-[0.05em]">{spec.label}</div>
                    <div className="text-[1rem] font-semibold text-[#f0ece4] whitespace-nowrap overflow-hidden text-ellipsis">{spec.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="bg-[#1a1710] border border-[rgba(244,168,48,0.18)] rounded-[14px] p-7">
              <div className="font-serif text-[1.2rem] font-bold mb-5 flex items-center gap-3 after:content-[''] after:flex-1 after:h-[1px] after:bg-[rgba(244,168,48,0.18)]">About This Service</div>
              <div className="text-[0.92rem] leading-[1.75] text-[#ccc6b8] space-y-3">
                <p>{vehicle.description[0]}</p>
                {vehicle.description.length > 1 && <p>{vehicle.description[1]}</p>}
              </div>
            </div>

            {/* Features */}
            <div className="bg-[#1a1710] border border-[rgba(244,168,48,0.18)] rounded-[14px] p-7">
              <div className="font-serif text-[1.2rem] font-bold mb-5 flex items-center gap-3 after:content-[''] after:flex-1 after:h-[1px] after:bg-[rgba(244,168,48,0.18)]">What's Included</div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  "Professional licensed driver", "Air conditioning",
                  "Complimentary bottled water", "Free Wi-Fi on board",
                  "Child seats (on request)", "Fuel & all tolls"
                ].map((feat, i) => (
                  <div key={i} className="flex items-center gap-3 text-[0.88rem] text-[#8a826e]">
                    <div className="w-[22px] h-[22px] rounded-full bg-[#4caf7d]/15 border border-[#4caf7d] flex items-center justify-center text-[0.65rem] text-[#4caf7d]">✓</div>
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Reviews */}
            <div className="bg-[#1a1710] border border-[rgba(244,168,48,0.18)] rounded-[14px] p-7">
              <div className="font-serif text-[1.2rem] font-bold mb-5 flex items-center gap-3 after:content-[''] after:flex-1 after:h-[1px] after:bg-[rgba(244,168,48,0.18)]">Guest Reviews</div>
              <div className="flex items-center gap-6 pb-5 mb-5 border-b border-[rgba(244,168,48,0.18)]">
                <div className="font-serif text-6xl font-bold text-[#f4a830]">4.9</div>
                <div className="flex-1">
                  <div className="text-[#f4a830] text-[1.1rem] tracking-[2px]">★★★★★</div>
                  <div className="text-[0.82rem] text-[#8a826e] mt-1">Based on 127 verified bookings</div>
                </div>
              </div>
              <div className="bg-[#211e18] rounded-[10px] p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-semibold text-[0.9rem]">Sarah M.</div>
                    <div className="text-[#f4a830] text-[0.8rem]">★★★★★</div>
                  </div>
                  <div className="text-[0.75rem] text-[#8a826e]">Feb 8, 2026</div>
                </div>
                <p className="text-[0.855rem] text-[#b8b0a0] leading-[1.6]">Absolutely seamless experience from start to finish. The driver was punctual, the van was spotless and cool.</p>
              </div>
            </div>

          </div>

          {/* Right Column: Sticky Booking Panel */}
          <div className="sticky top-[82px] bg-[#1a1710] border border-[rgba(244,168,48,0.18)] rounded-[14px] overflow-hidden">
            <div className="bg-[#211e18] p-[22px_24px] border-b border-[rgba(244,168,48,0.18)]">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-[0.78rem] text-[#8a826e]">From</span>
                <span className="font-serif text-[2rem] font-bold text-[#f4a830]">{formatPriceDisplay(vehicle.adultPriceCents, currency)}</span>
                <span className="text-[0.8rem] text-[#8a826e]">/ day</span>
              </div>
              <div className="text-[0.78rem] text-[#8a826e]">Price adjusts based on guest count & date</div>
            </div>

            <div className="p-[20px_24px]">
              {/* Guest Selector */}
              <label className="text-[0.75rem] font-semibold text-[#8a826e] tracking-[0.07em] uppercase mb-2 block">Number of Guests</label>
              <div className="flex items-center gap-3 bg-[#211e18] border border-[rgba(244,168,48,0.18)] rounded-[10px] p-[10px_16px] mb-5">
                <button onClick={() => setGuests(prev => Math.max(1, prev - 1))} className="w-[30px] h-[30px] rounded-full bg-[#1a1710] border border-[rgba(244,168,48,0.18)] text-[#f0ece4] text-[1.1rem] hover:border-[#f4a830] hover:bg-[#f4a830]/15 transition-all">−</button>
                <div className="flex-1 text-center">
                  <div className="text-[1rem] font-semibold">{guests}</div>
                  <div className="text-[0.8rem] text-[#8a826e]">guests</div>
                </div>
                <button onClick={() => setGuests(prev => Math.min(vehicleDetails?.seats || 12, prev + 1))} className="w-[30px] h-[30px] rounded-full bg-[#1a1710] border border-[rgba(244,168,48,0.18)] text-[#f0ece4] text-[1.1rem] hover:border-[#f4a830] hover:bg-[#f4a830]/15 transition-all">+</button>
              </div>

              {/* Calendar */}
              <label className="text-[0.75rem] font-semibold text-[#8a826e] tracking-[0.07em] uppercase mb-2 block">Select Your Date</label>
              <div className="mb-5">
                <AvailabilityCalendar
                  tourId={vehicle.id}
                  selectedDate={date}
                  participants={{ adults: guests, children: 0 }}
                  onDateSelect={handleDateSelect}
                  onTimeSelect={handleTimeSelect}
                />
              </div>

              {/* Selected Day Info */}
              {date && (
                <div className="bg-[#f4a830]/15 border border-[rgba(244,168,48,0.3)] rounded-[10px] p-[14px_16px] mb-4 animate-in fade-in slide-in-from-top-2">
                  <div className="text-[0.72rem] text-[#f4a830] font-semibold uppercase tracking-[0.06em] mb-1">Selected Date</div>
                  <div className="text-[0.95rem] font-semibold">{new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
                  {selectedTime && <div className="text-[0.8rem] text-[#f4a830] mt-1 font-medium">Time: {selectedTime}</div>}
                </div>
              )}

              {/* Pricing Breakdown Mockup */}
              {date && (
                <div className="border-t border-[rgba(244,168,48,0.18)] pt-4 mb-4">
                  <div className="flex justify-between text-[0.85rem] text-[#8a826e] mb-2">
                    <span>Base rate (1 day)</span>
                    <span>{formatPriceDisplay(vehicle.adultPriceCents, currency)}</span>
                  </div>
                  {guests > 6 && (
                    <div className="flex justify-between text-[0.85rem] text-[#8a826e] mb-2">
                      <span>Extra guests ({guests - 6} × €10)</span>
                      <span>{formatPriceDisplay((guests - 6) * 1000, currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-[0.95rem] border-t border-[rgba(244,168,48,0.18)] pt-2 mt-2">
                    <span>Total</span>
                    <span className="text-[#f4a830]">{formatPriceDisplay(vehicle.adultPriceCents + (Math.max(0, guests - 6) * 1000), currency)}</span>
                  </div>
                </div>
              )}

              <Button
                disabled={!date}
                className={`w-full h-14 rounded-[10px] text-[0.95rem] font-bold tracking-[0.02em] mb-3 ${date ? 'bg-[#f4a830] text-[#0f0d09] hover:bg-[#fdc96a] shadow-[0_6px_24px_rgba(244,168,48,0.4)]' : 'bg-[#211e18] text-[#4a4438] cursor-not-allowed border border-[rgba(244,168,48,0.18)] hover:bg-[#211e18]'}`}
                onClick={handleAddToCart}
              >
                {date ? `Hire for ${new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Select a Date to Continue'}
              </Button>

              <a
              href={`https://wa.me/6787114045?text=${encodeURIComponent(`Hi! I have a question about "${vehicle.title}". `)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full p-3 text-[#25D366] border border-[#25D366]/40 rounded-[10px] text-[0.875rem] hover:border-[#25D366] hover:bg-[#25D366]/10 transition-all flex items-center justify-center gap-2 font-medium"
            >
              💬 Ask a Question via WhatsApp
            </a>

              <div className="flex gap-4 mt-4 pt-4 border-t border-[rgba(244,168,48,0.18)] text-[0.73rem] text-[#8a826e]">
                <div className="flex flex-1 items-center gap-2">🛡️ Free cancellation</div>
                <div className="flex flex-1 items-center gap-2">🔒 Instant booking</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
