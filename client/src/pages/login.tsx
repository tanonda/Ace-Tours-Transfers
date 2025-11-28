import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Star } from "lucide-react";
import { tours } from "@/lib/data";

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const featuredTour = tours[0];

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate login delay
    setTimeout(() => {
      setIsLoading(false);
      toast({
        title: "Welcome back!",
        description: "You have successfully logged in.",
      });
      setLocation("/reservations");
    }, 1500);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans text-foreground">
       {/* Simple Header */}
       <header className="bg-primary text-white shadow-md py-4">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <Link href="/">
             <a className="font-serif font-bold text-xl tracking-tight">Ace Tours & Transfers</a>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center p-4 bg-slate-50">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          {/* Login Form */}
          <Card className="w-full border-none shadow-lg order-2 lg:order-1">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-serif font-bold text-center text-[#004165]">Sign in</CardTitle>
              <CardDescription className="text-center">
                Enter your email and password to access your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="name@example.com" required />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <a href="#" className="text-sm font-medium text-primary hover:underline">
                      Forgot password?
                    </a>
                  </div>
                  <Input id="password" type="password" required />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="remember" />
                  <label
                    htmlFor="remember"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Remember me
                  </label>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>
              <div className="mt-4 text-center text-sm">
                Don't have an account?{" "}
                <Link href="/register">
                  <a className="text-primary font-medium hover:underline">Sign up</a>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Cross-sell / Featured Tour */}
          <div className="hidden lg:flex flex-col space-y-6 order-1 lg:order-2">
            <div className="relative rounded-2xl overflow-hidden shadow-xl aspect-[4/5] group">
              <img 
                src={featuredTour.image} 
                alt={featuredTour.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              
              <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                <div className="mb-4">
                  <span className="bg-primary text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    Featured Experience
                  </span>
                </div>
                <h2 className="text-3xl font-serif font-bold mb-2">{featuredTour.title}</h2>
                <p className="text-white/90 mb-4 line-clamp-2 text-sm">
                  {featuredTour.description[0]}
                </p>
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-current" />
                    ))}
                  </div>
                  <span className="text-sm font-medium text-white/80">4.9 (120+ reviews)</span>
                </div>
                <Link href="/tours">
                   <Button className="w-full bg-white text-primary hover:bg-white/90 font-semibold">
                     View Details & Book
                   </Button>
                </Link>
              </div>
            </div>
            
            {/* Testimonial Card */}
            <div className="bg-white p-6 rounded-xl shadow-md border border-slate-100">
              <div className="flex gap-1 text-yellow-500 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-current" />
                ))}
              </div>
              <p className="text-slate-600 italic mb-4">
                "Logging in to manage my booking was seamless. I added an extra day tour last minute and the team handled it perfectly!"
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500">
                  JD
                </div>
                <div>
                  <p className="font-bold text-sm text-[#004165]">James D.</p>
                  <p className="text-xs text-slate-500">Verified Traveler</p>
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
