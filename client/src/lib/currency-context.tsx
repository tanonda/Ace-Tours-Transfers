/**
 * CurrencyContext — global currency selection with conversion utilities
 *
 * ARCHITECTURE:
 * - All product prices are stored in VUV (Vanuatu Vatu) in the database.
 * - VUV is a whole-unit currency (no cents sub-division at display level).
 * - The database stores amounts in "VUV integer units" (e.g. 7500 = VT 7,500).
 *   NOTE: legacy code stored prices in "cents * 100" — adultPriceCents=750000 meant VT 7,500.
 *   New code uses adultPriceCents where 1 unit = 1 VUV (so 7500 = VT 7,500).
 * - When displaying in a foreign currency, multiply by exchange rate then format.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ─── Currency Definitions ────────────────────────────────────────────────────

export interface CurrencyDef {
  code: string;
  symbol: string;
  name: string;
  /** Rate to convert FROM VUV TO this currency: displayAmount = vuvAmount * rate */
  rateFromVUV: number;
  /** Locale string for Intl.NumberFormat */
  locale: string;
  /** Whether this currency has no decimal subdivision */
  isWholeUnit: boolean;
}

export const CURRENCIES: Record<string, CurrencyDef> = {
  VUV: { code: 'VUV', symbol: 'VT', name: 'Vanuatu Vatu', rateFromVUV: 1, locale: 'en-VU', isWholeUnit: true },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', rateFromVUV: 0.0084, locale: 'en-US', isWholeUnit: false },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', rateFromVUV: 0.013, locale: 'en-AU', isWholeUnit: false },
  NZD: { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', rateFromVUV: 0.0141, locale: 'en-NZ', isWholeUnit: false },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', rateFromVUV: 0.0078, locale: 'fr-FR', isWholeUnit: false },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', rateFromVUV: 0.0066, locale: 'en-GB', isWholeUnit: false },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', rateFromVUV: 1.26, locale: 'ja-JP', isWholeUnit: true },
  FJD: { code: 'FJD', symbol: 'FJ$', name: 'Fijian Dollar', rateFromVUV: 0.019, locale: 'en-FJ', isWholeUnit: false },
  XPF: { code: 'XPF', symbol: 'CFP', name: 'CFP Franc (New Cal)', rateFromVUV: 0.93, locale: 'fr-FR', isWholeUnit: true },
};

export type CurrencyCode = keyof typeof CURRENCIES;

// ─── Formatting Utility ──────────────────────────────────────────────────────

export function formatInCurrency(vuvAmount: number, currency: CurrencyCode | string = 'VUV'): string {
  const def = CURRENCIES[currency.toUpperCase()] ?? CURRENCIES.VUV;
  const displayAmount = vuvAmount * def.rateFromVUV;

  try {
    return new Intl.NumberFormat(def.locale, {
      style: 'currency',
      currency: def.code,
      minimumFractionDigits: def.isWholeUnit ? 0 : 2,
      maximumFractionDigits: def.isWholeUnit ? 0 : 2,
    }).format(displayAmount);
  } catch {
    const fixed = def.isWholeUnit ? Math.round(displayAmount).toString() : displayAmount.toFixed(2);
    return `${def.symbol} ${fixed}`;
  }
}

// ─── Fetch Live Rates API ────────────────────────────────────────────────────

export async function fetchLatestExchangeRates() {
  try {
    // Use the free, open-source currency API CDN which updates daily
    const res = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/vuv.json');
    if (!res.ok) throw new Error("Network response was not ok");
    const data: any = await res.json();
    if (data?.vuv) {
      for (const [code, def] of Object.entries(CURRENCIES)) {
        const lowerCode = code.toLowerCase();
        if (data.vuv[lowerCode]) {
          // Update in-place so all synchronous formatters get the new rate
          def.rateFromVUV = data.vuv[lowerCode];
        }
      }
      return true;
    }
  } catch (err) {
    console.error("Failed to fetch live exchange rates, falling back to static rates", err);
  }
  return false;
}

/**
 * Convert VUV amount to the target currency's numeric value (for calculations).
 */
export function convertFromVUV(vuvAmount: number, currency: CurrencyCode | string): number {
  const def = CURRENCIES[currency.toUpperCase()] ?? CURRENCIES.VUV;
  return vuvAmount * def.rateFromVUV;
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface CurrencyContextType {
  currency: CurrencyCode;
  currencyDef: CurrencyDef;
  setCurrency: (code: CurrencyCode) => void;
  /** Format a VUV integer amount in the currently selected currency */
  format: (vuvAmount: number) => string;
  /** Get numeric value of a VUV amount in the current currency */
  convert: (vuvAmount: number) => number;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);
const STORAGE_KEY = 'ace-tours-currency';

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>('VUV');
  const [ratesLoaded, setRatesLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && CURRENCIES[stored]) {
      setCurrencyState(stored as CurrencyCode);
    }

    // Fetch live rates on mount
    fetchLatestExchangeRates().then((success) => {
      if (success) setRatesLoaded(true); // Triggers re-render with new rates
    });
  }, []);

  const setCurrency = useCallback((code: CurrencyCode) => {
    if (!CURRENCIES[code]) return;
    setCurrencyState(code);
    localStorage.setItem(STORAGE_KEY, code);
  }, []);

  const currencyDef = CURRENCIES[currency];

  const format = useCallback(
    (vuvAmount: number) => formatInCurrency(vuvAmount, currency),
    [currency]
  );

  const convert = useCallback(
    (vuvAmount: number) => convertFromVUV(vuvAmount, currency),
    [currency]
  );

  return (
    <CurrencyContext.Provider value={{ currency, currencyDef, setCurrency, format, convert }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within a CurrencyProvider');
  return ctx;
}
