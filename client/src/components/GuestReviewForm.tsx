import { useState } from "react";
import { Star, Send, CheckCircle2, Loader2, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { NameError } from "@/components/name-error";
import { invalidPersonName } from "@shared/person-name";

interface GuestReviewFormProps {
  productId: string;
  productTitle: string;
  reviewQueryKey: string[];
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className="text-2xl transition-transform hover:scale-110"
          aria-label={`${n} star${n !== 1 ? "s" : ""}`}
        >
          <span className={(hover || value) >= n ? "text-primary" : "text-muted"}>★</span>
        </button>
      ))}
    </div>
  );
}

export function GuestReviewForm({ productId, productTitle, reviewQueryKey }: GuestReviewFormProps) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [open, setOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      toast({ title: "Please select a star rating", variant: "destructive" });
      return;
    }
    if (!isAuthenticated && !guestName.trim()) {
      toast({ title: "Please enter your name", variant: "destructive" });
      return;
    }
    // The message under the name field already explains it.
    if (!isAuthenticated && invalidPersonName(guestName)) {
      document.getElementById("review-guest-name")?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = isAuthenticated ? "/api/reviews" : "/api/reviews/guest";
      const body = isAuthenticated
        ? { tourId: productId, rating, comment: comment.trim().slice(0, 2000) }
        : {
            tourId: productId,
            rating,
            comment: comment.trim().slice(0, 2000),
            guestName: guestName.trim().slice(0, 100),
            guestEmail: guestEmail.trim().slice(0, 254) || undefined,
          };

      await apiRequest("POST", endpoint, body);
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: reviewQueryKey });
      toast({
        title: "Review submitted!",
        description: isAuthenticated
          ? "Thank you for your feedback."
          : "Your review will appear after moderation. Thank you!",
      });
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("429") || msg.includes("Too many")) {
        toast({ title: "Too many submissions", description: "Please wait before submitting another review.", variant: "destructive" });
      } else if (msg.includes("403")) {
        toast({ title: "Guest reviews are disabled", description: "Please create an account to leave a review.", variant: "destructive" });
      } else {
        toast({ title: "Submission failed", description: "Please try again in a moment.", variant: "destructive" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-reef" />
        <p className="font-semibold text-foreground">Thank you for your review!</p>
        <p className="text-sm text-muted-foreground">
          {isAuthenticated ? "Your review has been posted." : "Your review will appear after it's approved by our team."}
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-3 border border-primary/25 rounded-[10px] text-[0.88rem] font-semibold text-primary hover:bg-primary/6 transition-all flex items-center justify-center gap-2"
      >
        <Star className="h-4 w-4" />
        Write a Review for {productTitle}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-muted border border-primary/18 rounded-[14px] p-6 space-y-4">
      <div className="font-serif text-[1rem] font-bold text-foreground flex items-center gap-2">
        <Star className="h-4 w-4 text-primary fill-primary" />
        Leave a Review
      </div>

      {/* Star picker */}
      <div>
        <label className="text-[0.68rem] font-bold uppercase tracking-widest text-muted-foreground mb-2 block">
          Your Rating <span className="text-[#e05555]">*</span>
        </label>
        <StarPicker value={rating} onChange={setRating} />
        {rating > 0 && (
          <p className="text-[0.72rem] text-muted-foreground mt-1">
            {["", "Poor", "Below Average", "Average", "Good", "Excellent"][rating]}
          </p>
        )}
      </div>

      {/* Comment */}
      <div>
        <label className="text-[0.68rem] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
          Your Experience
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, 2000))}
          rows={4}
          placeholder="Tell other travellers about your experience..."
          className="w-full bg-card border border-primary/18 rounded-[10px] px-4 py-3 text-[0.88rem] text-foreground placeholder:text-muted-foreground/70 resize-none focus:outline-none focus:border-primary transition-colors"
        />
        <p className="text-right text-[0.62rem] text-muted-foreground mt-0.5">{comment.length}/2000</p>
      </div>

      {/* Guest fields (only shown when not logged in) */}
      {!isAuthenticated && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[0.72rem] text-border">
            <Lock className="h-3 w-3" />
            Not logged in — your review will be posted as a guest and reviewed before publishing
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[0.68rem] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
                Name <span className="text-[#e05555]">*</span>
              </label>
              <input
                type="text"
                id="review-guest-name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value.slice(0, 100))}
                placeholder="Your name"
                className="w-full bg-card border border-primary/18 rounded-[10px] px-4 py-2.5 text-[0.88rem] text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary transition-colors"
                aria-invalid={Boolean(invalidPersonName(guestName))}
                aria-describedby="review-guest-name-error"
              />
              <NameError value={guestName} id="review-guest-name-error" className="mt-1.5" />
            </div>
            <div>
              <label className="text-[0.68rem] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
                Email (optional)
              </label>
              <input
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value.slice(0, 254))}
                placeholder="email@example.com"
                className="w-full bg-card border border-primary/18 rounded-[10px] px-4 py-2.5 text-[0.88rem] text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>
        </div>
      )}

      {isAuthenticated && (
        <p className="text-[0.72rem] text-reef flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Posting as {user?.name} (verified guest)
        </p>
      )}

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 py-2.5 border border-primary/18 rounded-[10px] text-[0.85rem] text-muted-foreground hover:border-primary/40 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || rating === 0}
          className="flex-1 py-2.5 bg-primary text-background rounded-[10px] text-[0.85rem] font-bold hover:bg-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {submitting ? "Submitting..." : "Submit Review"}
        </button>
      </div>
    </form>
  );
}
