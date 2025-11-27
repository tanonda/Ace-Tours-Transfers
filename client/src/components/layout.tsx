import { Link, useLocation } from "wouter";
import { useState, useEffect, forwardRef } from "react";
import { Menu, Phone, Mail, Instagram, Facebook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { BookingModal } from "@/components/booking-modal";
import logo from "@assets/thumbnail_1755110010542_1764279489018.jpg";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";
import { tours, transfers } from "@/lib/data";
import { useCart } from "@/lib/cart-context";
import { ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const ListItem = forwardRef<
  React.ElementRef<"a">,
  React.ComponentPropsWithoutRef<"a"> & { href: string }
>(({ className, title, children, href, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <Link href={href}>
          <a
            ref={ref}
            className={cn(
              "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
              className
            )}
            {...props}
          >
            <div className="text-sm font-medium leading-none">{title}</div>
            <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
              {children}
            </p>
          </a>
        </Link>
      </NavigationMenuLink>
    </li>
  )
})
ListItem.displayName = "ListItem"

export function Layout({ children }: { children: React.ReactNode }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [location] = useLocation();
  const { itemCount } = useCart();
  const isHome = location === "/";

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isTransparent = isHome && !isScrolled;
  
  // Text color logic:
  // If transparent (Home top): White text
  // If scrolled OR not Home: Dark text (foreground)
  const navTextColor = isTransparent ? "text-white hover:text-white/80" : "text-foreground hover:text-primary";
  const logoTextColor = isTransparent ? "text-white" : "text-foreground";
  const mobileButtonColor = isTransparent ? "text-white" : "text-foreground";

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans text-foreground">
      {/* Navigation */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled ? "bg-white/90 backdrop-blur-md shadow-sm py-2" : "bg-transparent py-4"
        }`}
      >
        <div className="container mx-auto px-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src={logo} alt="Ace Tours Logo" className="h-12 w-auto rounded-full" />
            <span className={`font-serif font-bold text-xl tracking-tight transition-colors ${logoTextColor} block md:hidden lg:block`}>
              Ace Tours & Transfers
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-4">
            <NavigationMenu className="relative z-50">
              <NavigationMenuList>
                <NavigationMenuItem>
                  <Link href="/">
                    <a className={cn(
                      "group inline-flex h-9 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none disabled:pointer-events-none disabled:opacity-50",
                      navTextColor
                    )}>
                      Home
                    </a>
                  </Link>
                </NavigationMenuItem>

                <NavigationMenuItem>
                  <NavigationMenuTrigger className={cn("bg-transparent hover:bg-transparent focus:bg-transparent data-[state=open]:bg-transparent", navTextColor)}>
                    Tours
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                      {tours.map((tour) => (
                        <ListItem
                          key={tour.id}
                          title={tour.title}
                          href="/tours"
                        >
                          {tour.description[0]}
                        </ListItem>
                      ))}
                      <ListItem href="/tours" title="View All Tours" className="bg-muted/50">
                        See our complete range of tour packages
                      </ListItem>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                <NavigationMenuItem>
                  <NavigationMenuTrigger className={cn("bg-transparent hover:bg-transparent focus:bg-transparent data-[state=open]:bg-transparent", navTextColor)}>
                    Transfers
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                      {transfers.map((transfer) => (
                        <ListItem
                          key={transfer.id}
                          title={transfer.title}
                          href="/transfers"
                        >
                          {transfer.description}
                        </ListItem>
                      ))}
                      <ListItem href="/transfers" title="View All Transfers" className="bg-muted/50">
                        See our complete range of transfer options
                      </ListItem>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                <NavigationMenuItem>
                  <Link href="/about">
                    <a className={cn(
                      "group inline-flex h-9 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none disabled:pointer-events-none disabled:opacity-50",
                      navTextColor
                    )}>
                      About
                    </a>
                  </Link>
                </NavigationMenuItem>

                <NavigationMenuItem>
                  <Link href="/contact">
                    <a className={cn(
                      "group inline-flex h-9 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none disabled:pointer-events-none disabled:opacity-50",
                      navTextColor
                    )}>
                      Contact
                    </a>
                  </Link>
                </NavigationMenuItem>

                <NavigationMenuItem>
                  <NavigationMenuTrigger className={cn("bg-transparent hover:bg-transparent focus:bg-transparent data-[state=open]:bg-transparent", navTextColor)}>
                    My Bookings
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[200px] gap-2 p-4">
                      <ListItem href="/reservations" title="Edit your trip">
                        Manage existing bookings
                      </ListItem>
                      <ListItem href="/reservations" title="Cancel your trip">
                        Cancel a reservation
                      </ListItem>
                      <ListItem href="/reservations" title="Book ride">
                        Start a new booking
                      </ListItem>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
            
            <div className="ml-4 flex items-center gap-4">
              <BookingModal trigger={<Button size="lg" className="font-semibold shadow-lg">Book Now</Button>} />
            </div>
          </div>

          {/* Mobile Nav */}
          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className={mobileButtonColor}>
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <div className="flex flex-col gap-6 mt-10">
                <Link href="/" className="text-lg font-medium hover:text-primary">Home</Link>
                
                <div className="space-y-3">
                  <Link href="/tours" className="text-lg font-medium hover:text-primary block">Tours</Link>
                  <div className="pl-4 space-y-2 border-l-2 border-muted">
                    {tours.map(tour => (
                      <Link key={tour.id} href="/tours" className="block text-sm text-muted-foreground hover:text-primary">
                        {tour.title}
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Link href="/transfers" className="text-lg font-medium hover:text-primary block">Transfers</Link>
                  <div className="pl-4 space-y-2 border-l-2 border-muted">
                    {transfers.map(transfer => (
                      <Link key={transfer.id} href="/transfers" className="block text-sm text-muted-foreground hover:text-primary">
                        {transfer.title}
                      </Link>
                    ))}
                  </div>
                </div>

                <Link href="/about" className="text-lg font-medium hover:text-primary">About</Link>
                <Link href="/contact" className="text-lg font-medium hover:text-primary">Contact</Link>

                <div className="space-y-3">
                  <span className="text-lg font-medium text-foreground block">My Bookings</span>
                  <div className="pl-4 space-y-2 border-l-2 border-muted">
                    <Link href="/reservations" className="block text-sm text-muted-foreground hover:text-primary">Edit your trip</Link>
                    <Link href="/reservations" className="block text-sm text-muted-foreground hover:text-primary">Cancel your trip</Link>
                    <Link href="/reservations" className="block text-sm text-muted-foreground hover:text-primary">Book ride</Link>
                  </div>
                </div>
                
                <BookingModal trigger={<Button size="lg" className="w-full">Book Now</Button>} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-[#291B12] text-white pt-16 pb-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <img src={logo} alt="Ace Tours Logo" className="h-10 w-auto rounded-full border-2 border-white/20" />
                <span className="font-serif font-bold text-xl">Ace Tours</span>
              </div>
              <p className="text-white/70 leading-relaxed mb-6">
                Experience the beauty of Efate Island with us. We offer meticulously pre-planned and custom-designed tour packages.
              </p>
              <div className="flex gap-4">
                <a href="https://www.facebook.com/share/16xVyw7m7m/" target="_blank" rel="noopener noreferrer" className="bg-white/10 p-2 rounded-full hover:bg-primary transition-colors">
                  <Facebook className="h-5 w-5" />
                </a>
                <a href="#" className="bg-white/10 p-2 rounded-full hover:bg-primary transition-colors">
                  <Instagram className="h-5 w-5" />
                </a>
              </div>
            </div>

            <div>
              <h3 className="font-serif text-lg font-semibold mb-6 text-primary">Quick Links</h3>
              <ul className="space-y-3">
                <li><Link href="/" className="text-white/70 hover:text-white transition-colors">Home</Link></li>
                <li><Link href="/tours" className="text-white/70 hover:text-white transition-colors">Tours</Link></li>
                <li><Link href="/transfers" className="text-white/70 hover:text-white transition-colors">Transfers</Link></li>
                <li><Link href="/about" className="text-white/70 hover:text-white transition-colors">About</Link></li>
                <li><Link href="/contact" className="text-white/70 hover:text-white transition-colors">Contact</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="font-serif text-lg font-semibold mb-6 text-primary">Contact Us</h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="text-white/70">
                    <p>7114045 / 7342389</p>
                    <p className="text-sm opacity-60">Available 24/7</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <a href="mailto:acetoursvanuatu@outlook.com" className="text-white/70 hover:text-white">
                    acetoursvanuatu@outlook.com
                  </a>
                </li>
                <li className="text-white/70">
                  <p className="font-medium text-white mb-1">Address:</p>
                  Port Vila, Vanuatu
                </li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-white/10 pt-8 text-center text-white/40 text-sm">
            <p>&copy; {new Date().getFullYear()} Ace Tours & Transfers Vanuatu. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
