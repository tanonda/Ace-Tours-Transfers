/**
 * Muted looping video behind a hero, over (not instead of) the hero photo.
 *
 * It renders nothing on the server and on the first client render, so the prerendered
 * snapshot and hydration keep only the photo (the page's LCP image). After mount it
 * plays only where shouldPlayLoop allows: tablets and computers, no reduced motion,
 * no data saver, no 2G. If the video can't load or play, it removes itself and the
 * photo stays.
 */
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { LOOP_MIN_WIDTH, isFatalPlayError, shouldPlayLoop, type LoopSources } from "@shared/hero-video";

type Connection = { saveData?: boolean; effectiveType?: string };

export function HeroBackgroundVideo({ sources, position }: { sources: LoopSources; position?: string }) {
  const [allowed, setAllowed] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const wide = window.matchMedia(`(min-width: ${LOOP_MIN_WIDTH}px)`);
    const connection = (navigator as Navigator & { connection?: Connection }).connection;
    const update = () =>
      setAllowed(
        shouldPlayLoop({
          width: window.innerWidth,
          reducedMotion: reduced.matches,
          saveData: connection?.saveData,
          effectiveType: connection?.effectiveType,
        }),
      );
    update();
    reduced.addEventListener("change", update);
    wide.addEventListener("change", update);
    return () => {
      reduced.removeEventListener("change", update);
      wide.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    if (!allowed) setReady(false);
    // An interrupted start (e.g. the window narrowed mid-play) isn't a failure: the loop
    // should come back when the window widens again.
    else ref.current?.play()?.catch((err) => isFatalPlayError(err) && setFailed(true));
  }, [allowed]);

  if (!allowed || failed) return null;
  return (
    <video
      ref={ref}
      muted
      loop
      playsInline
      autoPlay
      preload="auto"
      aria-hidden
      tabIndex={-1}
      onCanPlay={() => setReady(true)}
      className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-700", ready ? "opacity-100" : "opacity-0")}
      style={{ objectPosition: position }}
    >
      <source src={sources.webm} type="video/webm" />
      {/* Errors fire on the last <source> when none can play. */}
      <source src={sources.mp4} type="video/mp4" onError={() => setFailed(true)} />
    </video>
  );
}
