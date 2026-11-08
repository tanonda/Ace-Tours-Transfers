/**
 * CSV cell encoding that also neutralises spreadsheet formulas.
 *
 * A guest-controlled name or note beginning with =, +, -, @ (or a tab/CR) is
 * executed as a formula when staff open the export in Excel/Sheets. Prefixing
 * with an apostrophe keeps the text while Excel treats it as text.
 */
export function csvCell(value: unknown): string {
  const raw = String(value ?? "");
  const neutralised = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${neutralised.replace(/"/g, '""')}"`;
}

export function csvRow(values: readonly unknown[]): string {
  return values.map(csvCell).join(",");
}
