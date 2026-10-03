import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import i18n, { syncLanguage } from "./lib/i18n";
import { withCsrf } from "./lib/csrf-fetch";
import { ensureCsrfToken, getCsrfToken } from "./lib/queryClient";

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

// Non-English visitors wait for their (small, lazily loaded) language file so the
// first render is already translated; English renders immediately.
const render = () => createRoot(document.getElementById("root")!).render(<App />);
syncLanguage(i18n.language).then(render, render);
