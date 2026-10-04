/**
 * Normalise a Vanuatu phone number from site settings, which hold it in mixed
 * forms ("+678 7114045", "7342389"). Adding "+678" to a value that already had
 * it produced dead tel: links (+678 678 …).
 */
export function vanuatuPhone(raw: string | null | undefined): { display: string; tel: string } | null {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00678")) digits = digits.slice(5);
  else if (digits.startsWith("678") && digits.length > 7) digits = digits.slice(3);

  const local = digits.length === 7 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : digits;
  return { display: `+678 ${local}`, tel: `tel:+678${digits}` };
}
