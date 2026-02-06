import { useCurrency } from "@/lib/currency-context";
import { EXCHANGE_RATES } from "@/lib/product.types";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

export function CurrencySelector() {
    const { currency, setCurrency } = useCurrency();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    <span>{currency}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {Object.entries(EXCHANGE_RATES).map(([code, { symbol }]) => (
                    <DropdownMenuItem
                        key={code}
                        onClick={() => setCurrency(code as any)}
                        className={currency === code ? "bg-accent" : ""}
                    >
                        <span className="font-medium mr-2">{code}</span>
                        <span className="text-muted-foreground">({symbol})</span>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
