import { describe, it, expect } from "vitest";
import { QueryClient, QueryObserver, dehydrate, hydrate } from "@tanstack/react-query";
import {
  bootMode,
  isEnglish,
  parseSnapshotState,
  serializeSnapshotState,
  shouldDehydrateQuery,
} from "./hydration";

function observe(client: QueryClient, key: unknown[]) {
  const observer = new QueryObserver(client, { queryKey: key, enabled: false });
  return observer.subscribe(() => {});
}

function dehydratedKeys(client: QueryClient) {
  return dehydrate(client, { shouldDehydrateQuery }).queries.map((q) => q.queryKey);
}

describe("shouldDehydrateQuery", () => {
  it("keeps successful queries the current page is using", () => {
    const client = new QueryClient();
    client.setQueryData(["tour", "abc", "en"], { id: "abc" });
    observe(client, ["tour", "abc", "en"]);
    expect(dehydratedKeys(client)).toEqual([["tour", "abc", "en"]]);
  });

  it("drops queries left in the cache by earlier routes (no observers)", () => {
    const client = new QueryClient();
    client.setQueryData(["tour", "old", "en"], { id: "old" });
    expect(dehydratedKeys(client)).toEqual([]);
  });

  it("drops errored queries", async () => {
    const client = new QueryClient();
    await client
      .fetchQuery({ queryKey: ["products", "en"], queryFn: () => Promise.reject(new Error("x")), retry: false })
      .catch(() => {});
    observe(client, ["products", "en"]);
    expect(dehydratedKeys(client)).toEqual([]);
  });

  it.each([["auth"], ["/api/auth/me"], ["users"], ["user-bookings", "u1"], ["bookings"], ["booking", "b1"], ["cart"], ["csrf"], ["notifications"], ["session"]])(
    "never dehydrates private key %j",
    (...key) => {
      const client = new QueryClient();
      client.setQueryData(key, { secret: true });
      observe(client, key);
      expect(dehydratedKeys(client)).toEqual([]);
    },
  );

  it("keeps public keys that merely contain a private word later in the key", () => {
    const client = new QueryClient();
    client.setQueryData(["products", "en"], []);
    observe(client, ["products", "en"]);
    expect(dehydratedKeys(client)).toEqual([["products", "en"]]);
  });
});

describe("serializeSnapshotState / parseSnapshotState", () => {
  it("round-trips state", () => {
    const client = new QueryClient();
    client.setQueryData(["settings"], [{ key: "a", value: "b" }]);
    observe(client, ["settings"]);
    const text = serializeSnapshotState(dehydrate(client, { shouldDehydrateQuery }));
    expect(parseSnapshotState(text)?.queries[0].state.data).toEqual([{ key: "a", value: "b" }]);
  });

  it("cannot close the surrounding <script> element", () => {
    const client = new QueryClient();
    client.setQueryData(["article", "x"], { html: "</script><script>alert(1)</script>\u2028" });
    observe(client, ["article", "x"]);
    const text = serializeSnapshotState(dehydrate(client, { shouldDehydrateQuery }));
    expect(text).not.toContain("<");
    expect(text).not.toContain("\u2028");
    expect(parseSnapshotState(text)?.queries[0].state.data).toEqual({
      html: "</script><script>alert(1)</script>\u2028",
    });
  });

  it("returns null for missing, malformed or wrong-shaped input", () => {
    expect(parseSnapshotState(null)).toBeNull();
    expect(parseSnapshotState(undefined)).toBeNull();
    expect(parseSnapshotState("")).toBeNull();
    expect(parseSnapshotState("{not json")).toBeNull();
    expect(parseSnapshotState('{"foo":1}')).toBeNull();
    expect(parseSnapshotState("null")).toBeNull();
  });

  it("keeps dataUpdatedAt so hydrated data is stale and refetches", () => {
    const source = new QueryClient();
    source.setQueryData(["tour", "abc", "en"], { price: 1000 }, { updatedAt: Date.now() - 10 * 60 * 1000 });
    observe(source, ["tour", "abc", "en"]);
    const state = parseSnapshotState(serializeSnapshotState(dehydrate(source, { shouldDehydrateQuery })))!;

    const target = new QueryClient({ defaultOptions: { queries: { staleTime: 5 * 60 * 1000 } } });
    hydrate(target, state);
    const query = target.getQueryCache().find({ queryKey: ["tour", "abc", "en"] })!;
    expect(query.state.data).toEqual({ price: 1000 });
    expect(query.isStaleByTime(5 * 60 * 1000)).toBe(true);
  });
});

describe("bootMode", () => {
  const state = { mutations: [], queries: [] };
  it("hydrates only a prerendered root that has state", () => {
    expect(bootMode(true, state)).toBe("hydrate");
  });
  it("renders the SPA shell (empty root)", () => {
    expect(bootMode(false, state)).toBe("render");
  });
  it("renders a snapshot without a state block", () => {
    expect(bootMode(true, null)).toBe("render");
  });
});

describe("isEnglish", () => {
  it.each([["en", true], ["en-US", true], ["EN-gb", true], [undefined, true], ["fr", false], ["zh", false], ["bi", false]])(
    "%s -> %s",
    (lang, expected) => {
      expect(isEnglish(lang)).toBe(expected);
    },
  );
});
