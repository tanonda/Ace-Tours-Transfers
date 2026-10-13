/**
 * A readable message from a failed request. apiRequest() throws "<status>: <body>",
 * where the body is usually {"error": "..."}; admins should see just that sentence.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message.trim() : "";
  if (!raw) return fallback;
  const m = /^\d{3}: ([\s\S]*)$/.exec(raw);
  if (!m) return raw;
  const body = m[1].trim();
  try {
    const parsed = JSON.parse(body);
    return typeof parsed?.error === "string" && parsed.error.trim() ? parsed.error : fallback;
  } catch {
    return body || fallback;
  }
}
