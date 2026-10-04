import { MessageCircle, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useCMS, useContentBlock } from "@/lib/cms-context";
import { useTranslation } from "react-i18next";
import { WhatsAppGlyph } from "@/components/brand-icons";

const DISMISS_KEY = "whatsapp-widget-dismissed";

/** `docked`: rendered inside FloatingDock, which owns the fixed positioning. */
export function WhatsAppWidget({ docked = false }: { docked?: boolean } = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const { getSetting } = useCMS();
  const { enabled } = useContentBlock("whatsapp-widget");
  const { t } = useTranslation();

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") {
        setIsDismissed(true);
      }
    } catch { /* sessionStorage unavailable */ }
  }, []);

  const whatsappSettingsRaw = getSetting("whatsapp");
  const legacyPhoneNumber = getSetting("whatsapp_number");

  // Normalize settings - handle both structured object and legacy missing data
  const whatsappSettings = (typeof whatsappSettingsRaw === 'object' && whatsappSettingsRaw !== null)
    ? whatsappSettingsRaw
    : {};

  // Master enable check: block feature flag + setting-specific toggle
  const isWidgetEnabled = enabled && (whatsappSettings.enabled !== false);

  if (!isWidgetEnabled || isDismissed) {
    return null;
  }

  // Fallback chain for phone number: structured object -> legacy flat key -> empty string
  const phoneNumber = (
    whatsappSettings.phoneNumber ||
    (typeof legacyPhoneNumber === 'string' ? legacyPhoneNumber : '')
  )?.replace(/[^0-9+]/g, '') || '';

  const greeting = whatsappSettings.greeting || t("whatsapp.defaultGreeting");
  const position = whatsappSettings.position || "bottom-right";

  // Mobile-aware positioning: push widget above the 64px bottom nav on mobile
  const positionClasses = {
    "bottom-right": "bottom-20 right-4 md:bottom-6 md:right-6",
    "bottom-left": "bottom-20 left-4 md:bottom-6 md:left-6"
  };

  // Fix #26: Warn in console if an unrecognised CMS position value is set,
  // so admins catch misconfiguration without silent fallback confusion.
  if (position && !(position in positionClasses)) {
    console.warn(
      `[WhatsAppWidget] Unknown position value "${position}" from CMS settings. ` +
      `Expected one of: ${Object.keys(positionClasses).join(", ")}. Falling back to "bottom-right".`
    );
  }

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDismissed(true);
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
  };

  const handleOpenChat = () => {
    const encodedMessage = encodeURIComponent(greeting);
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
    window.open(whatsappUrl, "_blank");
    setIsOpen(false);
  };

  return (
    <div
      className={docked
        ? "contents" // its bubble and button become items of the dock, which handles alignment
        : `fixed z-40 ${positionClasses[position as keyof typeof positionClasses] || positionClasses["bottom-right"]}`}
      data-testid="whatsapp-widget"
    >
      {/* CSS animations instead of framer-motion: this widget is on every page,
          and importing framer-motion here put ~110 KB into the main bundle. */}
      {isOpen && (
          <div
            className="mb-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-4 w-72 animate-in fade-in-0 zoom-in-90 slide-in-from-bottom-5 duration-200"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">Ace Tours</p>
                  <p className="text-xs text-muted-foreground">{t("whatsapp.typicallyReplies")}</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label={t("whatsapp.close")}
                data-testid="button-close-whatsapp"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 mb-3">
              <p className="text-sm text-foreground">{greeting}</p>
            </div>
            <button
              onClick={handleOpenChat}
              className="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              data-testid="button-start-whatsapp-chat"
            >
              <MessageCircle className="w-4 h-4" />
              {t("whatsapp.startChat")}
            </button>
          </div>
      )}

      {/* WhatsApp FAB with dismiss badge */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-14 h-14 bg-green-500 hover:bg-green-600 rounded-full shadow-lg flex items-center justify-center transition-[transform,background-color] hover:scale-110 active:scale-95"
          aria-label={t("whatsapp.openChat")}
          data-testid="button-whatsapp-toggle"
        >
          {isOpen ? (
            <X className="w-6 h-6 text-white" />
          ) : (
            <WhatsAppGlyph className="w-7 h-7 text-white" />
          )}
        </button>
        {/* Dismiss button — small X badge on the FAB */}
        {!isOpen && (
          <button
            onClick={handleDismiss}
            className="absolute -top-1 -right-1 w-6 h-6 bg-gray-700/80 hover:bg-gray-900 rounded-full flex items-center justify-center shadow-md transition-colors"
            aria-label={t("whatsapp.dismiss", "Dismiss WhatsApp widget")}
            data-testid="button-dismiss-whatsapp"
          >
            <X className="w-3.5 h-3.5 text-white" />
          </button>
        )}
      </div>
    </div>
  );
}
