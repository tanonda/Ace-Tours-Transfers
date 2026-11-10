import { describe, it, expect } from "vitest";
import {
  projectMomentum,
  rubberband,
  releaseVelocity,
  shouldDismiss,
  dismissOffset,
} from "./swipe-dismiss";

describe("projectMomentum", () => {
  it("is zero at rest", () => {
    expect(projectMomentum(0)).toBe(0);
  });

  it("throws further the faster the release (Apple's decay projection)", () => {
    // 1000 px/s at d=0.998 → 1 * 0.998 / 0.002 = 499px
    expect(projectMomentum(1000)).toBeCloseTo(499, 0);
    expect(projectMomentum(-1000)).toBeCloseTo(-499, 0);
  });
});

describe("rubberband", () => {
  it("follows nearly 1:1 for a small pull, then resists", () => {
    const small = rubberband(10, 300);
    const large = rubberband(300, 300);
    expect(small).toBeGreaterThan(5);
    expect(small).toBeLessThan(10);
    expect(large).toBeLessThan(120);
  });

  it("keeps the sign of the overshoot", () => {
    expect(rubberband(-40, 300)).toBeLessThan(0);
  });
});

describe("releaseVelocity", () => {
  it("measures px/s over the recent samples", () => {
    const v = releaseVelocity([
      { t: 0, x: 0 },
      { t: 50, x: 25 },
      { t: 100, x: 50 },
    ]);
    expect(v).toBeCloseTo(500, 0);
  });

  it("ignores samples older than the window so a pause reads as zero", () => {
    const v = releaseVelocity([
      { t: 0, x: 0 },
      { t: 20, x: 100 },
      { t: 400, x: 100 },
    ]);
    expect(v).toBe(0);
  });

  it("keeps the move velocity when the lift comes shortly after the last move", () => {
    const moves = [
      { t: 0, x: 0 },
      { t: 60, x: 18 },
      { t: 120, x: 36 },
    ];
    expect(releaseVelocity(moves, 100, 180)).toBeCloseTo(300, 0);
  });

  it("is zero when the finger rested longer than the window before lifting", () => {
    const moves = [
      { t: 0, x: 0 },
      { t: 50, x: 50 },
    ];
    expect(releaseVelocity(moves, 100, 300)).toBe(0);
  });

  it("is zero with fewer than two samples", () => {
    expect(releaseVelocity([{ t: 0, x: 0 }])).toBe(0);
  });
});

describe("dismissOffset", () => {
  it("maps each side to the direction it closes in", () => {
    expect(dismissOffset("left", -30, 0)).toBe(30);
    expect(dismissOffset("right", 30, 0)).toBe(30);
    expect(dismissOffset("bottom", 0, 30)).toBe(30);
    expect(dismissOffset("top", 0, -30)).toBe(30);
  });
});

describe("shouldDismiss", () => {
  const size = 300;

  it("dismisses a slow drag past half the panel", () => {
    expect(shouldDismiss(160, 0, size)).toBe(true);
  });

  it("returns a slow short drag", () => {
    expect(shouldDismiss(60, 0, size)).toBe(false);
  });

  it("dismisses a short flick because its projection lands past half", () => {
    expect(shouldDismiss(40, 800, size)).toBe(true);
  });

  it("returns a long drag the user is pulling back", () => {
    expect(shouldDismiss(200, -600, size)).toBe(false);
  });
});
