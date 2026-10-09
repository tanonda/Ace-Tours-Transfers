/** Public author name for a review row. Verified reviews store the public display name ("Sarah M.") in guestName. */
export function reviewAuthorName(
  r: { verified?: boolean | null; isGuest?: boolean | null; guestName?: string | null; userName?: string | null },
  fallbacks: { guest: string; account: string },
): string {
  if (r.verified && r.guestName) return r.guestName;
  return r.isGuest ? (r.guestName || fallbacks.guest) : (r.userName || fallbacks.account);
}
