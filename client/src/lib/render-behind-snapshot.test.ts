import { describe, it, expect, beforeEach } from "vitest";
// @ts-ignore - jsdom ships no type declarations
import { JSDOM } from "jsdom";
import { renderBehindSnapshot } from "./render-behind-snapshot";

let doc: Document;
let snapshot: HTMLElement;

beforeEach(() => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"><h1>Blue Lagoon</h1></div></body></html>');
  doc = dom.window.document;
  snapshot = doc.getElementById("root")!;
});

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

// A snapshot without saved data (e.g. copied from the previous deploy) can't be
// hydrated. Rendering into #root would wipe it and leave the page blank until the
// app's code and data load, so the app renders out of sight and takes over when ready.
describe("renderBehindSnapshot", () => {
  it("keeps the snapshot on screen while the app is still loading", async () => {
    let container!: HTMLElement;
    void renderBehindSnapshot(snapshot, (c) => { container = c; }, { routeReady: new Promise(() => {}), timeoutMs: 10_000, doc });
    await tick();

    expect(doc.getElementById("root")).toBe(snapshot);
    expect(snapshot.textContent).toContain("Blue Lagoon");
    expect(container.isConnected).toBe(true); // laid out, so measuring components work
    expect(container.style.visibility).toBe("hidden");
    expect(container.style.pointerEvents).toBe("none");
  });

  it("swaps in the app once its route has committed and shows a heading", async () => {
    let container!: HTMLElement;
    let commit!: () => void;
    const done = renderBehindSnapshot(snapshot, (c) => { container = c; }, {
      routeReady: new Promise<void>((resolve) => { commit = resolve; }), timeoutMs: 10_000, doc,
    });
    commit();
    await tick(30);
    expect(doc.getElementById("root")).toBe(snapshot); // committed, but still a spinner

    container.innerHTML = "<h1>Blue Lagoon</h1><p>Live app</p>";
    await done;

    expect(snapshot.isConnected).toBe(false);
    expect(doc.getElementById("root")).toBe(container);
    expect(container.getAttribute("style") ?? "").toBe("");
    expect(doc.body.textContent).toContain("Live app");
  });

  it("swaps in the app after the timeout even if no heading ever appears", async () => {
    let container!: HTMLElement;
    await renderBehindSnapshot(snapshot, (c) => { container = c; }, { routeReady: new Promise(() => {}), timeoutMs: 50, doc });

    expect(doc.getElementById("root")).toBe(container);
    expect(snapshot.isConnected).toBe(false);
  });
});
