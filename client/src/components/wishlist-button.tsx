import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { addToWishlist, removeFromWishlist, checkWishlist } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

interface WishlistButtonProps {
  tourId: string;
  variant?: "icon" | "button";
  className?: string;
}

export function WishlistButton({ tourId, variant = "icon", className = "" }: WishlistButtonProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      checkWishlist(tourId).then(setIsInWishlist).catch(() => {});
    }
  }, [tourId, user]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      toast({
        title: t("wishlist.loginRequired", "Login Required"),
        description: t("wishlist.loginDesc", "Please log in to save tours to your wishlist"),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      if (isInWishlist) {
        await removeFromWishlist(tourId);
        setIsInWishlist(false);
        toast({
          title: t("wishlist.removed", "Removed from Wishlist"),
          description: t("wishlist.removedDesc", "Item has been removed from your wishlist"),
        });
      } else {
        await addToWishlist(tourId);
        setIsInWishlist(true);
        toast({
          title: t("wishlist.added", "Added to Wishlist"),
          description: t("wishlist.addedDesc", "Item has been added to your wishlist"),
        });
      }
    } catch (error) {
      toast({
        title: t("common.error", "Error"),
        description: t("wishlist.error", "Failed to update wishlist"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (variant === "button") {
    return (
      <Button
        variant={isInWishlist ? "default" : "outline"}
        size="sm"
        onClick={handleToggle}
        disabled={isLoading}
        className={className}
        data-testid={`button-wishlist-${tourId}`}
      >
        <Heart
          className={`h-4 w-4 mr-2 ${isInWishlist ? "fill-current" : ""}`}
        />
        {isInWishlist
          ? t("wishlist.saved", "Saved")
          : t("wishlist.save", "Save")}
      </Button>
    );
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isLoading}
      className={`p-2 rounded-full bg-white/90 hover:bg-white shadow-md transition-all ${className}`}
      data-testid={`button-wishlist-${tourId}`}
      aria-label={isInWishlist ? t("wishlist.remove", "Remove from Wishlist") : t("wishlist.add", "Add to Wishlist")}
    >
      <Heart
        className={`h-5 w-5 transition-colors ${
          isInWishlist
            ? "fill-red-500 text-red-500"
            : "text-gray-600 hover:text-red-500"
        }`}
      />
    </button>
  );
}
