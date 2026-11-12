// The truth table: TypeSafe supplies judgments (probabilities), this file decides what they mean.
// Pure functions, no I/O.

import { NO, YES, type LogisticsQuestionId } from "./trip-logistics.questions.js";
import type { GuestNeed, LogisticsFlags } from "../../../shared/logistics-flags.js";

export type Judgment = "yes" | "no" | "unsure";
export type { GuestNeed, LogisticsFlags };

export function toJudgment(probability: number): Judgment {
  if (probability >= YES) return "yes";
  if (probability <= NO) return "no";
  return "unsure";
}

const STATUS = { yes: "given", no: "missing", unsure: "unclear" } as const;
const NEEDS: GuestNeed[] = ["dietary", "limited_mobility", "child_seat"];

/**
 * @param answers probability of "yes" per question, or null when the guest typed nothing at all
 *                (then nothing was asked, and both pickup and flight are simply missing).
 */
export function decideLogisticsFlags(
  answers: Record<LogisticsQuestionId, number> | null,
  facts: { requiresFlightInfo: boolean; model: string | null; now: Date },
): LogisticsFlags {
  const base = { model: facts.model, assessedAt: facts.now.toISOString() };
  if (!answers) {
    return { pickup: "missing", flight: facts.requiresFlightInfo ? "missing" : "not_needed", needs: [], checkNotes: [], ...base };
  }
  return {
    pickup: STATUS[toJudgment(answers.pickup_place)],
    flight: facts.requiresFlightInfo ? STATUS[toJudgment(answers.flight_number)] : "not_needed",
    needs: NEEDS.filter((n) => toJudgment(answers[n]) === "yes"),
    checkNotes: NEEDS.filter((n) => toJudgment(answers[n]) === "unsure"),
    ...base,
  };
}

/**
 * Staff are alerted when a booking that needs flight details does not clearly have them.
 * "unclear" alerts too: an unnecessary staff alert is cheap, a missed airport pickup is not.
 * Guests are never contacted automatically.
 */
export function shouldAlertStaff(flags: LogisticsFlags): boolean {
  return flags.flight === "missing" || flags.flight === "unclear";
}
