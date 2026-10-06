/**
 * CurrencySelector — menu for switching display currency.
 * Reads from / writes to CurrencyContext which persists choice in localStorage.
 * SelectMenu holds no state until opened (a Radix DropdownMenu re-rendered on every
 * page load to position itself).
 */

import { useCurrency, CURRENCIES } from '@/lib/currency-context';
import { Banknote, ChevronDown } from 'lucide-react';
import { SelectMenu } from '@/components/select-menu';

// Popular / regional groupings for the menu
const REGIONAL_CURRENCIES = [
  { code: 'VUV', label: 'Local (Vanuatu)' },
] as const;

const POPULAR_CURRENCIES = [
  'USD', 'AUD', 'NZD', 'EUR', 'GBP', 'JPY', 'FJD', 'XPF',
] as const;

const itemFor = (code: string, regional: boolean) => {
  const def = CURRENCIES[code as keyof typeof CURRENCIES];
  if (!def) return null;
  return {
    value: code,
    content: (
      <>
        <span className={regional ? "w-7 text-center font-semibold text-xs" : "w-7 text-center font-semibold text-xs text-muted-foreground"}>
          {regional ? def.symbol : code}
        </span>
        <span>{def.name}</span>
      </>
    ),
  };
};

const GROUPS = [
  { label: "Local Currency", items: REGIONAL_CURRENCIES.map(({ code }) => itemFor(code, true)).filter((i) => i !== null) },
  { label: "International", items: POPULAR_CURRENCIES.map((code) => itemFor(code, false)).filter((i) => i !== null) },
];

export function CurrencySelector({ compact = false }: { compact?: boolean }) {
  const { currency, currencyDef, setCurrency } = useCurrency();

  return (
    <SelectMenu
      value={currency}
      onSelect={(code) => setCurrency(code as any)}
      ariaLabel="Select display currency"
      menuClassName="w-52"
      groups={GROUPS}
      triggerContent={
        <>
          <Banknote className="h-3.5 w-3.5 shrink-0 opacity-70" />
          <span>{currencyDef.symbol}</span>
          {!compact && (
            // Same colour as the symbol, so it stays readable over the home hero.
            <span className="text-xs ml-0.5 opacity-80">{currency}</span>
          )}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </>
      }
    />
  );
}
