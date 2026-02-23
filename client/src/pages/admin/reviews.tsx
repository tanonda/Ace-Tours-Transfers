import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useToast } from "@/hooks/use-toast";
import { Star, CheckCircle, XCircle, Trash2, Eye, EyeOff, MessageSquare, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

async function fetchAllReviews() {
  const res = await fetch("/api/admin/reviews", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch reviews");
  return res.json();
}

async function updateReviewStatus(id: string, status: "approved" | "rejected" | "pending") {
  const res = await fetch(`/api/admin/reviews/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Failed to update review");
  return res.json();
}

async function deleteReview(id: string) {
  const res = await fetch(`/api/admin/reviews/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to delete review");
  return res.json();
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i <= rating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: "bg-green-500/15 text-green-600 border-green-500/20",
    rejected: "bg-red-500/15 text-red-500 border-red-500/20",
    pending: "bg-yellow-500/15 text-yellow-600 border-yellow-500/20",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${map[status] || map.pending}`}>
      {status?.charAt(0).toUpperCase() + status?.slice(1) || "Pending"}
    </span>
  );
}

export default function AdminReviews() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [search, setSearch] = useState("");

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: fetchAllReviews,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "approved" | "rejected" | "pending" }) =>
      updateReviewStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
      toast({ title: "Review updated" });
    },
    onError: () => toast({ title: "Error", description: "Failed to update review", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteReview,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
      toast({ title: "Review deleted" });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete review", variant: "destructive" }),
  });

  const filtered = reviews.filter((r: any) => {
    const matchesFilter = filter === "all" || (r.status || "pending") === filter;
    const matchesSearch = !search || 
      r.authorName?.toLowerCase().includes(search.toLowerCase()) ||
      r.comment?.toLowerCase().includes(search.toLowerCase()) ||
      r.tourTitle?.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const counts = {
    all: reviews.length,
    pending: reviews.filter((r: any) => !r.status || r.status === "pending").length,
    approved: reviews.filter((r: any) => r.status === "approved").length,
    rejected: reviews.filter((r: any) => r.status === "rejected").length,
  };

  return (
    <DashboardLayout type="admin">
      <div className="flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
              Reviews & Ratings
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Moderate guest reviews before they appear publicly
            </p>
          </div>
          <input
            placeholder="Search reviews..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 min-w-[220px]"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(["all", "pending", "approved", "rejected"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`p-4 rounded-xl border text-left transition-all ${
                filter === key
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card border-border hover:border-primary/40"
              }`}
            >
              <div className={`text-2xl font-bold ${filter === key ? "" : "text-foreground"}`}>{counts[key]}</div>
              <div className={`text-xs capitalize mt-0.5 ${filter === key ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{key}</div>
            </button>
          ))}
        </div>

        {/* Reviews list */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No reviews found</p>
              {filter === "pending" && (
                <p className="text-sm text-muted-foreground mt-1">All caught up! No reviews awaiting moderation.</p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((review: any) => (
                <div key={review.id} className="p-5 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                      {(review.authorName || review.guestName || "G")[0].toUpperCase()}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-foreground">
                              {review.authorName || review.guestName || "Anonymous Guest"}
                            </span>
                            {review.isGuest && (
                              <span className="text-[10px] bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-full px-2 py-0.5 font-medium">
                                Guest
                              </span>
                            )}
                            <StatusBadge status={review.status || "pending"} />
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <StarRating rating={review.rating || 5} />
                            {review.tourTitle && (
                              <span className="text-xs text-muted-foreground">· {review.tourTitle}</span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {review.createdAt ? new Date(review.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ""}
                        </span>
                      </div>

                      {review.comment && (
                        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{review.comment}</p>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-3">
                        {(review.status || "pending") !== "approved" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-green-500/30 text-green-600 hover:bg-green-50 hover:border-green-500"
                            onClick={() => updateMutation.mutate({ id: review.id, status: "approved" })}
                            disabled={updateMutation.isPending}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Approve
                          </Button>
                        )}
                        {(review.status || "pending") !== "rejected" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-red-500/30 text-red-500 hover:bg-red-50 hover:border-red-500"
                            onClick={() => updateMutation.mutate({ id: review.id, status: "rejected" })}
                            disabled={updateMutation.isPending}
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            Reject
                          </Button>
                        )}
                        {(review.status || "pending") !== "pending" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-muted-foreground"
                            onClick={() => updateMutation.mutate({ id: review.id, status: "pending" })}
                            disabled={updateMutation.isPending}
                          >
                            Reset to Pending
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-red-500 hover:bg-red-50 ml-auto"
                          onClick={() => {
                            if (confirm("Delete this review permanently?")) {
                              deleteMutation.mutate(review.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Guest Review Info */}
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-500" />
            About Guest Reviews
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Guests can now submit reviews without creating an account. Guest reviews appear here with a "Guest" badge and require approval before going public.
            Reviews submitted by verified registered users are automatically marked as verified.
            You can approve, reject, or delete any review from this panel.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
