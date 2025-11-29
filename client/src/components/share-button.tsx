import { useState } from "react";
import { Share2, Facebook, Twitter, Link, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface ShareButtonProps {
  title: string;
  url?: string;
  description?: string;
  variant?: "icon" | "button";
  className?: string;
}

export function ShareButton({ 
  title, 
  url, 
  description = "", 
  variant = "icon",
  className = "" 
}: ShareButtonProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(title);

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url: shareUrl,
        });
        setIsOpen(false);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error("Share failed:", err);
        }
      }
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: t("share.linkCopied", "Link Copied!"),
        description: t("share.copiedDesc", "The link has been copied to your clipboard"),
      });
      setIsOpen(false);
    } catch (err) {
      toast({
        title: t("common.error", "Error"),
        description: t("share.copyFailed", "Failed to copy link"),
        variant: "destructive",
      });
    }
  };

  const shareOptions = [
    {
      name: t("share.whatsapp", "WhatsApp"),
      key: "whatsapp",
      icon: MessageCircle,
      url: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
      color: "hover:bg-green-50 hover:text-green-600",
    },
    {
      name: t("share.facebook", "Facebook"),
      key: "facebook",
      icon: Facebook,
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      color: "hover:bg-blue-50 hover:text-blue-600",
    },
    {
      name: t("share.twitter", "X"),
      key: "twitter",
      icon: Twitter,
      url: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      color: "hover:bg-sky-50 hover:text-sky-600",
    },
  ];

  const TriggerButton = variant === "button" ? (
    <Button variant="outline" size="sm" className={className} data-testid="button-share">
      <Share2 className="h-4 w-4 mr-2" />
      {t("share.title", "Share")}
    </Button>
  ) : (
    <button
      className={`p-2 rounded-full bg-white/90 hover:bg-white shadow-md transition-all ${className}`}
      data-testid="button-share"
      aria-label={t("share.title", "Share")}
    >
      <Share2 className="h-5 w-5 text-gray-600 hover:text-primary" />
    </button>
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        {TriggerButton}
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground px-2 py-1">
            {t("share.shareVia", "Share via")}
          </p>
          
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              onClick={handleNativeShare}
              className="w-full flex items-center gap-3 px-2 py-2 rounded-md text-sm hover:bg-muted transition-colors"
              data-testid="button-share-native"
            >
              <Share2 className="h-4 w-4" />
              {t("share.moreOptions", "More options...")}
            </button>
          )}
          
          {shareOptions.map((option) => (
            <a
              key={option.key}
              href={option.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsOpen(false)}
              className={`w-full flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-colors ${option.color}`}
              data-testid={`button-share-${option.key}`}
            >
              <option.icon className="h-4 w-4" />
              {option.name}
            </a>
          ))}
          
          <button
            onClick={handleCopyLink}
            className="w-full flex items-center gap-3 px-2 py-2 rounded-md text-sm hover:bg-muted transition-colors"
            data-testid="button-share-copy"
          >
            <Link className="h-4 w-4" />
            {t("share.copyLink", "Copy link")}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
