import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Star } from "lucide-react";
import { tours } from "@/lib/data";
import { useAuth } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSelector } from "@/components/language-selector";
import { useTranslation } from "react-i18next";

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { t } = useTranslation();

  const featuredTour = tours[0];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const result = await login(email, password);
      setIsLoading(false);

      if (result.success) {
        try {
          toast({
            title: t("auth.welcomeBack"),
            description: t("auth.redirecting"),
          });
        } catch (toastError) {
          console.warn('Toast error:', toastError);
        }
      } else {
        try {
          toast({
            title: t("auth.loginFailed"),
            description: result.error || t("auth.invalidCredentials"),
            variant: "destructive"
          });
        } catch (toastError) {
          console.warn('Toast error:', toastError);
        }
      }
    } catch (error) {
      setIsLoading(false);
      console.error('Login error:', error);
      try {
        toast({
          title: t("auth.error"),
          description: t("auth.unexpectedError"),
          variant: "destructive"
        });
      } catch (toastError) {
        console.warn('Toast error:', toastError);
      }
    }
  };

  const fillCredentials = (type: 'admin' | 'customer') => {
    if (type === 'admin') {
      setEmail("admin@acetours.vu");
      setPassword("admin123");
    } else {
      setEmail("james@example.com");
      setPassword("user123");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans text-foreground">
       {/* Simple Header */}
       <header className="bg-primary text-white shadow-md py-4 relative z-20">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <Link href="/" className="font-serif font-bold text-xl tracking-tight">
             {t("app.title")}
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
            alt={t("auth.vanuatuAdventure")}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30" />
        </div>

        {/* Content Overlay */}
        <div className="relative z-10 flex items-center min-h-full py-12 px-4">
          <div className="container mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
              {/* Login Form */}
              <Card className="w-full border border-white/20 shadow-2xl bg-black/40 backdrop-blur-md text-white">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-2xl font-serif font-bold text-center text-white">{t("auth.signIn")}</CardTitle>
                  <CardDescription className="text-center text-white/70">
                    {t("auth.signInDesc")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Demo Accounts Alert */}
                  <div className="mb-6 bg-white/10 border border-white/20 rounded-md p-4 text-sm text-white">
                    <p className="font-semibold mb-2 flex items-center gap-2">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" /> 
                      {t("auth.demoAccounts")}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => fillCredentials('admin')}
                        className="text-left p-2 rounded hover:bg-white/10 transition-colors border border-transparent hover:border-white/30"
                      >
                        <span className="font-bold block text-xs uppercase tracking-wider text-yellow-400 mb-0.5">{t("auth.adminAccount")}</span>
                        <div className="text-xs text-white/80">admin@acetours.vu</div>
                        <div className="text-xs text-white/60">admin123</div>
                      </button>
                      <button 
                        onClick={() => fillCredentials('customer')}
                        className="text-left p-2 rounded hover:bg-white/10 transition-colors border border-transparent hover:border-white/30"
                      >
                        <span className="font-bold block text-xs uppercase tracking-wider text-yellow-400 mb-0.5">{t("auth.customerAccount")}</span>
                        <div className="text-xs text-white/80">james@example.com</div>
                        <div className="text-xs text-white/60">user123</div>
                      </button>
                    </div>
                    <p className="text-xs mt-2 text-white/60 italic text-center">{t("auth.clickToFill")}</p>
                  </div>

                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-white">{t("auth.email")}</Label>
                      <Input 
                        id="email" 
                        type="email" 
                        placeholder={t("auth.emailPlaceholder")} 
                        required 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white/40"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-white">{t("auth.password")}</Label>
                        <a href="#" className="text-sm font-medium text-white/80 hover:text-white hover:underline">
                          {t("auth.forgotPassword")}
                        </a>
                      </div>
                      <Input 
                        id="password" 
                        type="password" 
                        required 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white/40"
                      />
                    </div>
                    <Button type="submit" className="w-full bg-white text-primary hover:bg-white/90 font-semibold" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t("auth.loggingIn")}
                        </>
                      ) : (
                        t("auth.loginButton")
                      )}
                    </Button>
                  </form>
                  <div className="mt-4 text-center text-sm text-white/80">
                    {t("auth.noAccount")}{" "}
                    <Link href="/register" className="text-white font-medium hover:underline">
                      {t("nav.register")}
                    </Link>
                  </div>
                </CardContent>
              </Card>

              {/* Featured Tour Info & Testimonial */}
              <div className="hidden lg:flex flex-col space-y-6 text-white">
                <div>
                  <span className="bg-primary text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    {t("auth.featuredExperience")}
                  </span>
                </div>
                <h2 className="text-4xl font-serif font-bold">{featuredTour.title}</h2>
                <p className="text-white/90 text-lg leading-relaxed">
                  {featuredTour.description[0]}
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-current" />
                    ))}
                  </div>
                  <span className="text-lg font-medium text-white/80">4.9 ({t("auth.reviews")})</span>
                </div>
                <Link href="/tours">
                  <Button size="lg" className="bg-white text-primary hover:bg-white/90 font-semibold w-fit">
                    {t("auth.viewDetailsBook")}
                  </Button>
                </Link>

                {/* Testimonial */}
                <div className="mt-8 bg-white/10 backdrop-blur-sm p-6 rounded-xl border border-white/20">
                  <div className="flex gap-1 text-yellow-400 mb-3">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-current" />
                    ))}
                  </div>
                  <p className="text-white/90 italic mb-4">
                    "{t("auth.testimonialLogin")}"
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-white">
                      JD
                    </div>
                    <div>
                      <p className="font-bold text-sm text-white">James D.</p>
                      <p className="text-xs text-white/70">{t("auth.verifiedTraveler")}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-[#291B12] text-white py-6 text-center text-sm opacity-90 relative z-20">
         <p>&copy; {new Date().getFullYear()} {t("app.title")}. {t("footer.copyright")}</p>
      </footer>
    </div>
  );
}
