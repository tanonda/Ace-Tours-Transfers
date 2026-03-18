import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useTranslation } from "react-i18next";

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [mfaToken, setMfaToken] = useState("");
  const { t } = useTranslation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await login(email, password, requiresMfa ? mfaToken : undefined);
      setIsLoading(false);

      if (result.requiresMfa) {
        setRequiresMfa(true);
        toast({
          title: "Two-Factor Authentication Required",
          description: "Please enter the code from your Authenticator app.",
        });
        return;
      }

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

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans text-foreground">
      <header className="bg-primary text-white shadow-md py-4 relative z-20">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <Link href="/" className="font-serif font-bold text-xl tracking-tight">
            {t("app.title")}
          </Link>
          <Link href="/">
            <span className="inline-flex items-center px-3 py-1.5 rounded text-sm font-medium text-white hover:bg-white/20 transition-colors cursor-pointer">
              <ArrowLeft className="mr-2 h-4 w-4" /> {t("auth.backToHome")}
            </span>
          </Link>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center px-4 py-12 bg-muted/30">
        <Card className="w-full max-w-md border shadow-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-serif font-bold text-center">Staff Login</CardTitle>
            <CardDescription className="text-center">
              Sign in to access the admin dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder={t("auth.emailPlaceholder")}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t("auth.password")}</Label>
                  <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground hover:underline">
                    {t("auth.forgotPassword")}
                  </a>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              
              {requiresMfa && (
                <div className="space-y-2">
                  <Label htmlFor="mfaToken">Authentication Code</Label>
                  <Input
                    id="mfaToken"
                    type="text"
                    autoComplete="one-time-code"
                    required
                    placeholder="6-digit code"
                    value={mfaToken}
                    onChange={(e) => setMfaToken(e.target.value)}
                  />
                </div>
              )}
              
              <Button type="submit" className="w-full font-semibold" disabled={isLoading}>
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
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
