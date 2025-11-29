import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

(function() {
  const handler = {
    get(target: PromiseConstructor, prop: string | symbol) {
      return Reflect.get(target, prop);
    }
  };
  
  window.addEventListener('error', function(event) {
    if (!event.error || (typeof event.error === 'object' && !('stack' in event.error))) {
      event.stopImmediatePropagation();
      event.preventDefault();
      return true;
    }
  }, true);
  
  window.addEventListener('unhandledrejection', function(event) {
    if (!event.reason || (typeof event.reason === 'object' && !('stack' in event.reason))) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  }, true);
})();

createRoot(document.getElementById("root")!).render(<App />);
