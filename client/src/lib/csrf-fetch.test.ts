import { describe, expect, it, vi } from "vitest";
import { withCsrf } from "./csrf-fetch";

const ORIGIN = "https://acetoursvanuatu.com";

function setup(token: string | null = "tok-123") {
  const base = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("{}"));
  let current = token ?? undefined;
  const ensureToken = vi.fn(async () => {
    current ??= "fresh-tok";
  });
  const wrapped = withCsrf(base as unknown as typeof fetch, { getToken: () => current, ensureToken, origin: ORIGIN });
  const sentHeaders = () => new Headers(base.mock.calls[0][1]?.headers);
  return { base, wrapped, ensureToken, sentHeaders };
}

describe("withCsrf", () => {
  it("adds the token to a same-origin PATCH that forgot it (e.g. change-password)", async () => {
    const { wrapped, sentHeaders } = setup();
    await wrapped("/api/users/u1/change-password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });

    expect(sentHeaders().get("X-CSRF-Token")).toBe("tok-123");
    expect(sentHeaders().get("Content-Type")).toBe("application/json");
  });

  it("fetches a token first when the cookie is missing", async () => {
    const { wrapped, ensureToken, sentHeaders } = setup(null);
    await wrapped("/api/promotions/validate", { method: "POST" });

    expect(ensureToken).toHaveBeenCalled();
    expect(sentHeaders().get("X-CSRF-Token")).toBe("fresh-tok");
  });

  it("keeps a token the caller already set", async () => {
    const { wrapped, ensureToken, sentHeaders } = setup();
    await wrapped("/api/auth/login", { method: "POST", headers: { "X-CSRF-Token": "caller-tok" } });

    expect(sentHeaders().get("X-CSRF-Token")).toBe("caller-tok");
    expect(ensureToken).not.toHaveBeenCalled();
  });

  it("works with a Request object", async () => {
    const { wrapped, sentHeaders } = setup();
    await wrapped(new Request(`${ORIGIN}/api/admin/reviews/r1`, { method: "DELETE" }));

    expect(sentHeaders().get("X-CSRF-Token")).toBe("tok-123");
  });

  it("leaves GET requests untouched", async () => {
    const { wrapped, base, ensureToken } = setup();
    const init = { method: "GET" };
    await wrapped("/api/products", init);

    expect(base).toHaveBeenCalledWith("/api/products", init);
    expect(ensureToken).not.toHaveBeenCalled();
  });

  it("never sends the token to another origin", async () => {
    const { wrapped, base } = setup();
    const init = { method: "POST" };
    await wrapped("https://api.cloudinary.com/v1_1/upload", init);

    expect(base).toHaveBeenCalledWith("https://api.cloudinary.com/v1_1/upload", init);
  });

  it("ignores same-origin non-API paths", async () => {
    const { wrapped, base } = setup();
    const init = { method: "POST" };
    await wrapped("/some-form", init);

    expect(base).toHaveBeenCalledWith("/some-form", init);
  });
});
