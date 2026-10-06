/**
 * < and > never belong in a person's name, and a name containing them is how markup
 * gets into staff print-outs, emails and the admin dashboard. Every route that takes
 * a name refuses them with this message.
 */
export const PERSON_NAME_ERROR = "Names can't contain < or >.";

/** The error for a name containing < or >, or null. Absent names pass: each route has its own rule for those. */
export function invalidPersonName(name: unknown): string | null {
  return typeof name === "string" && /[<>]/.test(name) ? PERSON_NAME_ERROR : null;
}
