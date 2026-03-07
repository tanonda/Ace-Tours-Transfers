import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Quote, CheckCircle, Star, Mail } from "lucide-react";
import { tours } from "@/lib/data";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSelector } from "@/components/language-selector";
import { useTranslation } from "react-i18next";

type Step = "details" | "verify";

export default function Register() {
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<Step>("details");
  const [pendingEmail, setPendingEmail] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [otp, setOtp] = useState("");

  const featuredTour = tours[1];

  // Step 1 — submit details, request OTP
  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (formData.password !== formData.confirmPassword) {
        toast({ title: t("auth.error"), description: t("auth.passwordsNotMatch"), variant: "destructive" });
        return;
      }
      if (formData.password.length < 8) {
        toast({ title: t("auth.error"), description: "Password must be at least 8 characters.", variant: "destructive" });
        return;
      }

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Registration failed");
      }

      // Server always sends OTP (even for existing emails it returns 200 with requiresVerification)
      setPendingEmail(formData.email.toLowerCase().trim());
      setStep("verify");
      toast({
        title: "Check your email",
        description: `We sent a 6-digit verification code to ${formData.email}.`,
      });
    } catch (error: any) {
      toast({ title: t("auth.error"), description: error.message || "Registration failed", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2 — submit OTP, create account + log in
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail, code: otp.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Verification failed");
      }

      toast({ title: t("auth.accountCreated"), description: "Your account is ready. Welcome!" });
      setLocation("/login");
    } catch (error: any) {
      toast({ title: "Verification failed", description: error.message || "Invalid code", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setIsLoading(true);
    try {
      await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formData.name, email: pendingEmail, password: formData.password }),
      });
      toast({ title: "Code resent", description: "A new verification code has been sent to your email." });
    } catch {
      toast({ title: "Error", description: "Could not resend the code. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans text-foreground">
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

      <main className="flex-grow relative">
        <div className="absolute inset-0">
          <img src={featuredTour.image} alt={t("auth.vanuatuCulture")} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30" />
        </div>

        <div className="relative z-10 flex items-center min-h-full py-12 px-4">
          <div className="container mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">

              {/* ── Step 1: Registration details ── */}
              {step === "details" && (
                <Card className="w-full border border-white/20 shadow-2xl bg-black/40 backdrop-blur-md text-white">
                  <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-serif font-bold text-center text-white">{t("auth.signUp")}</CardTitle>
                    <CardDescription className="text-center text-white/70">{t("auth.signUpDesc")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleRequestOTP} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="fullName" className="text-white">{t("auth.fullName")}</Label>
                        <Input
                          id="fullName"
                          placeholder={t("auth.fullNamePlaceholder")}
                          required
                          value={formData.name}
                          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                          className="bg-white/20 border-white/30 text-white placeholder:text-white/50 focus:border-white/50 font-black shadow-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-white">{t("auth.email")}</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder={t("auth.emailPlaceholder")}
                          required
                          value={formData.email}
                          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                          className="bg-white/20 border-white/30 text-white placeholder:text-white/50 focus:border-white/50 font-black shadow-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password" className="text-white">{t("auth.password")}</Label>
                        <Input
                          id="password"
                          type="password"
                          placeholder="At least 8 characters"
                          required
                          value={formData.password}
                          onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                          className="bg-white/20 border-white/30 text-white placeholder:text-white/50 focus:border-white/50 font-black shadow-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword" className="text-white">{t("auth.confirmPassword")}</Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          placeholder="Repeat your password"
                          required
                          value={formData.confirmPassword}
                          onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                          className="bg-white/20 border-white/30 text-white placeholder:text-white/50 focus:border-white/50 font-black shadow-lg"
                        />
                      </div>
                      <Button type="submit" className="w-full bg-white text-primary hover:bg-white/90 font-semibold" disabled={isLoading}>
                        {isLoading ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending code…</>
                        ) : (
                          "Continue — Verify Email"
                        )}
                      </Button>
                    </form>
                    <div className="mt-4 text-center text-sm text-white/80">
                      {t("auth.haveAccount")}{" "}
                      <Link href="/login" className="text-white font-medium hover:underline">{t("nav.login")}</Link>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── Step 2: OTP verification ── */}
              {step === "verify" && (
                <Card className="w-full border border-white/20 shadow-2xl bg-black/40 backdrop-blur-md text-white">
                  <CardHeader className="space-y-1">
                    <div className="mx-auto w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mb-2">
                      <Mail className="h-7 w-7 text-white" />
                    </div>
                    <CardTitle className="text-2xl font-serif font-bold text-center text-white">Check your email</CardTitle>
                    <CardDescription className="text-center text-white/70">
                      We sent a 6-digit code to <span className="text-white font-medium">{pendingEmail}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleVerifyOTP} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="otp" className="text-white">Verification code</Label>
                        <Input
                          id="otp"
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          placeholder="000000"
                          maxLength={6}
                          required
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          className="bg-white/20 border-white/30 text-white placeholder:text-white/30 focus:border-white/50 font-mono text-2xl text-center tracking-widest shadow-lg"
                        />
                        <p className="text-white/50 text-xs text-center">Code expires in 10 minutes</p>
                      </div>
                      <Button
                        type="submit"
                        className="w-full bg-white text-primary hover:bg-white/90 font-semibold"
                        disabled={isLoading || otp.length !== 6}
                      >
                        {isLoading ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…</>
                        ) : (
                          "Verify & Create Account"
                        )}
                      </Button>
                    </form>
                    <div className="mt-5 flex flex-col items-center gap-2 text-sm text-white/70">
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={isLoading}
                        className="hover:text-white underline underline-offset-2 disabled:opacity-50"
                      >
                        Resend code
                      </button>
                      <button
                        type="button"
                        onClick={() => { setStep("details"); setOtp(""); }}
                        className="hover:text-white"
                      >
                        ← Back to details
                      </button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Right-hand panel — unchanged */}
              <div className="hidden lg:flex flex-col space-y-8 text-white">
                <div>
                  <span className="bg-primary text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    {t("auth.joinCommunity")}
                  </span>
                </div>
                <h2 className="text-4xl font-serif font-bold">{t("auth.whyJoin")}</h2>
                <div className="space-y-5">
                  <div className="flex items-start gap-4">
                    <CheckCircle className="w-6 h-6 text-green-400 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-lg">{t("auth.manageBookings")}</h3>
                      <p className="text-white/80">{t("auth.manageBookingsDesc")}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <CheckCircle className="w-6 h-6 text-green-400 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-lg">{t("auth.exclusiveOffers")}</h3>
                      <p className="text-white/80">{t("auth.exclusiveOffersDesc")}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <CheckCircle className="w-6 h-6 text-green-400 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-lg">{t("auth.fasterCheckout")}</h3>
                      <p className="text-white/80">{t("auth.fasterCheckoutDesc")}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 bg-white/10 backdrop-blur-sm p-6 rounded-xl border border-white/20">
                  <Quote className="w-8 h-8 text-white/30 mb-3" />
                  <p className="text-white/90 italic mb-4">"{t("auth.testimonialRegister")}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-white">SM</div>
                    <div>
                      <p className="font-bold text-sm text-white">Sarah Mitchell</p>
                      <div className="flex text-yellow-400 text-xs">
                        {[...Array(5)].map((_, i) => <Star key={i} className="w-3 h-3 fill-current" />)}
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
        <p>&copy; {new Date().getFullYear()} {t("app.title")}. {t("footer.copyright")}</p>
      </footer>
    </div>
  );
}
