import { Link, useLocation } from "wouter";
import { Home, Compass, Car, ShoppingCart, Menu } from "lucide-react";
import { motion } from "framer-motion";
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
            className="material-chrome fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.28)] md:hidden"
            style={{ paddingBottom: "var(--safe-area-inset-bottom)" }}
            role="navigation"
            aria-label="Mobile navigation"
        >
            <div className="flex items-center justify-around h-16">
                {navItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        aria-current={isActive(item.href) ? "page" : undefined}
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
                            // The selection indicator is one element that travels
                            // between tabs, so the eye can follow where it went.
                            <motion.span
                                layoutId="bottom-nav-indicator"
                                className="pointer-events-none absolute top-0 left-[calc(50%-1rem)] h-0.5 w-8 rounded-full bg-primary"
                                transition={{ type: "spring", stiffness: 480, damping: 38, mass: 0.7 }}
                            />
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
