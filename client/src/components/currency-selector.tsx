/**
 * CurrencySelector — dropdown for switching display currency.
 * Reads from / writes to CurrencyContext which persists choice in localStorage.
 */

import { useCurrency, CURRENCIES } from '@/lib/currency-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Check, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

// Popular / regional groupings for the menu
const REGIONAL_CURRENCIES = [
  { code: 'VUV', label: 'Local (Vanuatu)' },
] as const;

const POPULAR_CURRENCIES = [
  'USD', 'AUD', 'NZD', 'EUR', 'GBP', 'JPY', 'FJD', 'XPF',
] as const;

export function CurrencySelector({ compact = false }: { compact?: boolean }) {
  const { currency, currencyDef, setCurrency } = useCurrency();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-1.5 h-9 px-2.5 font-medium text-sm"
          aria-label="Select display currency"
        >
          <Globe className="h-3.5 w-3.5 shrink-0 opacity-70" />
          <span>{currencyDef.symbol}</span>
          {!compact && (
            <span className="text-muted-foreground text-xs ml-0.5">{currency}</span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide pb-1">
          Local Currency
        </DropdownMenuLabel>

        {REGIONAL_CURRENCIES.map(({ code }) => {
          const def = CURRENCIES[code];
          return (
            <DropdownMenuItem
              key={code}
              onClick={() => setCurrency(code as any)}
              className="flex items-center justify-between cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <span className="w-7 text-center font-semibold text-xs">{def.symbol}</span>
                <span>{def.name}</span>
              </span>
              {currency === code && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide pb-1">
          International
        </DropdownMenuLabel>

        {POPULAR_CURRENCIES.map((code) => {
          const def = CURRENCIES[code];
          if (!def) return null;
          return (
            <DropdownMenuItem
              key={code}
              onClick={() => setCurrency(code as any)}
              className={cn(
                'flex items-center justify-between cursor-pointer',
                currency === code && 'bg-accent'
              )}
            >
              <span className="flex items-center gap-2">
                <span className="w-7 text-center font-semibold text-xs text-muted-foreground">{code}</span>
                <span>{def.name}</span>
              </span>
              {currency === code && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
