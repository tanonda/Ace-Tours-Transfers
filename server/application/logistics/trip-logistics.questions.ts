// Everything TypeSafe is asked about a booking's checkout text lives in this file: the state,
// the question wording, the criteria and the thresholds. Edit wording here and nowhere else.
//
// NOT YET TUNED: this wording has not been run against the live model (no API key at build time).
// Before switching the feature on, probe it with made-up example texts and adjust.

import type { NoulQuestion } from "../../infrastructure/typesafe/system-one.js";

/** Pinned so thresholds are not silently re-judged when the `jev-latest` alias moves. */
export const LOGISTICS_MODEL = "jev-1.14.0";

/** A probability at or above YES reads as yes, at or below NO as no; between them is "unsure". */
export const YES = 0.7;
export const NO = 0.3;

export const LOGISTICS_QUESTIONS = {
  pickup_place: {
    type: "noul",
    instructions: "Does the guest name a place where a driver can collect them?",
    criteria: {
      true: "The guest names a hotel, resort, guesthouse, street address, the airport, the wharf or a cruise ship.",
      false: "The guest names no place, or says they do not know yet where they will be.",
    },
  },
  flight_number: {
    type: "noul",
    instructions: "Does the guest give a flight number?",
    criteria: {
      true: "The guest writes an airline flight code, such as NF10 or QF 107.",
      false: "The guest writes no flight code. An arrival time or an airline name on its own is not a flight number.",
    },
  },
  dietary: {
    type: "noul",
    instructions: "Does the guest mention a food allergy or a dietary requirement?",
    criteria: {
      true: "The guest says someone is vegetarian, vegan, coeliac, halal, kosher, or allergic to a food.",
      false: "The guest says nothing about what anyone can or cannot eat.",
    },
  },
  limited_mobility: {
    type: "noul",
    instructions: "Does the guest say that someone in their group has limited mobility?",
    criteria: {
      true: "Someone uses a wheelchair, walker or cane, cannot manage steps, or has trouble walking.",
      false: "The guest says nothing about anyone's ability to walk or climb steps.",
    },
  },
  child_seat: {
    type: "noul",
    instructions: "Does the guest ask for a child car seat?",
    criteria: {
      true: "The guest asks for a baby seat, child seat, car seat or booster seat.",
      false: "The guest does not ask for a seat for a child. Mentioning a child without asking for a seat is not a request.",
    },
  },
} as const satisfies Record<string, NoulQuestion>;

export type LogisticsQuestionId = keyof typeof LOGISTICS_QUESTIONS;

export type LogisticsText = { pickupLocation: string; notes: string; productName: string };

/**
 * The state the questions are asked about. Only what a person would need to look at:
 * no guest name, email or phone. An empty box is left out rather than sent as an empty string.
 */
export function buildLogisticsState(text: LogisticsText): Record<string, string> {
  const state: Record<string, string> = {
    context:
      "A guest booked with a tour and transfer company in Port Vila, Vanuatu. " +
      "At checkout they filled in the text boxes below.",
    service_booked: text.productName,
  };
  if (text.pickupLocation) state.pickup_hotel_or_flight_box = text.pickupLocation;
  if (text.notes) state.special_requests_box = text.notes;
  return state;
}
