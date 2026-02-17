import { useState } from "react";
import { useContentBlock } from "@/lib/cms-context";
import { Mail, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { subscribeNewsletter } from "@/lib/api";

interface NewsletterFormProps {
  source?: string;
  className?: string;
  variant?: "inline" | "stacked";
}

export function NewsletterForm({
  source = "footer",
  className = "",
  variant = "inline"
}: NewsletterFormProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { enabled } = useContentBlock("newsletter");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!enabled) return null;

  if (!email) {
      toast({
        title: t("newsletter.emailRequired", "Email Required"),
        description: t("newsletter.enterEmail", "Please enter your email address"),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await subscribeNewsletter({
        email
      });

      toast({
        title: t("newsletter.success", "Successfully Subscribed!"),
        description: t("newsletter.successDesc", "Thank you for subscribing to our newsletter"),
      });
      setEmail("");
    } catch (error) {
      toast({
        title: t("newsletter.error", "Subscription Failed"),
        description: (error as Error).message || t("newsletter.errorDesc", "Failed to subscribe. Please try again."),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (variant === "stacked") {
    return (
      <form onSubmit={handleSubmit} className={`space-y-3 ${className}`}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Mail className="h-4 w-4" />
          <span>{t("newsletter.title", "Subscribe to our newsletter")}</span>
        </div>
        <Input
          type="email"
          placeholder={t("newsletter.placeholder", "Enter your email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          className="w-full"
          data-testid="input-newsletter-email"
        />
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full"
          data-testid="button-newsletter-subscribe"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          {t("newsletter.subscribe", "Subscribe")}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`flex gap-2 ${className}`}>
      <div className="relative flex-1">
        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="email"
          placeholder={t("newsletter.placeholder", "Enter your email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          className="pl-10"
          data-testid="input-newsletter-email"
        />
      </div>
      <Button
        type="submit"
        disabled={isLoading}
        data-testid="button-newsletter-subscribe"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        <span className="sr-only md:not-sr-only md:ml-2">
          {t("newsletter.subscribe", "Subscribe")}
        </span>
      </Button>
    </form>
  );
}
