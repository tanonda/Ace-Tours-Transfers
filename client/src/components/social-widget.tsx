import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Facebook, Instagram, Mail, Phone, Share2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCMS } from "@/lib/cms-context";
import { cn } from "@/lib/utils";
import { buildSocialLinks, type SocialLinkId } from "@/lib/social-links";
import { WhatsAppGlyph } from "@/components/brand-icons";
import { WhatsAppWidget } from "@/components/whatsapp-widget";

const DISMISS_KEY = "social-widget-dismissed";

// Brand colours stay the same in light and dark themes so each icon is recognisable.
const LOOK: Record<SocialLinkId, { icon: ReactNode; className: string; label: [string, string] }> = {
  whatsapp: { icon: <WhatsAppGlyph className="h-5 w-5" />, className: "bg-[#25D366]", label: ["social.whatsapp", "WhatsApp"] },
  facebook: { icon: <Facebook className="h-5 w-5" />, className: "bg-[#1877F2]", label: ["social.facebook", "Facebook"] },
  instagram: {
    icon: <Instagram className="h-5 w-5" />,
    className: "bg-[radial-gradient(circle_at_30%_110%,#fdf497_0%,#fd5949_45%,#d6249f_60%,#285AEB_90%)]",
    label: ["social.instagram", "Instagram"],
  },
  phone: { icon: <Phone className="h-5 w-5" />, className: "bg-harbour", label: ["social.call", "Call us"] },
  email: { icon: <Mail className="h-5 w-5" />, className: "bg-primary", label: ["social.email", "Email us"] },
};

/**
 * Floating "follow & contact" button: the accounts connected in Admin → Settings
 * fan out above it. Closes with the button, Escape or a click elsewhere; the small
 * × badge hides it for the visit, like the WhatsApp button.
 */
/** `side`: which screen edge the dock sits on; icons line up along that edge. */
export function SocialWidget({ side = "right" }: { side?: "left" | "right" }) {
  const { t } = useTranslation();
  const { getSetting } = useCMS();
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const links = useMemo(() => buildSocialLinks(getSetting), [getSetting]);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") setIsDismissed(true);
    } catch { /* sessionStorage unavailable */ }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setIsOpen(false);
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [isOpen]);

  if (isDismissed || links.length === 0) return null;

  const dismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDismissed(true);
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
  };

  return (
    <div ref={rootRef} className={cn("flex flex-col", side === "left" ? "items-start" : "items-end")} data-testid="social-widget">
      {isOpen && (
        <ul id="social-widget-menu" className={cn("mb-3 flex flex-col gap-2.5", side === "left" ? "items-start" : "items-end")} aria-label={t("social.menu", "Ace Tours on social media")}>
          {links.map((link, i) => {
            const look = LOOK[link.id];
            return (
              <li
                key={link.id}
                className="animate-in fade-in-0 slide-in-from-bottom-3 zoom-in-90 fill-mode-both duration-200"
                // Bottom item first, fanning upward.
                style={{ animationDelay: `${(links.length - 1 - i) * 40}ms` }}
              >
                <a
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  onClick={() => setIsOpen(false)}
                  className={cn("group flex items-center gap-3", side === "left" && "flex-row-reverse")}
                  data-testid={`social-link-${link.id}`}
                >
                  <span className="rounded-full bg-paper px-3 py-1 text-sm font-semibold text-navy shadow-md ring-1 ring-border">
                    {t(...look.label)}
                  </span>
                  <span className={cn("grid size-11 place-items-center rounded-full text-white shadow-lg ring-2 ring-white/80 transition-transform group-hover:scale-110", look.className)}>
                    {look.icon}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((o) => !o)}
          aria-expanded={isOpen}
          aria-controls="social-widget-menu"
          aria-label={isOpen ? t("social.close", "Close social media links") : t("social.open", "Follow or contact Ace Tours")}
          className="grid size-14 place-items-center rounded-full bg-primary text-white shadow-lg ring-2 ring-white/70 transition-[transform,background-color] hover:scale-110 hover:bg-primary/90 active:scale-95"
          data-testid="button-social-toggle"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Share2 className="h-6 w-6" />}
        </button>
        {!isOpen && (
          <button
            type="button"
            onClick={dismiss}
            className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full bg-gray-700/80 shadow-md transition-colors hover:bg-gray-900"
            aria-label={t("social.dismiss", "Hide social media button")}
            data-testid="button-dismiss-social"
          >
            <X className="h-3.5 w-3.5 text-white" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * The floating buttons share one fixed stack (social above WhatsApp), on the side
 * set in Admin → Settings → WhatsApp. If one is hidden the other closes the gap.
 * Rendered outside any isolated stacking context so it floats over every section.
 */
export function FloatingDock() {
  const { getSetting } = useCMS();
  const wa = getSetting("whatsapp");
  const left = !!wa && typeof wa === "object" && (wa as { position?: string }).position === "bottom-left";
  return (
    <div
      className={cn(
        "fixed z-[45] flex flex-col gap-3 bottom-20 md:bottom-6",
        left ? "left-4 items-start md:left-6" : "right-4 items-end md:right-6",
      )}
    >
      <SocialWidget side={left ? "left" : "right"} />
      <WhatsAppWidget docked />
    </div>
  );
}
