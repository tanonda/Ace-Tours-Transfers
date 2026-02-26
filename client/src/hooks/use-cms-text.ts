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
 */

import { useQuery } from "@tanstack/react-query";
import type { CmsContent } from "@shared/schema";

type CmsBlock = Record<string, CmsContent[]>; // block_slug → rows

async function fetchCmsBlock(): Promise<CmsBlock> {
  const res = await fetch("/api/content-blocks", { credentials: "include" });
  if (!res.ok) return {};
  return res.json();
}

export function useCmsText(blockSlug: string) {
  const { data = {}, isLoading } = useQuery<CmsBlock>({
    queryKey: ["cms-content-blocks"],
    queryFn: fetchCmsBlock,
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
