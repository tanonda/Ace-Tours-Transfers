import { describe, it, expect } from "vitest";
import { buildInpEvent } from "./web-vitals-report";

const metric = (over: Record<string, unknown> = {}) =>
  ({
    name: "INP",
    value: 412.6,
    rating: "poor",
    id: "v6-123",
    navigationType: "navigate",
    attribution: {
      interactionTarget: "nav>button.flex",
      interactionType: "pointer",
      inputDelay: 12.4,
      processingDuration: 38.2,
      presentationDelay: 362,
    },
    ...over,
  }) as any;

describe("buildInpEvent", () => {
  it("builds a GA4-friendly dataLayer event with whole-millisecond values", () => {
    expect(buildInpEvent(metric())).toEqual({
      event: "web_vitals",
      metric_name: "INP",
      metric_value: 413,
      metric_rating: "poor",
      metric_id: "v6-123",
      interaction_target: "nav>button.flex",
      interaction_type: "pointer",
      input_delay: 12,
      processing_duration: 38,
      presentation_delay: 362,
    });
  });

  it("caps the target selector so it fits a GA4 parameter (100 chars)", () => {
    const long = "div>".repeat(60) + "button";
    const ev = buildInpEvent(metric({ attribution: { ...metric().attribution, interactionTarget: long } }));
    expect(ev.interaction_target.length).toBeLessThanOrEqual(100);
    expect(ev.interaction_target.endsWith("button")).toBe(true);
  });

  it("reports an unknown target rather than an empty string", () => {
    const ev = buildInpEvent(metric({ attribution: { ...metric().attribution, interactionTarget: "" } }));
    expect(ev.interaction_target).toBe("(unknown)");
  });
});
