import { useEffect } from "react";
import { useLocation } from "wouter";
import NProgress from "nprogress";
import "nprogress/nprogress.css";

// Configure NProgress to be less intrusive
NProgress.configure({ showSpinner: false, speed: 400, minimum: 0.1 });

export function NProgressRouter() {
  const [location] = useLocation();

  useEffect(() => {
    // Start progress bar on route change
    NProgress.start();

    // Use a small timeout to allow Suspense to catch the rendering first,
    // and then complete the progress bar when the new page is ready
    const timer = setTimeout(() => {
      NProgress.done();
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, [location]);

  return null;
}
