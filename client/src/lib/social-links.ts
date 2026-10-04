import { vanuatuPhone } from "./phone";

export type SocialLinkId = "whatsapp" | "facebook" | "instagram" | "phone" | "email";

export interface SocialLink {
  id: SocialLinkId;
  href: string;
  /** Opens in a new tab (web profiles); tel:/mailto: open the device app instead. */
  external: boolean;
}

type GetSetting = (key: string) => unknown;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function webUrl(value: unknown): string | null {
  const url = text(value);
  return /^https?:\/\//i.test(url) ? url : null;
}

/**
 * The accounts Ace Tours has connected in Admin → Settings (Social, WhatsApp,
 * Contact), as links for the floating social button. Anything not set is left out.
 */
export function buildSocialLinks(getSetting: GetSetting): SocialLink[] {
  const links: SocialLink[] = [];

  const wa = getSetting("whatsapp");
  const waObject = wa && typeof wa === "object" ? (wa as { enabled?: boolean; phoneNumber?: string; greeting?: string }) : {};
  const waNumber = (text(waObject.phoneNumber) || text(getSetting("whatsapp_number"))).replace(/\D/g, "");
  if (waObject.enabled !== false && waNumber) {
    const greeting = text(waObject.greeting);
    links.push({
      id: "whatsapp",
      href: `https://wa.me/${waNumber}${greeting ? `?text=${encodeURIComponent(greeting)}` : ""}`,
      external: true,
    });
  }

  const facebook = webUrl(getSetting("social_facebook"));
  if (facebook) links.push({ id: "facebook", href: facebook, external: true });

  const instagram = webUrl(getSetting("social_instagram"));
  if (instagram) links.push({ id: "instagram", href: instagram, external: true });

  const phone = vanuatuPhone(text(getSetting("contact_phone")));
  if (phone) links.push({ id: "phone", href: phone.tel, external: false });

  const email = text(getSetting("contact_email"));
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) links.push({ id: "email", href: `mailto:${email}`, external: false });

  return links;
}
