/**
 * Boot for a prerendered snapshot that can't be hydrated: one without saved query
 * state, e.g. a snapshot copied from the previous deploy while this deploy's
 * prerender is still running (server/prerender-seed.ts strips the old state).
 *
 * Rendering into #root would wipe the snapshot and leave the page blank until the
 * app's code and data load. Instead the app renders into a hidden sibling that is
 * laid out (so components that measure work) but invisible and unclickable, and it
 * replaces the snapshot once its route has committed and shows a heading — or after
 * `timeoutMs`, so a page without one is never stuck behind the snapshot.
 */
export interface RenderBehindSnapshotOptions {
  /** Resolves when the route's content has committed (lib/route-committed.ts). */
  routeReady: Promise<void>;
  timeoutMs: number;
  doc?: Document;
}

const HIDDEN_STYLE = "position:fixed;inset:0;overflow:hidden;visibility:hidden;pointer-events:none;z-index:-1";

export async function renderBehindSnapshot(
  snapshot: HTMLElement,
  render: (container: HTMLElement) => void,
  { routeReady, timeoutMs, doc = document }: RenderBehindSnapshotOptions,
): Promise<void> {
  const container = doc.createElement("div");
  container.setAttribute("style", HIDDEN_STYLE);
  container.setAttribute("aria-hidden", "true");
  snapshot.after(container);
  render(container);

  const hasContent = () => Boolean(container.querySelector("h1")?.textContent?.trim());
  const contentShown = routeReady.then(
    () =>
      new Promise<void>((resolve) => {
        const check = () => (hasContent() ? resolve() : setTimeout(check, 50));
        check();
      }),
  );
  await Promise.race([contentShown, new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))]);

  container.removeAttribute("style");
  container.removeAttribute("aria-hidden");
  snapshot.replaceWith(container);
  container.id = snapshot.id;
}
