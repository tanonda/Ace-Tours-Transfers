import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { pricingRulesFromSettings, type PricingRules } from "@shared/pricing-rules";
import { vanuatuPhone } from "@/lib/phone";

export interface SiteSettingRow {
  id?: string;
  key: string;
  value: any;
  updatedAt?: string;
}

/**
 * One cache entry for /api/settings. It used to be read under four different
 * query keys, so every page load fetched the same settings four times and each
 * arrival re-rendered its consumers. ["settings"] is the key the admin settings
 * page already invalidates after a save, so admin edits refresh everything.
 */
export const SITE_SETTINGS_QUERY_KEY = ["settings"] as const;

/** Never throws: the storefront degrades to built-in defaults (the server does the same). */
export async function fetchPublicSiteSettings(): Promise<SiteSettingRow[]> {
  try {
    const res = await fetch("/api/settings", { credentials: "include" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function useSiteSettings() {
  return useQuery({
    queryKey: SITE_SETTINGS_QUERY_KEY,
    queryFn: fetchPublicSiteSettings,
    staleTime: 5 * 60 * 1000,
  });
}

/** Discount/surcharge rules from Admin → Pricing, as the server applies them at checkout. */
export function usePricingRules(): PricingRules {
  const { data } = useSiteSettings();
  return useMemo(() => pricingRulesFromSettings(data), [data]);
}

function settingString(settings: SiteSettingRow[] | undefined, key: string, fallback: string): string {
  const v = settings?.find((s) => s.key === key)?.value;
  return typeof v === "string" && v.trim() ? v : fallback;
}

/**
 * The contact lines a tour or transfer page shows. A product's own support email
 * or phone wins; otherwise it shows the contact page's details (Admin → Settings),
 * with the same built-in defaults the contact page uses.
 */
export function productContact(
  product: { supportEmail?: string | null; supportPhone?: string | null },
  settings: SiteSettingRow[] | undefined,
): { email: string; phones: { display: string; tel: string }[] } {
  const email = product.supportEmail?.trim() || settingString(settings, "contact_email", "acetoursvanuatu@outlook.com");
  const ownPhone = product.supportPhone?.trim();
  const rawPhones = ownPhone
    ? [ownPhone]
    : [settingString(settings, "contact_phone", "7114045"), settingString(settings, "contact_phone_2", "7342389")];
  const phones = rawPhones.map(vanuatuPhone).filter((p): p is NonNullable<typeof p> => p !== null);
  return { email, phones };
}
