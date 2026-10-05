import { describe, it, expect } from "vitest";
import { buildSocialLinks } from "./social-links";

const settings = (values: Record<string, unknown>) => (key: string) => values[key];

describe("buildSocialLinks", () => {
  it("lists every account connected in the admin settings, in a stable order", () => {
    const links = buildSocialLinks(settings({
      social_facebook: "https://www.facebook.com/acetoursvanuatu",
      social_instagram: "https://www.instagram.com/acetoursvanuatu/",
      whatsapp: { enabled: true, phoneNumber: "+678 7114045", greeting: "Hi there!" },
      contact_phone: "+678 7114045",
      contact_email: "acetoursvanuatu@outlook.com",
    }));
    expect(links.map((l) => l.id)).toEqual(["whatsapp", "facebook", "instagram", "phone", "email"]);
    expect(links.find((l) => l.id === "whatsapp")?.href).toBe("https://wa.me/6787114045?text=Hi%20there!");
    expect(links.find((l) => l.id === "phone")?.href).toBe("tel:+6787114045");
    expect(links.find((l) => l.id === "email")?.href).toBe("mailto:acetoursvanuatu@outlook.com");
  });

  it("leaves out accounts the admin has not set", () => {
    const links = buildSocialLinks(settings({ social_facebook: "https://facebook.com/x", social_instagram: "  " }));
    expect(links.map((l) => l.id)).toEqual(["facebook"]);
  });

  it("falls back to the legacy whatsapp_number setting", () => {
    const links = buildSocialLinks(settings({ whatsapp_number: "+678 711 4045" }));
    expect(links[0]).toMatchObject({ id: "whatsapp", href: "https://wa.me/6787114045" });
  });

  it("drops WhatsApp when the admin has switched it off", () => {
    const links = buildSocialLinks(settings({ whatsapp: { enabled: false, phoneNumber: "+6787114045" } }));
    expect(links).toEqual([]);
  });

  it("only accepts web links for social profiles", () => {
    const links = buildSocialLinks(settings({ social_facebook: "javascript:alert(1)" }));
    expect(links).toEqual([]);
  });
});
