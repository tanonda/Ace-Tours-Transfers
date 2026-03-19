/**
 * useCmsText — reads editable text from the cms_content database table.
 *
 * Usage:
 *   const cms = useCmsText("home");
 *   cms.text("hero_title_part1")          // plain text value
 *   cms.html("about_desc1")               // rich-text HTML value (use dangerouslySetInnerHTML)
 *   cms.ready                             // false while data is loading (use for skeleton states)
 *
 * The hook fetches /api/content-blocks once per session (React Query caches it).
 * If no DB row exists for a key the hook returns "". The pages pass an i18n
 * string as the second argument so the UI degrades gracefully during migrations:
 *   cms.text("hero_title_part1", t("hero.titlePart1"))
 *
 * The hook is locale-aware: it reads the current i18n language and passes it
 * to the API so the correct translation is returned. Falls back to English
 * for any CMS key that doesn't have a translation in the current language.
 */

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { CmsContent } from "@shared/schema";

type CmsBlock = Record<string, CmsContent[]>; // block_slug → rows

async function fetchCmsBlock(locale: string): Promise<CmsBlock> {
  const qs = locale && locale !== 'en' ? `?locale=${locale}` : '';
  const res = await fetch(`/api/content-blocks${qs}`, { credentials: "include" });
  if (!res.ok) return {};
  return res.json();
}

export function useCmsText(blockSlug: string) {
  const { i18n } = useTranslation();
  const locale = i18n.language?.split('-')[0] || 'en'; // normalize e.g. 'zh-CN' → 'zh'

  const { data = {}, isLoading } = useQuery<CmsBlock>({
    queryKey: ["cms-content-blocks", locale],
    queryFn: () => fetchCmsBlock(locale),
    staleTime: 5 * 60 * 1000, // cache for 5 minutes
  });

  const rows: CmsContent[] = data[blockSlug] ?? [];

  /** Return the plain text value for a content key, falling back to `fallback`. */
  function text(key: string, fallback = ""): string {
    const row = rows.find((r) => r.contentKey === key);
    const val = row?.value?.trim() ?? "";
    return val !== "" ? val : fallback;
  }

  /** Return the rich-text HTML value for a content key, falling back to `fallback`. */
  function html(key: string, fallback = ""): string {
    const row = rows.find((r) => r.contentKey === key);
    const val = row?.value?.trim() ?? "";
    return val !== "" ? val : fallback;
  }

  return { text, html, ready: !isLoading };
}

