/**
 * Gesture math for swipe-to-dismiss panels (see useSwipeDismiss).
 * Pure functions so the feel can be unit-tested without a browser.
 */

export type SheetSide = "top" | "right" | "bottom" | "left";

export interface PointerSample {
  t: number; // ms
  x: number; // px along the dismiss axis
}

// Apple's scroll-deceleration projection: where a released element would come
// to rest. 0.998 matches normal scroll feel.
export function projectMomentum(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

// Progressive resistance past a boundary: follows almost 1:1 at first, then
// flattens, so pulling the wrong way reads as "nothing more here", not "frozen".
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

// Velocity over the last `windowMs` of moves, so a finger that pauses before
// lifting releases at ~0 rather than the speed it had earlier in the drag.
// `releaseT` is the lift time: a lift long after the last move means the
// finger was resting (no move events fire while it's still).
export function releaseVelocity(samples: PointerSample[], windowMs = 100, releaseT?: number): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  if (releaseT !== undefined && releaseT - last.t > windowMs) return 0;
  const recent = samples.filter((s) => last.t - s.t <= windowMs);
  const first = recent[0];
  const dt = last.t - first.t;
  if (recent.length < 2 || dt <= 0) return 0;
  return ((last.x - first.x) / dt) * 1000;
}

// Distance travelled toward the panel's closing edge (positive = closing).
export function dismissOffset(side: SheetSide, dx: number, dy: number): number {
  switch (side) {
    case "left":
      return -dx;
    case "right":
      return dx;
    case "top":
      return -dy;
    case "bottom":
      return dy;
  }
}

// Decide from where the gesture is *going*, not where it was released: a short
// flick closes, a long drag that is being pulled back stays open.
export function shouldDismiss(offset: number, velocity: number, size: number): boolean {
  return offset + projectMomentum(velocity) > size / 2;
}
