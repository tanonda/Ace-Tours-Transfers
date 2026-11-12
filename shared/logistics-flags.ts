// Staff flags derived from a booking's free-text pickup and special-request boxes.
// Written by server/application/logistics; read by the admin and driver screens.

export type GuestNeed = "dietary" | "limited_mobility" | "child_seat";

export type LogisticsFlags = {
  /** Has the guest told us where to collect them? */
  pickup: "given" | "missing" | "unclear";
  /** `not_needed` when the product does not require flight details. */
  flight: "given" | "missing" | "unclear" | "not_needed";
  /** False when the special-requests box was not read (pickup-only mode): `needs` is then always empty. */
  needsChecked: boolean;
  /** Needs the guest clearly stated. */
  needs: GuestNeed[];
  /** Needs that could not be settled either way: staff should read the notes. */
  checkNotes: GuestNeed[];
  /** Model that answered, or null when the text was empty and nothing was asked. */
  model: string | null;
  assessedAt: string;
};
