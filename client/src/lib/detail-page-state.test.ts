import { describe, it, expect } from "vitest";
import { detailPageState } from "./detail-page-state";

const httpError = (status: number) => Object.assign(new Error(`${status}: x`), { status });

describe("detailPageState", () => {
  it("shows the page whenever there is data, even if the latest refetch failed", () => {
    // A hydrated snapshot goes stale after 5 minutes; a failed refetch must not wipe it.
    expect(detailPageState({ hasData: true, isLoading: false, error: new TypeError("Failed to fetch") })).toBe("ready");
    expect(detailPageState({ hasData: true, isLoading: false, error: httpError(500) })).toBe("ready");
    expect(detailPageState({ hasData: true, isLoading: true, error: null })).toBe("ready");
  });

  it("is loading while the first request is in flight", () => {
    expect(detailPageState({ hasData: false, isLoading: true, error: null })).toBe("loading");
  });

  it("is not-found only when the server says 404", () => {
    expect(detailPageState({ hasData: false, isLoading: false, error: httpError(404) })).toBe("not-found");
  });

  it("is unavailable when the request failed for any other reason", () => {
    expect(detailPageState({ hasData: false, isLoading: false, error: new TypeError("Failed to fetch") })).toBe("unavailable");
    expect(detailPageState({ hasData: false, isLoading: false, error: httpError(503) })).toBe("unavailable");
  });

  it("is not-found when there is nothing to load (no slug in the URL)", () => {
    expect(detailPageState({ hasData: false, isLoading: false, error: null })).toBe("not-found");
  });
});
