import { Link, useLocation } from "wouter";
import { Home, Compass, Car, ShoppingCart, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/lib/cart-context";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useTranslation } from "react-i18next";

interface MobileNavProps {
    onMenuOpen?: () => void;
    menuContent?: React.ReactNode;
}

export function MobileBottomNav({ menuContent }: MobileNavProps) {
    const [location] = useLocation();
    const { itemCount } = useCart();
    const { t } = useTranslation();

    const navItems = [
        { href: "/", icon: Home, label: t("nav.home", "Home") },
        { href: "/tours", icon: Compass, label: t("nav.tours", "Tours") },
        { href: "/transfers", icon: Car, label: t("nav.transfers", "Transfers") },
        { href: "/cart", icon: ShoppingCart, label: t("cart.title", "Cart"), badge: itemCount > 0 ? itemCount : undefined },
    ];

    // Fix #25: Add word-boundary check — /cart should not match /cartography.
    // Require that startsWith match is followed by end-of-string or a slash.
    const isActive = (href: string) => {
        if (href === "/") return location === "/";
        return location === href || location.startsWith(href + "/");
    };

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur-lg border-t border-border shadow-lg"
            style={{ paddingBottom: "var(--safe-area-inset-bottom)" }}
            role="navigation"
            aria-label="Mobile navigation"
        >
            <div className="flex items-center justify-around h-16">
                {navItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "flex flex-col items-center justify-center flex-1 h-full touch-target touch-feedback relative",
                            "transition-colors duration-200",
                            isActive(item.href)
                                ? "text-primary"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <div className="relative">
                            <item.icon className="h-5 w-5" />
                            {item.badge !== undefined && (
                                <Badge
                                    className="absolute -top-2 -right-2 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-primary text-primary-foreground"
                                >
                                    {item.badge > 9 ? "9+" : item.badge}
                                </Badge>
                            )}
                        </div>
                        <span className="text-[10px] mt-1 font-medium">{item.label}</span>
                        {isActive(item.href) && (
                            <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
                        )}
                    </Link>
                ))}

                {/* Menu Button */}
                <Sheet>
                    <SheetTrigger asChild>
                        <button
                            className={cn(
                                "flex flex-col items-center justify-center flex-1 h-full touch-target touch-feedback",
                                "text-muted-foreground hover:text-foreground transition-colors duration-200"
                            )}
                            aria-label={t("accessibility.menuOpen", "Open menu")}
                        >
                            <Menu className="h-5 w-5" />
                            <span className="text-[10px] mt-1 font-medium">{t("nav.menu", "Menu")}</span>
                        </button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-[300px]" style={{ paddingBottom: "var(--safe-area-inset-bottom)" }}>
                        <SheetHeader className="sr-only">
                            <SheetTitle>{t("nav.menu", "Menu")}</SheetTitle>
                        </SheetHeader>
                        {menuContent}
                    </SheetContent>
                </Sheet>
            </div>
        </nav>
    );
}
