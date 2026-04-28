/**
 * shared-detail-components.tsx
 *
 * Reusable UI components extracted from tour-detail.tsx so that
 * Transfers and Tours share the same widgets.
 */

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Shield, X, XCircle, Clock, Phone, Mail, MessageSquare, ExternalLink,
  CheckCircle2, Star,
} from "lucide-react";

import DOMPurify from "dompurify";

const WHATSAPP_NUMBER = "6787114045";

// ─── HTML passthrough (implemented with DOMPurify) ──────────────────────────
export function sanitizeHtml(html: string): string {
  // Use DOMPurify for server-side or client-side sanitization
  // It handles typical XSS vectors while preserving safe TipTap/HTML tags
  return DOMPurify.sanitize(html);
}

// ─── Booking Countdown Timer ────────────────────────────────────────────────

interface CountdownProps {
  cutoffHours?: number;
  /** The service/booking date in YYYY-MM-DD format */
  serviceDate?: string;
  /** Optional service start time in HH:MM format */
  serviceTime?: string | null;
}

export function BookingCountdownTimer({
  cutoffHours = 24,
  serviceDate,
  serviceTime,
}: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    expired: boolean;
  } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!serviceDate) {
      setTimeLeft(null);
      return;
    }

    const compute = () => {
      const dateStr = serviceTime
        ? `${serviceDate}T${serviceTime}:00`
        : `${serviceDate}T08:30:00`;
      const start = new Date(dateStr);
      const cutoff = new Date(start.getTime() - cutoffHours * 60 * 60 * 1000);
      const now = new Date();
      const diff = cutoff.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, expired: true });
      } else {
        setTimeLeft({
          hours: Math.floor(diff / (1000 * 60 * 60)),
          minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((diff % (1000 * 60)) / 1000),
          expired: false,
        });
      }
    };

    compute();
    intervalRef.current = setInterval(compute, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [serviceDate, serviceTime, cutoffHours]);

  if (!timeLeft || !serviceDate) return null;

  if (timeLeft.expired) {
    return (
      <div className="flex items-center gap-2 bg-red-500/15 border border-red-500/30 rounded-[10px] px-4 py-3 text-sm">
        <XCircle className="w-4 h-4 text-red-400 shrink-0" />
        <span className="text-red-400 font-medium">
          Booking window has closed for this date.
        </span>
      </div>
    );
  }

  const isUrgent = timeLeft.hours < 2;
  const color = isUrgent
    ? "text-red-400 border-red-500/30 bg-red-500/10"
    : "text-[#f4a830] border-[rgba(244,168,48,0.3)] bg-[rgba(244,168,48,0.08)]";

  return (
    <div className={`flex items-center gap-3 ${color} border rounded-[10px] px-4 py-3`}>
      <div className="flex items-center gap-1.5">
        <div
          className={`w-2 h-2 rounded-full ${isUrgent ? "bg-red-400 animate-pulse" : "bg-[#f4a830] animate-pulse"
            }`}
        />
        <span className="text-[0.78rem] font-semibold uppercase tracking-wider">
          Booking closes in
        </span>
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

// ─── Cancellation Policy Modal ──────────────────────────────────────────────

interface CancellationModalProps {
  isOpen: boolean;
  onClose: () => void;
  policy?: string;
}

export function CancellationModal({ isOpen, onClose, policy }: CancellationModalProps) {
  if (!isOpen) return null;

  const defaultPolicy = `
    <h3>Free Cancellation</h3>
    <p>You can cancel up to <strong>24 hours in advance</strong> of the experience for a full refund.</p>
    <h3>Late Cancellation</h3>
    <p>Cancellations made within 24 hours of the scheduled departure time are non-refundable.</p>
    <h3>No-show Policy</h3>
    <p>Guests who do not show up without prior cancellation will be charged the full booking amount.</p>
    <h3>Operator Cancellations</h3>
    <p>If the operator cancels the experience for any reason, you will receive a full refund.</p>
    <h3>How to Cancel</h3>
    <p>To cancel or modify your booking, please contact us via WhatsApp or email as soon as possible.</p>
  `;

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative bg-[#1a1710] border border-[rgba(244,168,48,0.25)] rounded-[18px] max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[#1a1710] border-b border-[rgba(244,168,48,0.15)] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#f4a830]" />
            <h3 className="font-serif text-lg font-bold">Cancellation Policy</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[#2d2920] flex items-center justify-center text-[#8a826e] hover:text-[#f0ece4] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div
          className="px-6 py-5 text-[0.9rem] leading-[1.75] text-[#ccc6b8] prose prose-invert prose-sm max-w-none [&_h3]:text-[#f0ece4] [&_h3]:font-semibold [&_h3]:text-base [&_h3]:mt-4 [&_h3]:mb-1 [&_strong]:text-[#f4a830]"
          dangerouslySetInnerHTML={{
            __html: sanitizeHtml(policy || defaultPolicy),
          }}
        />
      </div>
    </div>
  );
}

// ─── Section Heading ────────────────────────────────────────────────────────

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-serif text-[1.2rem] font-bold mb-5 flex items-center gap-3 after:content-[''] after:flex-1 after:h-[1px] after:bg-[rgba(244,168,48,0.18)]">
      {children}
    </div>
  );
}

// ─── Contact / Questions Card ───────────────────────────────────────────────

interface ContactCardProps {
  productTitle: string;
  productCode?: string;
  supportEmail?: string;
  supportPhone?: string;
}

export function ContactCard({
  productTitle,
  productCode,
  supportEmail,
  supportPhone,
}: ContactCardProps) {
  return (
    <div className="bg-[#1a1710] border border-[rgba(244,168,48,0.18)] rounded-[14px] p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-[#f4a830]" />
        <span className="font-semibold text-[1rem]">Questions?</span>
      </div>
      <p className="text-[0.87rem] text-[#8a826e] leading-[1.6]">
        {productCode
          ? `Product code: ${productCode}`
          : "Contact us for any queries about this service."}
      </p>
      <div className="flex flex-col gap-2 mt-auto">
        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
            `Hi! I have a question about "${productTitle}". `
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-[#25D366] text-[0.82rem] hover:underline"
        >
          <svg
            viewBox="0 0 24 24"
            className="w-4 h-4 fill-current shrink-0"
          >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          WhatsApp
        </a>
        {supportEmail && (
          <a
            href={`mailto:${supportEmail}`}
            className="flex items-center gap-2 text-[#f4a830] text-[0.82rem] hover:underline"
          >
            <Mail className="w-3.5 h-3.5" />
            {supportEmail}
          </a>
        )}
        {supportPhone && (
          <a
            href={`tel:${supportPhone}`}
            className="flex items-center gap-2 text-[#ccc6b8] text-[0.82rem] hover:underline"
          >
            <Phone className="w-3.5 h-3.5" />
            {supportPhone}
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Cancellation Policy Card (inline, for grid) ────────────────────────────

interface CancellationCardProps {
  cutoffHours: number;
  onShowFullPolicy: () => void;
}

export function CancellationCard({
  cutoffHours,
  onShowFullPolicy,
}: CancellationCardProps) {
  return (
    <div className="bg-[#1a1710] border border-[rgba(244,168,48,0.18)] rounded-[14px] p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Shield className="w-5 h-5 text-[#f4a830]" />
        <span className="font-semibold text-[1rem]">Cancellation Policy</span>
      </div>
      <p className="text-[0.87rem] text-[#8a826e] leading-[1.6] flex-1">
        You can cancel up to{" "}
        <strong className="text-[#f0ece4]">{cutoffHours} hours</strong> in
        advance of the experience for a full refund.
      </p>
      <button
        onClick={onShowFullPolicy}
        className="text-[#f4a830] text-[0.82rem] font-medium hover:underline flex items-center gap-1 self-start"
      >
        Show full policy →
      </button>
    </div>
  );
}

// ─── What's Included Section ────────────────────────────────────────────────

interface WhatsIncludedProps {
  includedItems: string[];
  excludedItems: string[];
  /** Legacy fallback: description[1+] items from the old format */
  descriptionFallback?: string[];
}

// ─── Trustpilot TrustBox Widget ─────────────────────────────────────────────
// Single source of truth for all detail pages (tour / transfer).
// Business Unit ID  → VITE_TRUSTPILOT_BU_ID  (build-time env var)
// Review page URL   → VITE_TRUSTPILOT_URL     (optional, defaults to acetours.vu)
// Set in .env (local) or Render Dashboard → Environment (production), then redeploy.

const TP_BU_ID = import.meta.env.VITE_TRUSTPILOT_BU_ID as string | undefined;
const TP_URL = (import.meta.env.VITE_TRUSTPILOT_URL as string | undefined)
  ?? "https://www.trustpilot.com/review/acetours.vu";

export function TrustpilotWidget() {
  const ref = useRef<HTMLDivElement>(null);

  // The bootstrap script may have already fired before React rendered this div,
  // so we call loadFromElement() on mount to activate the widget in SPA context.
  useEffect(() => {
    if (ref.current && typeof (window as any).Trustpilot !== "undefined") {
      (window as any).Trustpilot.loadFromElement(ref.current, true);
    }
  }, []);

  if (!TP_BU_ID) {
    return (
      <a
        href={TP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 p-3 bg-[#00b67a]/10 border border-[#00b67a]/25 rounded-[10px] hover:bg-[#00b67a]/15 transition-colors"
      >
        <div className="flex items-center gap-1">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-5 h-5 bg-[#00b67a] rounded flex items-center justify-center">
              <Star className="w-3 h-3 text-white fill-white" />
            </div>
          ))}
        </div>
        <div>
          <div className="text-[0.78rem] font-semibold text-[#00b67a]">Trustpilot</div>
          <div className="text-[0.68rem] text-[#6a8c78]">Rated Excellent · See all reviews</div>
        </div>
        <div className="ml-auto text-[#00b67a] text-[0.72rem]">Verify →</div>
      </a>
    );
  }

  return (
    <div
      ref={ref}
      className="trustpilot-widget"
      data-locale="en-US"
      data-template-id="5419b637fa0340045cd0c936"
      data-businessunit-id={TP_BU_ID}
      data-style-height="24px"
      data-style-width="100%"
      data-theme="dark"
    >
      <a href={TP_URL} target="_blank" rel="noopener noreferrer">Trustpilot</a>
    </div>
  );
}

// ─── External Review Badge (above CTA) ──────────────────────────────────────
// Reads the `review_provider` site setting ("trustpilot" | "google" | "none").
// When "trustpilot" → renders the TrustpilotWidget above the booking CTA.
// When "google"     → renders a compact Google rating badge fetched from /api/google-reviews.
// When "none"       → renders nothing.
// Falls back to TrustpilotWidget if the setting fetch fails.

type GoogleReviewsPayload = {
  configured: boolean;
  rating?: number;
  totalReviews?: number;
  placeUrl?: string;
  reviews?: Array<{
    author: string;
    rating: number;
    text: string;
    time: number;
    relativeTime: string;
    profilePhoto: string | null;
  }>;
};

function useReviewProvider() {
  const { data: settings } = useQuery<any[]>({
    queryKey: ["/api/settings"],
    queryFn: () => apiRequest("GET", "/api/settings").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });
  const setting = settings?.find((s: any) => s.key === "review_provider");
  return (setting?.value as string | undefined) ?? "trustpilot";
}

function useGoogleReviews() {
  return useQuery<GoogleReviewsPayload>({
    queryKey: ["/api/google-reviews"],
    queryFn: () => fetch("/api/google-reviews").then(r => r.json()),
    staleTime: 60 * 60 * 1000, // mirror server-side 1-hour cache
  });
}

export function ExternalReviewBadge() {
  const provider = useReviewProvider();
  const { data: google } = useGoogleReviews();

  if (provider === "trustpilot") {
    return <TrustpilotWidget />;
  }

  if (provider === "google") {
    if (!google || !google.configured || !google.rating) {
      // Not configured yet — show static placeholder
      return (
        <a
          href="https://www.google.com/maps"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-3 bg-[#4285f4]/10 border border-[#4285f4]/25 rounded-[10px] hover:bg-[#4285f4]/15 transition-colors"
        >
          {/* Google G logo */}
          <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          <div>
            <div className="text-[0.78rem] font-semibold text-[#f0ece4]">Google Reviews</div>
            <div className="text-[0.68rem] text-[#8a826e]">See all reviews</div>
          </div>
          <div className="ml-auto text-[#4285f4] text-[0.72rem]">View →</div>
        </a>
      );
    }

    const stars = Math.round(google.rating);
    return (
      <a
        href={google.placeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 p-3 bg-[#1a1f2e] border border-[#4285f4]/25 rounded-[10px] hover:bg-[#1e2435] transition-colors"
      >
        <svg viewBox="0 0 24 24" className="w-6 h-6 shrink-0">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`w-3 h-3 ${i < stars ? "text-[#fbbc05] fill-[#fbbc05]" : "text-[#3a3830]"}`}
              />
            ))}
            <span className="text-[0.82rem] font-bold text-[#f0ece4] ml-1">{google.rating.toFixed(1)}</span>
          </div>
          <div className="text-[0.68rem] text-[#8a826e]">{google.totalReviews?.toLocaleString()} reviews on Google</div>
        </div>
        <div className="ml-auto text-[#4285f4] text-[0.72rem]">View →</div>
      </a>
    );
  }

  return null; // provider === "none"
}

// ─── Google Reviews Section (below internal reviews) ─────────────────────────
// Shows only when review_provider === "google" AND credentials are configured.
// Renders up to 5 individual Google review cards with required attribution.

export function GoogleReviewsSection() {
  const provider = useReviewProvider();
  const { data: google, isLoading } = useGoogleReviews();

  if (provider !== "google") return null;
  if (isLoading) return (
    <div className="mt-8 animate-pulse space-y-3">
      {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-[12px] bg-[#1a1710]" />)}
    </div>
  );
  if (!google?.configured || !google.reviews?.length) return null;

  return (
    <div className="mt-8">
      {/* Divider + heading */}
      <div className="flex items-center gap-3 mb-5">
        <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        <span className="font-serif text-[1.1rem] font-bold">Google Reviews</span>
        <div className="flex-1 h-[1px] bg-[rgba(244,168,48,0.18)]" />
      </div>

      <div className="space-y-3">
        {google.reviews.map((review, i) => (
          <div key={i} className="bg-[#1a1710] border border-[rgba(244,168,48,0.12)] rounded-[12px] p-4">
            <div className="flex items-start gap-3">
              {/* Avatar */}
              {review.profilePhoto ? (
                <img
                  src={review.profilePhoto}
                  alt={review.author}
                  className="w-9 h-9 rounded-full shrink-0 object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[#4285f4]/20 flex items-center justify-center shrink-0">
                  <span className="text-[#4285f4] font-bold text-sm">
                    {review.author.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-semibold text-[0.9rem] text-[#f0ece4]">{review.author}</span>
                  <span className="text-[0.72rem] text-[#6a6055]">{review.relativeTime}</span>
                </div>
                <div className="flex items-center gap-0.5 mt-0.5 mb-2">
                  {[...Array(5)].map((_, s) => (
                    <Star
                      key={s}
                      className={`w-3 h-3 ${s < review.rating ? "text-[#fbbc05] fill-[#fbbc05]" : "text-[#3a3830]"}`}
                    />
                  ))}
                </div>
                {review.text && (
                  <p className="text-[0.85rem] text-[#b8b0a0] leading-[1.65] line-clamp-4">{review.text}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Required Google attribution + link to see all */}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-[0.7rem] text-[#6a6055]">Powered by Google</span>
        <a
          href={google.placeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[0.75rem] text-[#4285f4] hover:underline flex items-center gap-1"
        >
          See all {google.totalReviews?.toLocaleString()} reviews on Google →
        </a>
      </div>
    </div>
  );
}


export function WhatsIncludedSection({
  includedItems,
  excludedItems,
  descriptionFallback = [],
}: WhatsIncludedProps) {
  const hasContent =
    includedItems.length > 0 ||
    excludedItems.length > 0 ||
    descriptionFallback.length > 0;

  if (!hasContent) return null;

  return (
    <section className="bg-[#1a1710] border border-[rgba(244,168,48,0.18)] rounded-[14px] p-6 md:p-7">
      <SectionHeading>What's Included</SectionHeading>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Structured included items */}
        {includedItems.length > 0
          ? includedItems.map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-3 text-[0.88rem] text-[#ccc6b8]"
            >
              <CheckCircle2 className="w-[18px] h-[18px] text-[#4caf7d] shrink-0 mt-0.5" />
              <span>{item}</span>
            </div>
          ))
          : /* Fallback: old description elements */
          descriptionFallback.map((item, i) =>
            item.startsWith("<") ? (
              <div
                key={i}
                className="col-span-2 text-[0.88rem] text-[#8a826e] prose prose-invert prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_li]:text-[#8a826e] [&_p]:my-1"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(item) }}
              />
            ) : (
              <div
                key={i}
                className="flex items-start gap-3 text-[0.88rem] text-[#ccc6b8]"
              >
                <CheckCircle2 className="w-[18px] h-[18px] text-[#4caf7d] shrink-0 mt-0.5" />
                <span>{item}</span>
              </div>
            )
          )}
        {/* Excluded items */}
        {excludedItems.map((item, i) => (
          <div
            key={`ex-${i}`}
            className="flex items-start gap-3 text-[0.88rem] text-[#8a826e]"
          >
            <XCircle className="w-[18px] h-[18px] text-[#6a6055] shrink-0 mt-0.5" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
