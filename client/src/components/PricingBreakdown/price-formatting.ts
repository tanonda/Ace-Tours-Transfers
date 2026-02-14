export function formatCurrency(amountCents: number, currency: string = '€'): string {
  const amountEuros = amountCents / 100;
  return `${currency}${amountEuros.toFixed(2)}`;
}

export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function centsToEuros(amountCents: number): number {
  return amountCents / 100;
}

export function eurosToCents(amountEuros: number): number {
  return Math.round(amountEuros * 100);
}
