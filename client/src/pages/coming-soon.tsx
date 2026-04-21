import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

const DEFAULTS = {
  launch_date: "2026-05-01",
  cs_tagline: "Port Vila · Vanuatu",
  cs_headline: "Ace Tours &",
  cs_headline2: "Transfers",
  cs_description:
    "Something extraordinary is on the horizon. We're putting the finishing touches on your next great Vanuatu adventure.",
  cs_show_countdown: "true",
  cs_show_signup: "true",
  cs_signup_placeholder: "Your email address",
  cs_signup_button: "Notify Me",
  cs_signup_success: "We'll let you know when we launch",
  cs_contact_email: "acetoursvanuatu@outlook.com",
  cs_contact_phone: "+678 7114045",
  cs_bg_images: "[]",
  cs_bg_interval: "5000",
  cs_bg_overlay: "0.55",
  cs_show_reviews: "true",
  cs_reviews_count: "3",
};

type DK = keyof typeof DEFAULTS;

function useCountdown(target: Date) {
  const calc = () => {
    const diff = target.getTime() - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    return {
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
    };
  };
  const [time, setTime] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setTime(calc()), 1000);
    return () => clearInterval(id);
  }, [target.getTime()]);
  return time;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div style={{ display: "flex", gap: 2, marginBottom: 8 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} width="14" height="14" viewBox="0 0 24 24" fill={s <= rating ? "#f59e0b" : "rgba(255,255,255,0.2)"}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

export default function ComingSoon() {
  const { data: settings = [] } = useQuery<{ key: string; value: string }[]>({
    queryKey: ["settings"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      } catch (e) {
        return [];
      }
    },
    staleTime: 60_000,
  });

  const { data: approvedReviews = [] } = useQuery<any[]>({
    queryKey: ["approved-reviews"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/reviews/approved");
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      } catch (e) {
        return [];
      }
    },
    staleTime: 300_000,
  });

  const get = (key: DK): string => {
    const found = settings.find((s) => s.key === key)?.value;
    if (!found) return DEFAULTS[key];
    return typeof found === "string" ? found : JSON.stringify(found);
  };

  const bgImages: string[] = (() => { try { return JSON.parse(get("cs_bg_images") || "[]"); } catch { return []; } })();
  const bgInterval = parseInt(get("cs_bg_interval")) || 5000;
  const overlayOpacity = parseFloat(get("cs_bg_overlay")) || 0.55;
  const showCountdown = get("cs_show_countdown") === "true";
  const showSignup = get("cs_show_signup") === "true";
  const showReviews = get("cs_show_reviews") === "true";
  const reviewsCount = parseInt(get("cs_reviews_count")) || 3;
  const displayReviews = approvedReviews.slice(0, reviewsCount);

  const launchDate = new Date(`${get("launch_date")}T00:00:00`);
  const { days, hours, minutes, seconds } = useCountdown(launchDate);

  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [bgSlide, setBgSlide] = useState(0);

  useEffect(() => {
    if (!bgImages.length) return;
    const id = setInterval(() => setBgSlide((p) => (p + 1) % bgImages.length), bgInterval);
    return () => clearInterval(id);
  }, [bgImages.length, bgInterval]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    try {
      await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {}
    setSubmitted(true);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#001a2e",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "flex-start",
      fontFamily: "'Georgia', 'Times New Roman', serif",
      position: "relative",
      overflow: "hidden",
    }}>

      {/* ── Background slideshow ── */}
      {bgImages.length > 0 && (
        <div style={{ position: "fixed", inset: 0, zIndex: 0 }}>
          {bgImages.map((url, idx) => (
            <div
              key={idx}
              style={{
                position: "absolute",
                inset: 0,
                opacity: idx === bgSlide ? 1 : 0,
                transition: "opacity 1.8s ease",
              }}
            >
              <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          ))}
          {/* Dark overlay */}
          <div style={{
            position: "absolute",
            inset: 0,
            background: `rgba(0,26,46,${overlayOpacity})`,
          }} />
          {/* Gradient fade bottom */}
          <div style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to bottom, transparent 40%, rgba(0,26,46,0.8) 100%)",
          }} />
        </div>
      )}

      {/* ── Ambient glow (when no bg images) ── */}
      {bgImages.length === 0 && (
        <div style={{
          position: "fixed",
          inset: 0,
          opacity: 0.06,
          backgroundImage: "radial-gradient(circle at 25% 35%, #00a8e0 0%, transparent 60%), radial-gradient(circle at 75% 70%, #0077b6 0%, transparent 55%)",
          pointerEvents: "none",
          zIndex: 0,
        }} />
      )}

      {/* ── Main content ── */}
      <div style={{
        position: "relative",
        zIndex: 1,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "48px 24px 40px",
      }}>

        <div style={{ width: "100%", maxWidth: 560, borderTop: "1px solid rgba(255,255,255,0.15)", marginBottom: 40 }} />

        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <p style={{ color: "#5bb8d4", fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: "Arial, sans-serif", fontWeight: 600, margin: "0 0 16px" }}>
            {get("cs_tagline")}
          </p>
          <h1 style={{ color: "#ffffff", fontSize: "clamp(32px, 7vw, 58px)", fontWeight: 400, letterSpacing: "-0.5px", lineHeight: 1.1, margin: "0 0 6px", textShadow: "0 2px 20px rgba(0,0,0,0.4)" }}>
            {get("cs_headline")}
          </h1>
          <h1 style={{ color: "#5bb8d4", fontSize: "clamp(32px, 7vw, 58px)", fontWeight: 400, letterSpacing: "-0.5px", lineHeight: 1.1, margin: "0 0 32px", textShadow: "0 2px 20px rgba(0,0,0,0.4)" }}>
            {get("cs_headline2")}
          </h1>
        </div>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32, width: "100%", maxWidth: 400 }}>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.15)" }} />
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.6 }}>
            <path d="M12 2L13.09 8.26L19 7L15.45 12L19 17L13.09 15.74L12 22L10.91 15.74L5 17L8.55 12L5 7L10.91 8.26L12 2Z" fill="#5bb8d4"/>
          </svg>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.15)" }} />
        </div>

        {/* Description */}
        <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "clamp(14px, 2.5vw, 17px)", textAlign: "center", maxWidth: 420, lineHeight: 1.75, fontStyle: "italic", margin: "0 0 48px", fontFamily: "'Georgia', serif", textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}>
          {get("cs_description")}
        </p>

        {/* Countdown */}
        {showCountdown && (
          <div style={{ display: "flex", gap: "clamp(16px, 4vw, 40px)", marginBottom: 48, alignItems: "flex-start" }}>
            {[
              { value: days, label: "Days" },
              { value: hours, label: "Hours" },
              { value: minutes, label: "Minutes" },
              { value: seconds, label: "Seconds" },
            ].map(({ value, label }, i) => (
              <div key={label} style={{ textAlign: "center", position: "relative" }}>
                {i > 0 && (
                  <span style={{ position: "absolute", left: "clamp(-12px, -2.5vw, -24px)", top: "50%", transform: "translateY(-70%)", color: "rgba(255,255,255,0.25)", fontSize: "clamp(20px, 4vw, 36px)", fontFamily: "Arial, sans-serif" }}>:</span>
                )}
                <div style={{ background: "rgba(255,255,255,0.06)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "clamp(12px, 2.5vw, 20px) clamp(14px, 3vw, 28px)", minWidth: "clamp(52px, 12vw, 84px)" }}>
                  <span style={{ display: "block", color: "#ffffff", fontSize: "clamp(28px, 6vw, 48px)", fontWeight: 300, fontFamily: "'Georgia', serif", lineHeight: 1, letterSpacing: "-1px" }}>
                    {String(value).padStart(2, "0")}
                  </span>
                </div>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: "Arial, sans-serif", margin: "8px 0 0" }}>{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Email signup */}
        {showSignup && (
          <div style={{ width: "100%", maxWidth: 420, marginBottom: 48 }}>
            {submitted ? (
              <div style={{ textAlign: "center", padding: "16px 24px", border: "1px solid rgba(91,184,212,0.35)", borderRadius: 8, background: "rgba(91,184,212,0.08)", backdropFilter: "blur(8px)" }}>
                <p style={{ color: "#5bb8d4", margin: 0, fontSize: 14, letterSpacing: "0.05em" }}>✓ &nbsp;{get("cs_signup_success")}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={get("cs_signup_placeholder")}
                  required
                  style={{ flex: 1, background: "rgba(255,255,255,0.07)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 6, padding: "12px 16px", color: "#ffffff", fontSize: 14, fontFamily: "Arial, sans-serif", outline: "none" }}
                />
                <button
                  type="submit"
                  style={{ background: "#5bb8d4", border: "none", borderRadius: 6, padding: "12px 20px", color: "#001a2e", fontSize: 13, fontWeight: 700, fontFamily: "Arial, sans-serif", letterSpacing: "0.05em", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  {get("cs_signup_button")}
                </button>
              </form>
            )}
            <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, textAlign: "center", margin: "10px 0 0", fontFamily: "Arial, sans-serif", letterSpacing: "0.05em" }}>
              Be the first to know when we go live
            </p>
          </div>
        )}

        {/* Reviews */}
        {showReviews && displayReviews.length > 0 && (
          <div style={{ width: "100%", maxWidth: 760, marginBottom: 48 }}>
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, letterSpacing: "0.25em", textTransform: "uppercase", fontFamily: "Arial, sans-serif", textAlign: "center", marginBottom: 20 }}>
              What our guests say
            </p>
            <div style={{
              display: "grid",
              gridTemplateColumns: `repeat(${Math.min(displayReviews.length, 3)}, 1fr)`,
              gap: 16,
            }}>
              {displayReviews.map((review: any) => (
                <div
                  key={review.id}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    backdropFilter: "blur(12px)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10,
                    padding: "20px 20px 18px",
                  }}
                >
                  <StarRating rating={review.rating} />
                  <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, lineHeight: 1.65, fontStyle: "italic", fontFamily: "'Georgia', serif", margin: "0 0 14px" }}>
                    "{review.comment}"
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(91,184,212,0.2)", border: "1px solid rgba(91,184,212,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ color: "#5bb8d4", fontSize: 12, fontFamily: "Arial, sans-serif", fontWeight: 600 }}>
                        {(review.authorName || "?")[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, margin: 0, fontFamily: "Arial, sans-serif", fontWeight: 600 }}>{review.authorName}</p>
                      {review.tourTitle && (
                        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, margin: 0, fontFamily: "Arial, sans-serif" }}>{review.tourTitle}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contact */}
        <div style={{ display: "flex", gap: 24, marginBottom: 36, flexWrap: "wrap", justifyContent: "center" }}>
          {[
            { icon: "✉", text: get("cs_contact_email"), href: `mailto:${get("cs_contact_email")}` },
            { icon: "✆", text: get("cs_contact_phone"), href: `tel:${get("cs_contact_phone")}` },
          ].map(({ icon, text, href }) => (
            <a key={href} href={href} style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontFamily: "Arial, sans-serif", letterSpacing: "0.05em", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "#5bb8d4", fontSize: 13 }}>{icon}</span>{text}
            </a>
          ))}
        </div>

        <div style={{ width: "100%", maxWidth: 560, borderTop: "1px solid rgba(255,255,255,0.08)" }} />
        <p style={{ color: "rgba(255,255,255,0.15)", fontSize: 10, fontFamily: "Arial, sans-serif", letterSpacing: "0.15em", textTransform: "uppercase", marginTop: 20 }}>
          © {new Date().getFullYear()} Ace Tours &amp; Transfers Vanuatu
        </p>
      </div>
    </div>
  );
}
