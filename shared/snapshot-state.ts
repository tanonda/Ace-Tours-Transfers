/**
 * Prerendered snapshots carry the react-query data they were rendered with, so the
 * client can hydrate the HTML instead of rebuilding it. Shared by the prerender
 * (writer) and the client (reader).
 */
export const SNAPSHOT_STATE_ID = "__ACE_QUERY_STATE__";

/** Larger states are left out of the snapshot; that page then boots with createRoot. */
export const MAX_STATE_BYTES = 150 * 1024;
