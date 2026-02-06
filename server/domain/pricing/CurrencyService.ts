
export interface CurrencyExchangeRate {
    code: string;
    rate: number; // Rate relative to VUV (e.g., USD rate = 0.0084 means 1 VUV = 0.0084 USD)
    symbol: string;
}

export class CurrencyService {
    // Static rates for demonstration (In production, these would fetch from an API)
    private static rates: Record<string, CurrencyExchangeRate> = {
        VUV: { code: 'VUV', rate: 1, symbol: 'VT' },
        USD: { code: 'USD', rate: 0.0084, symbol: '$' },
        AUD: { code: 'AUD', rate: 0.013, symbol: 'A$' },
        EUR: { code: 'EUR', rate: 0.0078, symbol: '€' },
    };

    /**
     * Convert VUV cents to target currency amount
     */
    public static convertFromVatu(vatuCents: number, targetCurrency: string): number {
        const exchange = this.rates[targetCurrency.toUpperCase()] || this.rates.VUV;
        // vatuCents / 100 = Vatu amount
        // Vatu amount * exchange.rate = target currency amount
        return (vatuCents / 100) * exchange.rate;
    }

    /**
     * Get all supported currencies
     */
    public static getSupportedCurrencies(): CurrencyExchangeRate[] {
        return Object.values(this.rates);
    }

    /**
     * Get symbol for currency
     */
    public static getSymbol(code: string): string {
        return this.rates[code.toUpperCase()]?.symbol || 'VT';
    }
}
