import { QueryClient, QueryFunction, QueryCache } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    const error = new Error(`${res.status}: ${text}`);
    (error as any).status = res.status;
    throw error;
  }
}

/** Read the CSRF token from the cookie set by /api/csrf-token */
function getCsrfToken(): string | undefined {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match?.[1];
}

/** Ensure we have a CSRF token; fetch one if missing. */
let csrfPromise: Promise<void> | null = null;
export function ensureCsrfToken(): Promise<void> {
  if (getCsrfToken()) return Promise.resolve();
  if (!csrfPromise) {
    csrfPromise = fetch("/api/csrf-token", { credentials: "include" })
      .then(() => { csrfPromise = null; })
      .catch(() => { csrfPromise = null; });
  }
  return csrfPromise;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Ensure CSRF token exists for state-changing requests
  if (method !== "GET" && method !== "HEAD") {
    await ensureCsrfToken();
  }

  const headers: Record<string, string> = {};
  if (data) headers["Content-Type"] = "application/json";

  const csrfToken = getCsrfToken();
  if (csrfToken && method !== "GET" && method !== "HEAD") {
    headers["X-CSRF-Token"] = csrfToken;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

// Create a QueryCache instance with a global onError handler
const queryCache = new QueryCache({
  onError: (error) => {
    console.error("Global query error:", error);
  },
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      // 5 minutes for most data — product detail, tours, transfers rarely change mid-session
      staleTime: 5 * 60 * 1000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
  queryCache, // Pass the custom queryCache instance
});