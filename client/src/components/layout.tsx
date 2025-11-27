
import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Menu, X, Phone, Mail, Instagram, Facebook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { BookingModal } from "@/components/booking-modal";
import logo from "@assets/thumbnail_1755110010542_1764279489018.jpg";

export function Layout({ children }: { children: React.ReactNode }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/tours", label: "Tours" },
    { href: "/transfers", label: "Transfers" },
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
          <Link href="/">
            <a className="flex items-center gap-2">
              <img src={logo} alt="Ace Tours Logo" className="h-12 w-auto rounded-full" />
              <span className={`font-serif font-bold text-xl tracking-tight ${isScrolled ? "text-foreground" : "text-foreground md:text-white"}`}>
                Ace Tours & Transfers
              </span>
            </a>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <a
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    location === link.href
                      ? "text-primary"
                      : isScrolled
                      ? "text-foreground"
                      : "text-white/90 hover:text-white"
                  }`}
                >
                  {link.label}
                </a>
              </Link>
            ))}
            <BookingModal trigger={<Button size="lg" className="font-semibold shadow-lg">Book Now</Button>} />
          </nav>

          {/* Mobile Nav */}
          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className={isScrolled ? "text-foreground" : "text-white"}>
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <div className="flex flex-col gap-6 mt-10">
                {navLinks.map((link) => (
                  <Link key={link.href} href={link.href}>
                    <a className="text-lg font-medium hover:text-primary">
                      {link.label}
                    </a>
                  </Link>
                ))}
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
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>
                      <a className="text-white/70 hover:text-white transition-colors">{link.label}</a>
                    </Link>
                  </li>
                ))}
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
