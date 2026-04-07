import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

const DEFAULT_LAUNCH_DATE = "2026-05-01";

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
  }, [target]);
  return time;
}

export default function ComingSoon() {
  const { data: settings = [] } = useQuery<{ key: string; value: string }[]>({
    queryKey: ["settings"],
    queryFn: () => fetch("/api/settings").then((r) => r.json()),
    staleTime: 60_000,
  });

  const launchDateStr =
    settings.find((s) => s.key === "launch_date")?.value || DEFAULT_LAUNCH_DATE;
  const launchDate = new Date(`${launchDateStr}T00:00:00`);

  const { days, hours, minutes, seconds } = useCountdown(launchDate);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

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
      justifyContent: "center",
      fontFamily: "'Georgia', 'Times New Roman', serif",
      padding: "24px",
      position: "relative",
      overflow: "hidden",
    }}>

      {/* Subtle background texture */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.04,
        backgroundImage: "radial-gradient(circle at 25% 35%, #00a8e0 0%, transparent 60%), radial-gradient(circle at 75% 70%, #0077b6 0%, transparent 55%)",
        pointerEvents: "none",
      }} />

      {/* Horizontal rule top */}
      <div style={{ width: "100%", maxWidth: 560, borderTop: "1px solid rgba(255,255,255,0.12)", marginBottom: 40 }} />

      {/* Logo / Brand */}
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <p style={{
          color: "#5bb8d4",
          fontSize: 11,
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          fontFamily: "'Arial', sans-serif",
          fontWeight: 600,
          margin: "0 0 16px",
        }}>
          Port Vila · Vanuatu
        </p>
        <h1 style={{
          color: "#ffffff",
          fontSize: "clamp(32px, 7vw, 58px)",
          fontWeight: 400,
          letterSpacing: "-0.5px",
          lineHeight: 1.1,
          margin: "0 0 8px",
        }}>
          Ace Tours &amp;
        </h1>
        <h1 style={{
          color: "#5bb8d4",
          fontSize: "clamp(32px, 7vw, 58px)",
          fontWeight: 400,
          letterSpacing: "-0.5px",
          lineHeight: 1.1,
          margin: "0 0 32px",
        }}>
          Transfers
        </h1>
      </div>

      {/* Divider with icon */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32, width: "100%", maxWidth: 400 }}>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.12)" }} />
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.5 }}>
          <path d="M12 2L13.09 8.26L19 7L15.45 12L19 17L13.09 15.74L12 22L10.91 15.74L5 17L8.55 12L5 7L10.91 8.26L12 2Z" fill="#5bb8d4"/>
        </svg>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.12)" }} />
      </div>

      {/* Tagline */}
      <p style={{
        color: "rgba(255,255,255,0.55)",
        fontSize: "clamp(14px, 2.5vw, 17px)",
        textAlign: "center",
        maxWidth: 420,
        lineHeight: 1.7,
        fontStyle: "italic",
        margin: "0 0 48px",
        fontFamily: "'Georgia', serif",
      }}>
        Something extraordinary is on the horizon. We're putting the finishing touches on your next great Vanuatu adventure.
      </p>

      {/* Countdown */}
      <div style={{
        display: "flex",
        gap: "clamp(16px, 4vw, 40px)",
        marginBottom: 48,
        alignItems: "flex-start",
      }}>
        {[
          { value: days,    label: "Days"    },
          { value: hours,   label: "Hours"   },
          { value: minutes, label: "Minutes" },
          { value: seconds, label: "Seconds" },
        ].map(({ value, label }, i) => (
          <div key={label} style={{ textAlign: "center", position: "relative" }}>
            {i > 0 && (
              <span style={{
                position: "absolute", left: "clamp(-12px, -2.5vw, -24px)", top: "50%",
                transform: "translateY(-70%)",
                color: "rgba(255,255,255,0.2)",
                fontSize: "clamp(20px, 4vw, 36px)",
                fontFamily: "'Arial', sans-serif",
              }}>:</span>
            )}
            <div style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: "clamp(12px, 2.5vw, 20px) clamp(14px, 3vw, 28px)",
              minWidth: "clamp(52px, 12vw, 84px)",
            }}>
              <span style={{
                display: "block",
                color: "#ffffff",
                fontSize: "clamp(28px, 6vw, 48px)",
                fontWeight: 300,
                fontFamily: "'Georgia', serif",
                lineHeight: 1,
                letterSpacing: "-1px",
              }}>
                {String(value).padStart(2, "0")}
              </span>
            </div>
            <p style={{
              color: "rgba(255,255,255,0.35)",
              fontSize: 10,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              fontFamily: "'Arial', sans-serif",
              margin: "8px 0 0",
            }}>
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Email signup */}
      <div style={{ width: "100%", maxWidth: 420, marginBottom: 48 }}>
        {submitted ? (
          <div style={{
            textAlign: "center",
            padding: "16px 24px",
            border: "1px solid rgba(91,184,212,0.3)",
            borderRadius: 8,
            background: "rgba(91,184,212,0.06)",
          }}>
            <p style={{ color: "#5bb8d4", margin: 0, fontSize: 14, letterSpacing: "0.05em" }}>
              ✓ &nbsp;We'll let you know when we launch
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Your email address"
              required
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 6,
                padding: "12px 16px",
                color: "#ffffff",
                fontSize: 14,
                fontFamily: "'Arial', sans-serif",
                outline: "none",
              }}
            />
            <button
              type="submit"
              style={{
                background: "#5bb8d4",
                border: "none",
                borderRadius: 6,
                padding: "12px 20px",
                color: "#001a2e",
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "'Arial', sans-serif",
                letterSpacing: "0.05em",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Notify Me
            </button>
          </form>
        )}
        <p style={{
          color: "rgba(255,255,255,0.2)",
          fontSize: 11,
          textAlign: "center",
          margin: "10px 0 0",
          fontFamily: "'Arial', sans-serif",
          letterSpacing: "0.05em",
        }}>
          Be the first to know when we go live
        </p>
      </div>

      {/* Contact line */}
      <div style={{
        display: "flex",
        gap: 24,
        marginBottom: 40,
        flexWrap: "wrap",
        justifyContent: "center",
      }}>
        {[
          { icon: "✉", text: "acetoursvanuatu@outlook.com", href: "mailto:acetoursvanuatu@outlook.com" },
          { icon: "✆", text: "+678 7114045", href: "tel:+6787114045" },
        ].map(({ icon, text, href }) => (
          <a key={href} href={href} style={{
            color: "rgba(255,255,255,0.35)",
            fontSize: 12,
            fontFamily: "'Arial', sans-serif",
            letterSpacing: "0.05em",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}>
            <span style={{ color: "#5bb8d4", fontSize: 13 }}>{icon}</span>
            {text}
          </a>
        ))}
      </div>

      {/* Bottom rule */}
      <div style={{ width: "100%", maxWidth: 560, borderTop: "1px solid rgba(255,255,255,0.08)" }} />
      <p style={{
        color: "rgba(255,255,255,0.15)",
        fontSize: 10,
        fontFamily: "'Arial', sans-serif",
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        marginTop: 20,
      }}>
        © {new Date().getFullYear()} Ace Tours &amp; Transfers Vanuatu
      </p>
    </div>
  );
}
