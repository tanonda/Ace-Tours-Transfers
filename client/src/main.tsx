import { createRoot, hydrateRoot } from "react-dom/client";
import { dehydrate, hydrate } from "@tanstack/react-query";
import App from "./App";
import "./index.css";
import i18n, { ensureLanguage, syncLanguage } from "./lib/i18n";
import { withCsrf } from "./lib/csrf-fetch";
import { ensureCsrfToken, getCsrfToken, queryClient } from "./lib/queryClient";
import {
  bootMode,
  isEnglish,
  parseSnapshotState,
  serializeSnapshotState,
  shouldDehydrateQuery,
} from "./lib/hydration";
import { SNAPSHOT_STATE_ID } from "@shared/snapshot-state";

// Every state-changing /api/ call must carry the CSRF header, including pages that
// call fetch() directly instead of apiRequest(). Installed before anything renders.
window.fetch = withCsrf(window.fetch.bind(window), {
  getToken: getCsrfToken,
  ensureToken: ensureCsrfToken,
  origin: window.location.origin,
});

(function () {
  const handler = {
    get(target: PromiseConstructor, prop: string | symbol) {
      return Reflect.get(target, prop);
    }
  };

  window.addEventListener('error', function (event) {
    if (!event.error || (typeof event.error === 'object' && !('stack' in event.error))) {
      event.stopImmediatePropagation();
      event.preventDefault();
      return true;
    }
  }, true);

  window.addEventListener('unhandledrejection', function (event) {
    if (!event.reason || (typeof event.reason === 'object' && !('stack' in event.reason))) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  }, true);
})();

// scripts/prerender.ts calls this just before saving each page, so the snapshot
// carries the data it was rendered with (see client/src/lib/hydration.ts).
window.__ACE_DEHYDRATE__ = () => serializeSnapshotState(dehydrate(queryClient, { shouldDehydrateQuery }));

const rootElement = document.getElementById("root")!;
const snapshotState = parseSnapshotState(document.getElementById(SNAPSHOT_STATE_ID)?.textContent);

async function boot() {
  if (bootMode(rootElement.childElementCount > 0, snapshotState) === "hydrate") {
    // Adopt the prerendered HTML instead of replacing it. Snapshots are English, so
    // hydrate in English and switch to the visitor's language afterwards.
    hydrate(queryClient, snapshotState!);
    // Query keys include i18n.language, and the snapshot's are "en": an "en-AU"
    // visitor must hydrate as "en" too or the page's data looks missing.
    const visitorLanguage = i18n.language;
    const switchLanguage = !isEnglish(visitorLanguage);
    const translations = switchLanguage ? ensureLanguage(visitorLanguage).catch(() => {}) : null;
    if (visitorLanguage !== "en") await i18n.changeLanguage("en");
    hydrateRoot(rootElement, <App />, {
      onRecoverableError: (error) => console.warn("[hydration]", error),
    });
    if (translations) {
      await translations;
      setTimeout(() => void i18n.changeLanguage(visitorLanguage), 0);
    }
    return;
  }

  // SPA shell or snapshot without state: render from scratch. Non-English visitors
  // wait for their (small, lazily loaded) language file so the first render is
  // already translated; English renders immediately.
  const render = () => createRoot(rootElement).render(<App />);
  syncLanguage(i18n.language).then(render, render);
}

void boot();
