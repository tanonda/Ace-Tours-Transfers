import { useEffect, useRef, useState } from "react";
import { animate, type AnimationPlaybackControls } from "framer-motion";
import {
  dismissOffset,
  releaseVelocity,
  rubberband,
  shouldDismiss,
  type PointerSample,
  type SheetSide,
} from "@/lib/swipe-dismiss";

// Movement before we claim the gesture: below this a tap is still a tap.
const HYSTERESIS_PX = 10;

/**
 * Swipe a sheet toward its edge to close it.
 *
 * - Tracks the finger 1:1 from where it grabbed, with rubber-band resistance
 *   when pulled the wrong way, and dims the overlay continuously as it goes.
 * - On release it projects momentum: a short flick closes, a long drag being
 *   pulled back springs home carrying the finger's velocity.
 * - Closing hands off to the sheet's own exit keyframe, which has no `from`
 *   frame, so it continues from the dragged position instead of jumping.
 * - Grabbing the panel mid spring-back interrupts it from its live position.
 */
export function useSwipeDismiss<T extends HTMLElement>(
  side: SheetSide,
  onDismiss: () => void,
  enabled = true,
) {
  // Callback ref: Radix mounts the panel only while open, so the node arrives
  // after this hook's first render.
  const [el, setEl] = useState<T | null>(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!el || !enabled) return;

    const horizontal = side === "left" || side === "right";
    const sign = side === "left" || side === "top" ? -1 : 1;
    const overlay = el.previousElementSibling instanceof HTMLElement ? el.previousElementSibling : null;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let offset = 0; // live, on-screen offset toward the closing edge
    let size = 1;
    let origin: { x: number; y: number; offset: number } | null = null;
    let tracking = false;
    let samples: PointerSample[] = [];
    let spring: AnimationPlaybackControls | null = null;
    let suppressClick = false;

    // Let the browser keep vertical scrolling inside a side sheet; horizontal
    // movement is ours.
    const previousTouchAction = el.style.touchAction;
    if (horizontal) el.style.touchAction = "pan-y";

    const render = (value: number) => {
      offset = value;
      const shown = value >= 0 ? value : rubberband(value, size);
      const px = sign * shown;
      el.style.transform = horizontal ? `translate3d(${px}px,0,0)` : `translate3d(0,${px}px,0)`;
      if (overlay) overlay.style.opacity = String(1 - Math.min(Math.max(value, 0) / size, 1));
    };

    const reset = () => {
      el.style.transform = "";
      if (overlay) overlay.style.opacity = "";
      offset = 0;
    };

    const isFormControl = (target: EventTarget | null) =>
      target instanceof Element && !!target.closest("input, textarea, select, [contenteditable], [data-no-swipe]");

    // A vertical sheet only follows the finger when its scroller is at the top,
    // otherwise the drag belongs to the content.
    const contentScrolled = (target: EventTarget | null) => {
      if (horizontal) return false;
      for (let n = target instanceof Element ? target : null; n && n !== el.parentElement; n = n.parentElement) {
        if (n instanceof HTMLElement && n.scrollHeight > n.clientHeight && n.scrollTop > 0) return true;
      }
      return false;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (isFormControl(e.target) || contentScrolled(e.target)) return;
      spring?.stop();
      spring = null;
      size = (horizontal ? el.offsetWidth : el.offsetHeight) || 1;
      origin = { x: e.clientX, y: e.clientY, offset };
      tracking = offset !== 0; // already displaced: the grab continues the drag
      samples = [{ t: e.timeStamp, x: offset }];
      if (tracking) el.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!origin) return;
      const dx = e.clientX - origin.x;
      const dy = e.clientY - origin.y;

      if (!tracking) {
        const along = horizontal ? Math.abs(dx) : Math.abs(dy);
        const across = horizontal ? Math.abs(dy) : Math.abs(dx);
        if (Math.max(along, across) < HYSTERESIS_PX) return;
        // Cross-axis or opening-direction movement isn't a dismiss: let it go.
        if (across >= along || dismissOffset(side, dx, dy) <= 0) {
          origin = null;
          return;
        }
        tracking = true;
        el.style.userSelect = "none";
        // Re-anchor so the panel doesn't jump by the hysteresis distance.
        origin = { x: e.clientX, y: e.clientY, offset };
        el.setPointerCapture(e.pointerId);
        return;
      }

      const next = origin.offset + dismissOffset(side, dx, dy);
      render(next);
      samples.push({ t: e.timeStamp, x: next });
      if (samples.length > 20) samples.shift();
    };

    const onPointerUp = (e: PointerEvent) => {
      const wasTracking = tracking;
      origin = null;
      tracking = false;
      el.style.userSelect = "";
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      if (!wasTracking) return;

      const velocity = e.type === "pointercancel" ? 0 : releaseVelocity(samples, 100, e.timeStamp);
      const dismiss = shouldDismiss(offset, velocity, size);

      // Close before arming click suppression: the dismiss itself is a
      // (programmatic) click on the sheet's Close button.
      if (dismiss) onDismissRef.current();
      suppressClick = true;
      setTimeout(() => (suppressClick = false), 0);
      if (dismiss) return;

      spring = animate(offset, 0, {
        ...(reducedMotion
          ? { type: "tween", duration: 0.15, ease: "easeOut" }
          : { type: "spring", bounce: 0, duration: 0.35, velocity }),
        onUpdate: render,
        onComplete: () => {
          spring = null;
          reset();
        },
      });
    };

    // The pointer-up that ends a drag must not also activate whatever link or
    // button the finger happened to start on.
    const onClickCapture = (e: MouseEvent) => {
      if (!suppressClick) return;
      e.preventDefault();
      e.stopPropagation();
    };

    // With a mouse, pressing on a link or image and moving starts the
    // browser's native drag, which cancels the pointer stream mid-gesture.
    const onDragStart = (e: DragEvent) => e.preventDefault();

    el.addEventListener("dragstart", onDragStart);
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("click", onClickCapture, true);

    return () => {
      spring?.stop();
      el.style.touchAction = previousTouchAction;
      el.removeEventListener("dragstart", onDragStart);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("click", onClickCapture, true);
    };
  }, [el, side, enabled]);

  return setEl;
}
