import type { DehydratedState, Query } from "@tanstack/react-query";

declare global {
  interface Window {
    /** Called by scripts/prerender.ts just before a page is saved. */
    __ACE_DEHYDRATE__?: () => string;
  }
}

// Visitor-specific data must never be baked into a public snapshot.
const PRIVATE_KEY = /^(\/api\/)?(auth|users?|user-bookings|session|cart|csrf|bookings?|booking-|notifications)/i;

/**
 * Only data the current page is showing: the prerender moves between routes in one
 * tab, so the cache also holds earlier routes' queries, which have no observers.
 */
export function shouldDehydrateQuery(query: Query): boolean {
  if (query.state.status !== "success") return false;
  if (query.getObserversCount() === 0) return false;
  return !PRIVATE_KEY.test(String(query.queryKey[0] ?? ""));
}

/** JSON safe to inline in <script type="application/json">: no "<", no JS line separators. */
export function serializeSnapshotState(state: DehydratedState): string {
  return JSON.stringify(state)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function parseSnapshotState(text: string | null | undefined): DehydratedState | null {
  if (!text) return null;
  try {
    const value = JSON.parse(text);
    return value && Array.isArray(value.queries) ? (value as DehydratedState) : null;
  } catch {
    return null;
  }
}

export type BootMode = "hydrate" | "render";

/** Hydrate only real prerendered content with its data; anything else renders from scratch. */
export function bootMode(rootHasContent: boolean, state: DehydratedState | null): BootMode {
  return rootHasContent && state !== null ? "hydrate" : "render";
}

/** Snapshots are English; any English variant can hydrate without a language switch. */
export function isEnglish(language: string | undefined): boolean {
  return !language || language.toLowerCase().startsWith("en");
}
