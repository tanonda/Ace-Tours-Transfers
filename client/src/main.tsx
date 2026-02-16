import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./lib/i18n";

(function () {
  const handler = {
    get(target: PromiseConstructor, prop: string | symbol) {
      return Reflect.get(target, prop);
    }
  };

  window.addEventListener('error', function (event) {
    // Suppress non-Error objects, string errors, and non-stack errors
    // Specifically catch ResizeObserver loop errors which are harmless but trigger the overlay
    const isResizeObserverError = event.message?.includes('ResizeObserver loop limit exceeded') ||
      event.message?.includes('ResizeObserver loop completed with undelivered notifications');

    if (isResizeObserverError || !event.error || typeof event.error === 'string' ||
      (typeof event.error === 'object' && !('stack' in event.error))) {
      event.stopPropagation();
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
