/**
 * Field responsiveness (INP) from real visitors, pushed to the GTM dataLayer
 * like the booking events. GTM forwards it with a "GA4 Event" tag
 * (Custom Event trigger: web_vitals, parameters from the data layer).
 *
 * The attribution build adds which element was tapped and where the time went
 * (input delay / handlers / rendering), so a slow menu tap shows up as
 * `nav>button…` with a large presentation_delay.
 */
import type { INPMetricWithAttribution } from "web-vitals/attribution";

// GA4 truncates event parameter values at 100 characters.
const GA4_PARAM_MAX = 100;

export function buildInpEvent(metric: INPMetricWithAttribution) {
  const a = metric.attribution;
  // Keep the end of the selector: the element itself matters more than its ancestors.
  const target = a.interactionTarget || "(unknown)";
  return {
    event: "web_vitals",
    metric_name: metric.name,
    metric_value: Math.round(metric.value),
    metric_rating: metric.rating,
    metric_id: metric.id,
    interaction_target: target.length > GA4_PARAM_MAX ? target.slice(-GA4_PARAM_MAX) : target,
    interaction_type: a.interactionType,
    input_delay: Math.round(a.inputDelay),
    processing_duration: Math.round(a.processingDuration),
    presentation_delay: Math.round(a.presentationDelay),
  };
}

/** Loaded lazily after first paint so it never competes with the page itself. */
export async function startInpReporting() {
  const { onINP } = await import("web-vitals/attribution");
  onINP((metric) => {
    const w = window as unknown as { dataLayer?: unknown[] };
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push(buildInpEvent(metric));
  });
}
