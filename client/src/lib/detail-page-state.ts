/**
 * What a tour, transfer or article page should show for its main query.
 *
 * Data always wins: a hydrated snapshot is stale after five minutes, and a failed
 * refetch must not replace real content with an error page (that is what Google's
 * renderer saw while /api was blocked). Only a 404 means the record is gone; any
 * other failure is "unavailable", which must not read as "not found".
 */
export type DetailPageState = "loading" | "ready" | "not-found" | "unavailable";

export function detailPageState(query: { hasData: boolean; isLoading: boolean; error: unknown }): DetailPageState {
  if (query.hasData) return "ready";
  if (query.isLoading) return "loading";
  if (!query.error) return "not-found";
  return (query.error as { status?: unknown }).status === 404 ? "not-found" : "unavailable";
}
