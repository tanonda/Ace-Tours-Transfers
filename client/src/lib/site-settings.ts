import { useQuery } from "@tanstack/react-query";

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
