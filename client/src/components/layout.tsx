import { Link, useLocation } from "wouter";
import { useState, useEffect, forwardRef } from "react";
import { Menu, Phone, Mail, Instagram, Facebook, X, ChevronRight, ShoppingCart, User, LogIn, LogOut, UserPlus, Home, Map, Car, Info, MessageSquare, Calendar, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NewsletterForm } from "@/components/newsletter-form";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
const logo = "https://res.cloudinary.com/dwro1dh5q/image/upload/v1765063924/ace-tours-assets/ace_tours_logo_official.jpg";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { fetchTours, fetchVehicles, fetchSiteSettings } from "@/lib/api";
import { useCart } from "@/lib/cart-context";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSelector } from "@/components/language-selector";
import { CurrencySelector } from "@/components/currency-selector";
import { useTranslation } from "react-i18next";
import { SkipLinks } from "@/components/skip-links";
import { useCMS } from "@/lib/cms-context";
import { useCmsText } from "@/hooks/use-cms-text";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { useAuth } from "@/lib/auth-context";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const ListItem = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div"> & { href: string; title: string }
>(({ className, title, children, href, ...props }, ref) => {
  return (
    <li>
      <Link href={href}>
        <div
          ref={ref}
          className={cn(
            "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground cursor-pointer",
            className
          )}
          {...props}
        >
          <div className="text-sm font-medium leading-none">{title}</div>
          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
            {children}
          </p>
        </div>
      </Link>
    </li>
  )
})
ListItem.displayName = "ListItem"

export function Layout({ children }: { children: React.ReactNode }) {
  const { data: allTours = [] } = useQuery({
    queryKey: ["tours"],
    queryFn: fetchTours,
  });

  const { data: allVehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: fetchVehicles,
  });

  const { data: settings = [] } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSiteSettings,
  });

  const getSetting = (key: string, fallback: string = "") => {
    const setting = settings.find((s) => s.key === key);
    if (!setting || setting.value == null) return fallback;
    // CMS values may be stored as JSON strings, plain strings, or objects.
    // Only return a string; objects would render as [object Object].
    const v = setting.value;
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    return fallback;
  };

  const contactEmail = getSetting("contact_email", "acetoursvanuatu@outlook.com");
  const contactPhone = getSetting("contact_phone", "7114045");
  const whatsappNumber = getSetting("whatsapp_number", "7342389");
  const facebookUrl = getSetting("social_facebook", "https://www.facebook.com/share/16xVyw7m7m/");
  const instagramUrl = getSetting("social_instagram", "https://www.instagram.com/acetoursvanuatu/");
  const contactAddress = getSetting("contact_address", "Port Vila, Vanuatu");

  const footerBacklinksRaw = getSetting("footer_backlinks", "Vanuatu Tourism Office (VTO) | https://www.vanuatu.travel/\nAce Tours (Primary Site) | https://www.acetoursvanuatu.com/");
  const footerBacklinks = footerBacklinksRaw.split("\n").filter(Boolean).map(line => {
    const [label, url] = line.split("|").map(s => s.trim());
    return { label, url };
  });

  // Deduplicate tours by normalized title to handle DB duplicates and naming variations
  const uniqueTours = allTours.reduce<typeof allTours>((acc, current) => {
    const normalize = (t: string) => t.replace(/\s+Package$/i, "").trim();
    const normalizedTitle = normalize(current.title);

    const existingIndex = acc.findIndex(item => normalize(item.title) === normalizedTitle);

    if (existingIndex === -1) {
      acc.push(current);
    } else if (current.isActive !== false && acc[existingIndex].isActive === false) {
      // Prioritize active product over inactive product with same title
      acc[existingIndex] = current;
    }
    return acc;
  }, []);

  const tours = uniqueTours.filter(t => t.category === "tour" && t.isActive !== false);
  const transfers = uniqueTours.filter(t => t.category === "transfer" && t.isActive !== false);

  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toursOpen, setToursOpen] = useState(false);
  const [transfersOpen, setTransfersOpen] = useState(false);
  const [bookingsOpen, setBookingsOpen] = useState(false);
  const [location] = useLocation();
  const { itemCount } = useCart();
  const { t } = useTranslation();
  const { isBlockEnabled } = useCMS();
  const footerCms = useCmsText("footer");
  const { user, logout } = useAuth();
  const isHome = location === "/";
  const showNewsletter = isBlockEnabled('newsletter');
  const showVehicleHire = isBlockEnabled('vehicle-hire');

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    setToursOpen(false);
    setTransfersOpen(false);
    setBookingsOpen(false);
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isTransparent = isHome && !isScrolled;

  const navTextColor = isTransparent ? "text-white hover:text-white/80" : "text-foreground hover:text-primary";
  const logoTextColor = isTransparent ? "text-white" : "text-foreground";
  const mobileButtonColor = isTransparent ? "text-white" : "text-foreground";

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans text-foreground">
      <SkipLinks />

      <header
        id="main-navigation"
        role="banner"
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled
          ? "bg-background/95 backdrop-blur-md shadow-sm border-b border-border/50"
          : isHome
            ? "bg-transparent"
            : "bg-background/95 backdrop-blur-md"
          }`}
      >
        <div className={`transition-all duration-300 ${isScrolled ? "hidden" : "block"}`}>
          <div className={`container mx-auto px-4 py-2 flex flex-col md:flex-row items-center justify-between text-sm ${isTransparent ? "text-white/90" : "text-muted-foreground"}`}>
            <p className={`italic font-medium ${isTransparent ? "text-white" : "text-foreground"}`}>
              "{t("app.tagline")}"
            </p>
            <div className="flex items-center gap-4 mt-1 md:mt-0">
              <a href={`tel:+678${contactPhone.replace(/\D/g, '')}`} className={`flex items-center gap-1.5 hover:text-primary transition-colors ${isTransparent ? "hover:text-white" : ""}`}>
                <Phone className="h-3.5 w-3.5" />
                <span>{contactPhone}</span>
              </a>
              <span className={isTransparent ? "text-white/50" : "text-muted-foreground/50"}>|</span>
              <a href={`mailto:${contactEmail}`} className={`flex items-center gap-1.5 hover:text-primary transition-colors ${isTransparent ? "hover:text-white" : ""}`}>
                <Mail className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{contactEmail}</span>
                <span className="sm:hidden">{t("nav.emailUs", "Email Us")}</span>
              </a>
            </div>
          </div>
        </div>

        <div className={`container mx-auto px-4 flex items-center justify-between transition-all duration-300 ${isScrolled ? "py-1" : "pt-1 pb-1"}`}>
          {/* Mobile hamburger - left side */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button
                variant="ghost"
                size="icon"
                className={mobileButtonColor}
                aria-label={t("accessibility.menuOpen")}
                data-testid="button-mobile-menu"
              >
                <Menu className="h-6 w-6" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[85vw] max-w-[320px] p-0 overflow-hidden"
              data-testid="mobile-menu-panel"
            >
              <div className="bg-primary text-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={logo}
                    alt="Ace Tours Logo"
                    className="h-10 w-10 rounded-full border-2 border-white/30"
                  />
                  <span className="font-serif font-bold text-lg">{t("app.shortTitle", "Ace Tours")}</span>
                </div>
                <SheetClose asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                    data-testid="button-close-mobile-menu"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </SheetClose>
              </div>

              <div className="bg-muted/50 p-4 border-b border-border">
                {user ? (
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{user.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <Link href={user.role === 'admin' ? '/admin/dashboard' : '/dashboard'} onClick={closeMobileMenu}>
                      <Button variant="outline" size="sm" data-testid="button-mobile-dashboard">
                        {t("nav.dashboard")}
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    {/* Guest accounts are disabled. Guests access via reference ID in Manage Bookings. */}
                  </div>
                )}
              </div>

              <div className="overflow-y-auto h-[calc(100vh-200px)]">
                <nav className="p-2">
                  <Link
                    href="/"
                    onClick={closeMobileMenu}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted transition-colors"
                    data-testid="mobile-nav-home"
                  >
                    <Home className="h-5 w-5 text-primary" />
                    <span className="font-medium">{t("nav.home")}</span>
                  </Link>

                  <Collapsible open={toursOpen} onOpenChange={setToursOpen}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 rounded-lg hover:bg-muted transition-colors">
                      <div className="flex items-center gap-3">
                        <Map className="h-5 w-5 text-primary" />
                        <span className="font-medium">{t("nav.tours")}</span>
                      </div>
                      <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", toursOpen && "rotate-180")} />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-12 pr-4 pb-2 space-y-1">
                      {tours.map((tour) => (
                        <Link
                          key={tour.id}
                          href={`/tours/${tour.id}`}
                          onClick={closeMobileMenu}
                          className="flex items-center gap-2 py-2 px-3 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                        >
                          <ChevronRight className="h-3 w-3" />
                          {tour.title}
                        </Link>
                      ))}
                      <Link
                        href="/tours"
                        onClick={closeMobileMenu}
                        className="flex items-center gap-2 py-2 px-3 rounded-md text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
                      >
                        {t("nav.viewAllTours")}
                      </Link>
                    </CollapsibleContent>
                  </Collapsible>

                  <Collapsible open={transfersOpen} onOpenChange={setTransfersOpen}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 rounded-lg hover:bg-muted transition-colors">
                      <div className="flex items-center gap-3">
                        <Car className="h-5 w-5 text-primary" />
                        <span className="font-medium">{t("nav.transfers")}</span>
                      </div>
                      <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", transfersOpen && "rotate-180")} />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-12 pr-4 pb-2 space-y-1">
                      {transfers.map((transfer) => (
                        <Link
                          key={transfer.id}
                          href={`/transfers/${transfer.id}`}
                          onClick={closeMobileMenu}
                          className="flex items-center gap-2 py-2 px-3 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                        >
                          <ChevronRight className="h-3 w-3" />
                          {transfer.title}
                        </Link>
                      ))}
                      <Link
                        href="/transfers"
                        onClick={closeMobileMenu}
                        className="flex items-center gap-2 py-2 px-3 rounded-md text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
                      >
                        {t("nav.viewAllTransfers")}
                      </Link>
                    </CollapsibleContent>
                  </Collapsible>
                  {showVehicleHire && (
                    <Link
                      href="/vehicles"
                      onClick={closeMobileMenu}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted transition-colors"
                      data-testid="mobile-nav-vehicles"
                    >
                      <Car className="h-5 w-5 text-primary" />
                      <span className="font-medium">{t("nav.vehicleHire", "Vehicle Hire")}</span>
                    </Link>
                  )}
                  <Link
                    href="/about"
                    onClick={closeMobileMenu}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted transition-colors"
                    data-testid="mobile-nav-about"
                  >
                    <Info className="h-5 w-5 text-primary" />
                    <span className="font-medium">{t("nav.about")}</span>
                  </Link>

                  <Link
                    href="/contact"
                    onClick={closeMobileMenu}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted transition-colors"
                    data-testid="mobile-nav-contact"
                  >
                    <MessageSquare className="h-5 w-5 text-primary" />
                    <span className="font-medium">{t("nav.contact")}</span>
                  </Link>

                  <Collapsible open={bookingsOpen} onOpenChange={setBookingsOpen}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 rounded-lg hover:bg-muted transition-colors">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-primary" />
                        <span className="font-medium">{t("nav.myBookings")}</span>
                      </div>
                      <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", bookingsOpen && "rotate-180")} />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-12 pr-4 pb-2 space-y-1">
                      <Link
                        href="/manage-booking"
                        onClick={closeMobileMenu}
                        className="flex items-center gap-2 py-2 px-3 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      >
                        <ChevronRight className="h-3 w-3" />
                        {t("nav.editTrip")}
                      </Link>
                      <Link
                        href="/reservations"
                        onClick={closeMobileMenu}
                        className="flex items-center gap-2 py-2 px-3 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      >
                        <ChevronRight className="h-3 w-3" />
                        {t("nav.bookRide")}
                      </Link>
                    </CollapsibleContent>
                  </Collapsible>

                  <Link
                    href="/cart"
                    onClick={closeMobileMenu}
                    className="flex items-center justify-between px-4 py-3 rounded-lg hover:bg-muted transition-colors"
                    data-testid="mobile-nav-cart"
                  >
                    <div className="flex items-center gap-3">
                      <ShoppingCart className="h-5 w-5 text-primary" />
                      <span className="font-medium">{t("cart.title")}</span>
                    </div>
                    {itemCount > 0 && (
                      <Badge variant="default" className="bg-primary text-white">
                        {itemCount}
                      </Badge>
                    )}
                  </Link>

                  <div className="my-3 border-t border-border" />

                  <div className="px-4 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      {t("common.settings", "Settings")}
                    </p>
                  </div>

                  <div className="flex items-center justify-between px-4 py-3 rounded-lg hover:bg-muted transition-colors">
                    <span className="font-medium">Currency</span>
                    <CurrencySelector />
                  </div>

                  <div className="flex items-center justify-between px-4 py-3 rounded-lg hover:bg-muted transition-colors">
                    <span className="font-medium">{t("common.language")}</span>
                    <LanguageSelector />
                  </div>

                  <div className="flex items-center justify-between px-4 py-3 rounded-lg hover:bg-muted transition-colors">
                    <span className="font-medium">{t("common.theme")}</span>
                    <ThemeToggle size="md" />
                  </div>

                  {user && (
                    <button
                      onClick={() => {
                        logout();
                        closeMobileMenu();
                      }}
                      className="flex items-center gap-3 w-full px-4 py-3 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                      data-testid="button-mobile-logout"
                    >
                      {/* Fix #28: Use LogOut icon (not rotated LogIn) for correct semantic meaning */}
                      <LogOut className="h-5 w-5" />
                      <span className="font-medium">{t("nav.logout")}</span>
                    </button>
                  )}
                </nav>

                <div className="p-4 border-t border-border">
                  <Link href="/reservations?tab=book-new" onClick={closeMobileMenu}>
                    <Button size="lg" className="w-full font-semibold shadow-lg" data-testid="button-mobile-book-now">
                      {t("tour.bookNow")}
                    </Button>
                  </Link>
                </div>

                <div className="p-4 bg-muted/30 border-t border-border">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    {t("footer.contactUs")}
                  </p>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <a href={`tel:+678${contactPhone.replace(/\D/g, '')}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                      <Phone className="h-4 w-4" />
                      <span>{contactPhone}</span>
                    </a>
                    <a href={`mailto:${contactEmail}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                      <Mail className="h-4 w-4" />
                      <span className="truncate">{contactEmail}</span>
                    </a>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <a href={facebookUrl} target="_blank" rel="noopener noreferrer" className="bg-muted p-2 rounded-full hover:bg-primary hover:text-white transition-colors">
                      <Facebook className="h-4 w-4" />
                    </a>
                    <a href={instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Follow us on Instagram" className="bg-muted p-2 rounded-full hover:bg-primary hover:text-white transition-colors">
                      <Instagram className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <Link href="/" className="flex items-center gap-3">
            <img
              src={logo}
              alt="Ace Tours Logo"
              className={`rounded-full shadow-lg border-2 transition-all duration-300 ${isTransparent ? "border-white/30" : "border-primary/30"
                } ${isScrolled ? "h-10 w-10" : "h-14 w-14 md:h-16 md:w-16"}`}
            />
            <span className={`font-serif font-bold tracking-tight transition-all duration-300 ${logoTextColor} ${isScrolled ? "text-base" : "text-lg md:text-xl"
              }`}>
              Ace Tours & Transfers
            </span>
          </Link>

          {/* Spacer for mobile to balance hamburger on the left */}
          <div className="w-10 md:hidden" />
        </div>

        <div className={`container mx-auto px-4 flex items-center justify-center transition-all duration-300 ${isScrolled ? "pb-1" : "pb-2"}`}>
          <nav className="hidden md:flex items-center gap-6" aria-label="Main navigation">
            <NavigationMenu className="relative z-50">
              <NavigationMenuList>
                <NavigationMenuItem>
                  <Link href="/" className={cn(
                    "group inline-flex h-9 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none disabled:pointer-events-none disabled:opacity-50",
                    navTextColor
                  )}>
                    {t("nav.home")}
                  </Link>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>

            <NavigationMenu className="relative z-50">
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuTrigger className={cn("bg-transparent hover:bg-transparent focus:bg-transparent data-[state=open]:bg-transparent", navTextColor)}>
                    {t("nav.tours")}
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                      {tours.map((tour) => (
                        <ListItem
                          key={tour.id}
                          title={tour.title}
                          href={`/tours/${tour.id}`}
                        >
                          {tour.description[0]}
                        </ListItem>
                      ))}
                      <ListItem href="/tours" title={t("nav.viewAllTours")} className="bg-muted/50">
                        {t("nav.seeAllTours")}
                      </ListItem>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>

            <NavigationMenu className="relative z-50">
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuTrigger className={cn("bg-transparent hover:bg-transparent focus:bg-transparent data-[state=open]:bg-transparent", navTextColor)}>
                    {t("nav.transfers")}
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                      {transfers.map((transfer) => (
                        <ListItem
                          key={transfer.id}
                          title={transfer.title}
                          href={`/transfers/${transfer.id}`}
                        >
                          {transfer.description}
                        </ListItem>
                      ))}
                      <ListItem href="/transfers" title={t("nav.viewAllTransfers")} className="bg-muted/50">
                        {t("nav.seeAllTransfers")}
                      </ListItem>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>

            {showVehicleHire && (
              <NavigationMenu className="relative z-50">
                <NavigationMenuList>
                  <NavigationMenuItem>
                    <NavigationMenuTrigger className={cn("bg-transparent hover:bg-transparent focus:bg-transparent data-[state=open]:bg-transparent", navTextColor)}>
                      {t("nav.vehicleHire", "Vehicle Hire")}
                    </NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                        {allVehicles.filter(v => v.isActive !== false).map((vehicle) => (
                          <ListItem
                            key={vehicle.id}
                            title={vehicle.title}
                            href={`/vehicles/${vehicle.id}`}
                          >
                            {Array.isArray(vehicle.description) ? vehicle.description[0] : vehicle.description}
                          </ListItem>
                        ))}
                        <ListItem href="/vehicles" title={t("nav.viewAllVehicles", "View All Vehicles")} className="bg-muted/50">
                          {t("nav.seeAllVehicles", "Browse our full fleet")}
                        </ListItem>
                      </ul>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>
            )}

            <NavigationMenu className="relative z-50">
              <NavigationMenuList>
                <NavigationMenuItem>
                  <Link href="/about" className={cn(
                    "group inline-flex h-9 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none disabled:pointer-events-none disabled:opacity-50",
                    navTextColor
                  )}>
                    {t("nav.about")}
                  </Link>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>

            <NavigationMenu className="relative z-50">
              <NavigationMenuList>
                <NavigationMenuItem>
                  <Link href="/contact" className={cn(
                    "group inline-flex h-9 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none disabled:pointer-events-none disabled:opacity-50",
                    navTextColor
                  )}>
                    {t("nav.contact")}
                  </Link>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>

            <NavigationMenu className="relative z-50">
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuTrigger className={cn("bg-transparent hover:bg-transparent focus:bg-transparent data-[state=open]:bg-transparent", navTextColor)}>
                    {t("nav.myBookings")}
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[200px] gap-2 p-4">
                      <ListItem href="/manage-booking" title={t("nav.editTrip")}>
                        {t("nav.manageBookings", "Manage or cancel existing bookings")}
                      </ListItem>
                      <ListItem href="/reservations" title={t("nav.bookRide")}>
                        {t("nav.startNewBooking", "Start a new booking")}
                      </ListItem>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>

            <div className="ml-2 flex items-center gap-4">
              <CurrencySelector />
              <LanguageSelector />
              <ThemeToggle size="sm" />
              <Link href="/reservations?tab=book-new">
                <Button size="lg" className="font-semibold shadow-lg">{t("tour.bookNow")}</Button>
              </Link>
            </div>
          </nav>
        </div>
      </header>

      <main id="main-content" role="main" className="flex-grow has-bottom-nav" tabIndex={-1}>
        {children}
      </main>

      <footer role="contentinfo" className="bg-[#291B12] text-white pt-16 pb-24 md:pb-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <img src={logo} alt="Ace Tours Logo" className="h-10 w-auto rounded-full border-2 border-white/20" />
                <span className="font-serif font-bold text-xl">Ace Tours</span>
              </div>
              <p className="text-white/70 leading-relaxed mb-6">
                {footerCms.text("description", t("footer.description"))}
              </p>
              <div className="flex gap-4">
                <a href={facebookUrl} target="_blank" rel="noopener noreferrer" className="bg-white/10 p-2 rounded-full hover:bg-primary transition-colors">
                  <Facebook className="h-5 w-5" />
                </a>
                <a href={instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Follow us on Instagram" className="bg-white/10 p-2 rounded-full hover:bg-primary transition-colors">
                  <Instagram className="h-5 w-5" />
                </a>
              </div>
            </div>

            <div>
              <h3 className="font-serif text-lg font-semibold mb-6 text-primary">{t("footer.quickLinks")}</h3>
              <ul className="space-y-3">
                <li><Link href="/" className="text-white/70 hover:text-white transition-colors">{t("nav.home")}</Link></li>
                <li><Link href="/tours" className="text-white/70 hover:text-white transition-colors">{t("nav.tours")}</Link></li>
                <li><Link href="/transfers" className="text-white/70 hover:text-white transition-colors">{t("nav.transfers")}</Link></li>
                <li><Link href="/about" className="text-white/70 hover:text-white transition-colors">{t("nav.about")}</Link></li>
                <li><Link href="/contact" className="text-white/70 hover:text-white transition-colors">{t("nav.contact")}</Link></li>
                <li><Link href="/faq" className="text-white/70 hover:text-white transition-colors">FAQ</Link></li>
                {footerBacklinks.map((link, i) => (
                  <li key={i}><a href={link.url} target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white transition-colors">{link.label}</a></li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-serif text-lg font-semibold mb-6 text-primary">{t("footer.contactUs", "Contact Us")}</h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="text-white/70">
                    <p>
                      <a href={`tel:+678${contactPhone.replace(/\D/g, '')}`} className="hover:text-white transition-colors">{contactPhone}</a>
                      {" / "}
                      <a href={`tel:+678${whatsappNumber.replace(/\D/g, '')}`} className="hover:text-white transition-colors">{whatsappNumber}</a>
                    </p>
                    <p className="text-sm opacity-60">{t("footer.available247", "Available 24/7")}</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <a href={`mailto:${contactEmail}`} className="text-white/70 hover:text-white">
                    {contactEmail}
                  </a>
                </li>
                <li className="text-white/70">
                  <p className="font-medium text-white mb-1">{t("footer.address", "Address")}:</p>
                  {contactAddress}
                </li>
              </ul>
            </div>
          </div>

          {showNewsletter && (
            <div className="border-t border-white/10 py-8 mb-8">
              <div className="max-w-md mx-auto text-center">
                <h3 className="font-serif text-xl font-semibold mb-2 text-white">
                  {t("newsletter.footerTitle", "Stay Updated")}
                </h3>
                <p className="text-white/70 text-sm mb-4">
                  {t("newsletter.footerDesc", "Subscribe to our newsletter for exclusive deals and travel tips")}
                </p>
                <NewsletterForm source="footer" variant="inline" />
              </div>
            </div>
          )}

          <div className="border-t border-white/10 pt-8 text-center text-white/40 text-sm">
            <p>&copy; {new Date().getFullYear()} {t("app.title")}. {footerCms.text("copyright", t("footer.copyright"))}</p>
            <div className="flex items-center justify-center gap-4 mt-2">
              <a href="/privacy-policy" className="hover:text-white/70 transition-colors">Privacy Policy</a>
              <span>·</span>
              <a href="/terms-of-service" className="hover:text-white/70 transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>

      <MobileBottomNav
        menuContent={
          <div className="flex flex-col gap-6 mt-10">
            <Link href="/" className="text-lg font-medium hover:text-primary">{t("nav.home")}</Link>

            <div className="space-y-3">
              <Link href="/tours" className="text-lg font-medium hover:text-primary block">{t("nav.tours")}</Link>
              <div className="pl-4 space-y-2 border-l-2 border-muted">
                {tours.map(tour => (
                  <Link key={tour.id} href="/tours" className="block text-sm text-muted-foreground hover:text-primary">
                    {tour.title}
                  </Link>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Link href="/transfers" className="text-lg font-medium hover:text-primary block">{t("nav.transfers")}</Link>
              <div className="pl-4 space-y-2 border-l-2 border-muted">
                {transfers.map(transfer => (
                  <Link key={transfer.id} href="/transfers" className="block text-sm text-muted-foreground hover:text-primary">
                    {transfer.title}
                  </Link>
                ))}
              </div>
            </div>

            <Link href="/about" className="text-lg font-medium hover:text-primary">{t("nav.about")}</Link>
            <Link href="/contact" className="text-lg font-medium hover:text-primary">{t("nav.contact")}</Link>
            <Link href="/manage-booking" className="text-lg font-medium hover:text-primary">{t("nav.editTrip")}</Link>
            <Link href="/reservations" className="text-lg font-medium hover:text-primary">{t("nav.bookRide")}</Link>

            <div className="flex items-center justify-between py-2">
              <span className="text-lg font-medium text-foreground">Currency</span>
              <CurrencySelector />
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-lg font-medium text-foreground">{t("common.language")}</span>
              <LanguageSelector />
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-lg font-medium text-foreground">{t("common.theme")}</span>
              <ThemeToggle size="md" />
            </div>

            <Link href="/reservations?tab=book-new">
              <Button size="lg" className="w-full">{t("tour.bookNow")}</Button>
            </Link>
          </div>
        }
      />
      <WhatsAppWidget />
    </div>
  );
}
