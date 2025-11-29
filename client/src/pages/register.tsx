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

export default function Register() {
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
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
       <header className="bg-primary text-white shadow-md py-4">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <Link href="/" className="font-serif font-bold text-xl tracking-tight">
            Ace Tours & Transfers
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle size="sm" />
            <Link href="/">
              <span className="inline-flex items-center px-3 py-1.5 rounded text-sm font-medium text-white hover:bg-white/20 transition-colors cursor-pointer">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
              </span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center p-4 bg-muted/30">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          {/* Registration Form */}
          <Card className="w-full border-none shadow-lg">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-serif font-bold text-center text-[#004165]">Create an account</CardTitle>
              <CardDescription className="text-center">
                Enter your details below to create your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First name</Label>
                    <Input id="firstName" placeholder="John" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input id="lastName" placeholder="Doe" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="name@example.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input id="confirmPassword" type="password" required />
                </div>
                
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </form>
              <div className="mt-4 text-center text-sm">
                Already have an account?{" "}
                <Link href="/login" className="text-primary font-medium hover:underline">
                  Sign in
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Value Proposition / Testimonials */}
          <div className="flex flex-col space-y-8 px-6">
            <div className="relative rounded-2xl overflow-hidden shadow-xl aspect-[16/9] group mb-6">
              <img 
                src={featuredTour.image} 
                alt={featuredTour.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/20" />
              <div className="absolute bottom-4 left-4 text-white">
                 <p className="font-bold text-lg shadow-black/50 drop-shadow-md">Explore Vanuatu</p>
              </div>
            </div>

            <div className="space-y-6">
              <h2 className="text-3xl font-serif font-bold text-[#004165]">Why join Ace Tours?</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                   <CheckCircle className="w-6 h-6 text-green-500 shrink-0 mt-0.5" />
                   <div>
                      <h3 className="font-bold text-lg">Manage bookings easily</h3>
                      <p className="text-slate-600">View, modify, or cancel your reservations anytime, anywhere.</p>
                   </div>
                </div>
                <div className="flex items-start gap-3">
                   <CheckCircle className="w-6 h-6 text-green-500 shrink-0 mt-0.5" />
                   <div>
                      <h3 className="font-bold text-lg">Exclusive offers</h3>
                      <p className="text-slate-600">Get access to special member-only discounts and early access to new tour packages.</p>
                   </div>
                </div>
                <div className="flex items-start gap-3">
                   <CheckCircle className="w-6 h-6 text-green-500 shrink-0 mt-0.5" />
                   <div>
                      <h3 className="font-bold text-lg">Faster checkout</h3>
                      <p className="text-slate-600">Save your details for a seamless booking experience next time.</p>
                   </div>
                </div>
              </div>
            </div>

            <div className="relative bg-primary/5 p-8 rounded-2xl border border-primary/10">
               <Quote className="absolute top-4 left-4 w-8 h-8 text-primary/20" />
               <p className="text-lg italic text-[#004165] mb-6 relative z-10">
                 "We booked our entire family vacation through Ace Tours. Having an account made it so easy to coordinate multiple transfers and day trips. Highly recommend!"
               </p>
               <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white border-2 border-primary/20 flex items-center justify-center font-bold text-primary text-lg shadow-sm">
                    SM
                  </div>
                  <div>
                    <p className="font-bold text-[#004165]">Sarah Mitchell</p>
                    <div className="flex text-yellow-500 text-xs">
                      ★★★★★
                    </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-[#291B12] text-white py-6 text-center text-sm opacity-90">
         <p>&copy; {new Date().getFullYear()} Ace Tours & Transfers Vanuatu. All rights reserved.</p>
      </footer>
    </div>
  );
}
