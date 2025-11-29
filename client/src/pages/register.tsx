import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Quote, CheckCircle, Star } from "lucide-react";
import { tours } from "@/lib/data";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSelector } from "@/components/language-selector";
import { useTranslation } from "react-i18next";

export default function Register() {
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  
  const featuredTour = tours[1]; // Roots & Routes

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate registration delay
    setTimeout(() => {
      setIsLoading(false);
      toast({
        title: "Account created!",
        description: "You can now log in to your account.",
      });
      setLocation("/login");
    }, 1500);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans text-foreground">
       {/* Simple Header */}
       <header className="bg-primary text-white shadow-md py-4 relative z-20">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <Link href="/" className="font-serif font-bold text-xl tracking-tight">
            Ace Tours & Transfers
          </Link>
          <div className="flex items-center gap-4">
            <LanguageSelector />
            <ThemeToggle size="sm" />
            <Link href="/">
              <span className="inline-flex items-center px-3 py-1.5 rounded text-sm font-medium text-white hover:bg-white/20 transition-colors cursor-pointer">
                <ArrowLeft className="mr-2 h-4 w-4" /> {t("auth.backToHome")}
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Section with Full-Width Background Image */}
      <main className="flex-grow relative">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img 
            src={featuredTour.image} 
            alt="Vanuatu Culture"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30" />
        </div>

        {/* Content Overlay */}
        <div className="relative z-10 flex items-center min-h-full py-12 px-4">
          <div className="container mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
              {/* Registration Form */}
              <Card className="w-full border border-white/20 shadow-2xl bg-black/40 backdrop-blur-md text-white">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-2xl font-serif font-bold text-center text-white">{t("auth.signUp")}</CardTitle>
                  <CardDescription className="text-center text-white/70">
                    {t("auth.signUpDesc")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-white">{t("auth.fullName")}</Label>
                      <Input 
                        id="fullName" 
                        placeholder="John Doe" 
                        required 
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white/40"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-white">{t("auth.email")}</Label>
                      <Input 
                        id="email" 
                        type="email" 
                        placeholder="name@example.com" 
                        required 
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white/40"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-white">{t("auth.password")}</Label>
                      <Input 
                        id="password" 
                        type="password" 
                        required 
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white/40"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-white">{t("auth.confirmPassword")}</Label>
                      <Input 
                        id="confirmPassword" 
                        type="password" 
                        required 
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white/40"
                      />
                    </div>
                    
                    <Button type="submit" className="w-full bg-white text-primary hover:bg-white/90 font-semibold" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t("auth.registering")}
                        </>
                      ) : (
                        t("auth.registerButton")
                      )}
                    </Button>
                  </form>
                  <div className="mt-4 text-center text-sm text-white/80">
                    {t("auth.haveAccount")}{" "}
                    <Link href="/login" className="text-white font-medium hover:underline">
                      {t("nav.login")}
                    </Link>
                  </div>
                </CardContent>
              </Card>

              {/* Value Proposition & Testimonial */}
              <div className="hidden lg:flex flex-col space-y-8 text-white">
                <div>
                  <span className="bg-primary text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    Join Our Community
                  </span>
                </div>
                <h2 className="text-4xl font-serif font-bold">Why join Ace Tours?</h2>
                
                <div className="space-y-5">
                  <div className="flex items-start gap-4">
                    <CheckCircle className="w-6 h-6 text-green-400 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-lg">Manage bookings easily</h3>
                      <p className="text-white/80">View, modify, or cancel your reservations anytime, anywhere.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <CheckCircle className="w-6 h-6 text-green-400 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-lg">Exclusive offers</h3>
                      <p className="text-white/80">Get access to special member-only discounts and early access to new tour packages.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <CheckCircle className="w-6 h-6 text-green-400 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-lg">Faster checkout</h3>
                      <p className="text-white/80">Save your details for a seamless booking experience next time.</p>
                    </div>
                  </div>
                </div>

                {/* Testimonial */}
                <div className="mt-4 bg-white/10 backdrop-blur-sm p-6 rounded-xl border border-white/20">
                  <Quote className="w-8 h-8 text-white/30 mb-3" />
                  <p className="text-white/90 italic mb-4">
                    "We booked our entire family vacation through Ace Tours. Having an account made it so easy to coordinate multiple transfers and day trips. Highly recommend!"
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-white">
                      SM
                    </div>
                    <div>
                      <p className="font-bold text-sm text-white">Sarah Mitchell</p>
                      <div className="flex text-yellow-400 text-xs">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="w-3 h-3 fill-current" />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-[#291B12] text-white py-6 text-center text-sm opacity-90 relative z-20">
         <p>&copy; {new Date().getFullYear()} Ace Tours & Transfers Vanuatu. All rights reserved.</p>
      </footer>
    </div>
  );
}
