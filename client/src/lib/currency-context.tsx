import React, { createContext, useContext, useState, useEffect } from 'react';

type CurrencyCode = 'VUV' | 'USD' | 'AUD' | 'EUR';

interface CurrencyContextType {
    currency: CurrencyCode;
    setCurrency: (code: CurrencyCode) => void;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

const CURRENCY_STORAGE_KEY = 'ace-tours-currency';

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
    const [currency, setCurrencyState] = useState<CurrencyCode>('VUV');

    useEffect(() => {
        const stored = localStorage.getItem(CURRENCY_STORAGE_KEY);
        if (stored && ['VUV', 'USD', 'AUD', 'EUR'].includes(stored)) {
            setCurrencyState(stored as CurrencyCode);
        }
    }, []);

    const setCurrency = (code: CurrencyCode) => {
        setCurrencyState(code);
        localStorage.setItem(CURRENCY_STORAGE_KEY, code);
    };

    return (
        <CurrencyContext.Provider value={{ currency, setCurrency }}>
            {children}
        </CurrencyContext.Provider>
    );
}

export function useCurrency() {
    const context = useContext(CurrencyContext);
    if (context === undefined) {
        throw new Error('useCurrency must be used within a CurrencyProvider');
    }
    return context;
}
