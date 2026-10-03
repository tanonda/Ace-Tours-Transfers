import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./lib/i18n";
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

createRoot(document.getElementById("root")!).render(<App />);
