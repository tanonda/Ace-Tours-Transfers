import { MessageCircle, X } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCMS, useContentBlock } from "@/lib/cms-context";
import { useTranslation } from "react-i18next";

const DISMISS_KEY = "whatsapp-widget-dismissed";

export function WhatsAppWidget() {
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
      className={`fixed z-40 ${positionClasses[position as keyof typeof positionClasses] || positionClasses["bottom-right"]}`}
      data-testid="whatsapp-widget"
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="mb-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-4 w-72"
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* WhatsApp FAB with dismiss badge */}
      <div className="relative">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(!isOpen)}
          className="w-14 h-14 bg-green-500 hover:bg-green-600 rounded-full shadow-lg flex items-center justify-center transition-colors"
          aria-label={t("whatsapp.openChat")}
          data-testid="button-whatsapp-toggle"
        >
          {isOpen ? (
            <X className="w-6 h-6 text-white" />
          ) : (
            <svg viewBox="0 0 24 24" className="w-7 h-7 text-white fill-current">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
          )}
        </motion.button>
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
