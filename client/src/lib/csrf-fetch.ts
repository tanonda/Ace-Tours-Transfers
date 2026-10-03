/**
 * Wraps fetch so every same-origin, state-changing /api/ request carries the
 * X-CSRF-Token header the server requires (double-submit cookie, see
 * server/middleware/csrf.ts).
 *
 * apiRequest() already does this, but many pages call fetch() directly and were
 * being rejected with "CSRF token missing" (e.g. admin change-password, promo-code
 * validation). Installing this once at startup covers those and any future ones.
 */
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

interface CsrfOptions {
  getToken: () => string | undefined;
  ensureToken: () => Promise<void>;
  origin: string;
}

export function withCsrf(baseFetch: typeof fetch, { getToken, ensureToken, origin }: CsrfOptions): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : undefined;
    const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
    const url = new URL(request ? request.url : input.toString(), origin);

    if (!UNSAFE_METHODS.has(method) || url.origin !== origin || !url.pathname.startsWith("/api/")) {
      return baseFetch(input, init);
    }

    const headers = new Headers(init?.headers ?? request?.headers);
    if (!headers.has("X-CSRF-Token")) {
      await ensureToken();
      const token = getToken();
      if (token) headers.set("X-CSRF-Token", token);
    }
    return baseFetch(input, { ...init, headers });
  };
}
