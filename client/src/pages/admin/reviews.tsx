import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useToast } from "@/hooks/use-toast";
import { Star, CheckCircle, XCircle, Trash2, MessageSquare, Search, RefreshCw, Filter, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

async function fetchAllReviews() {
  const res = await fetch("/api/admin/reviews", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch reviews");
  return res.json();
}
async function updateReviewStatus(id: string, status: "approved" | "rejected" | "pending") {
  const res = await fetch(`/api/admin/reviews/${id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Failed to update review");
  return res.json();
}
async function deleteReview(id: string) {
  const res = await fetch(`/api/admin/reviews/${id}`, { method: "DELETE", credentials: "include" });
  if (!res.ok) throw new Error("Failed to delete review");
  return res.json();
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`h-3.5 w-3.5 ${i <= rating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30"}`} />
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
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "rating-high" | "rating-low">("newest");
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: reviews = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: fetchAllReviews,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "approved" | "rejected" | "pending" }) => updateReviewStatus(id, status),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-reviews"] }); toast({ title: "Review updated" }); },
    onError: () => toast({ title: "Error", description: "Failed to update review", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteReview,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-reviews"] }); toast({ title: "Review deleted" }); },
    onError: () => toast({ title: "Error", description: "Failed to delete review", variant: "destructive" }),
  });

  const handleBulkAction = async (status: "approved" | "rejected") => {
    for (const id of selectedIds) {
      await updateReviewStatus(id, status);
    }
    queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
    toast({ title: `${selectedIds.size} review(s) ${status}` });
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} review(s) permanently?`)) return;
    for (const id of selectedIds) await deleteReview(id);
    queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
    toast({ title: `${selectedIds.size} review(s) deleted` });
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((r: any) => r.id)));
    }
  };

  let filtered = reviews.filter((r: any) => {
    const matchesFilter = filter === "all" || (r.status || "pending") === filter;
    const matchesSearch = !search ||
      r.authorName?.toLowerCase().includes(search.toLowerCase()) ||
      r.guestName?.toLowerCase().includes(search.toLowerCase()) ||
      r.comment?.toLowerCase().includes(search.toLowerCase()) ||
      r.tourTitle?.toLowerCase().includes(search.toLowerCase());
    const matchesRating = ratingFilter === "all" || String(r.rating) === ratingFilter;
    return matchesFilter && matchesSearch && matchesRating;
  });

  filtered = [...filtered].sort((a: any, b: any) => {
    if (sortBy === "newest") return new Date(b.createdAt||0).getTime() - new Date(a.createdAt||0).getTime();
    if (sortBy === "oldest") return new Date(a.createdAt||0).getTime() - new Date(b.createdAt||0).getTime();
    if (sortBy === "rating-high") return (b.rating||0) - (a.rating||0);
    if (sortBy === "rating-low") return (a.rating||0) - (b.rating||0);
    return 0;
  });

  const counts = {
    all: reviews.length,
    pending: reviews.filter((r: any) => !r.status || r.status === "pending").length,
    approved: reviews.filter((r: any) => r.status === "approved").length,
    rejected: reviews.filter((r: any) => r.status === "rejected").length,
  };

  const avgRating = reviews.length
    ? (reviews.reduce((s: number, r: any) => s + (r.rating || 0), 0) / reviews.length).toFixed(1)
    : "—";

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
            <p className="text-sm text-muted-foreground mt-0.5">Moderate guest reviews before they appear publicly</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {([["all", "All"], ["pending", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`p-4 rounded-xl border text-left transition-all ${
                filter === key ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-card border-border hover:border-primary/40"
              }`}>
              <div className="text-2xl font-bold">{counts[key]}</div>
              <div className="text-xs capitalize mt-0.5 opacity-80">{label}</div>
            </button>
          ))}
          <div className="p-4 rounded-xl border border-border bg-card text-left">
            <div className="text-2xl font-bold flex items-center gap-1">
              {avgRating} <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Avg Rating</div>
          </div>
        </div>

        {/* Rating Distribution */}
        {reviews.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-sm font-semibold text-foreground mb-3">Rating Distribution</div>
            <div className="space-y-2">
              {[5,4,3,2,1].map(star => {
                const count = reviews.filter((r: any) => r.rating === star).length;
                const pct = reviews.length ? (count / reviews.length) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-3 text-sm">
                    <div className="flex items-center gap-1 w-10 shrink-0">
                      <span className="text-xs font-medium">{star}</span>
                      <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                    </div>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div className="bg-yellow-400 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Filters + Search bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name, tour, or content..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={ratingFilter} onValueChange={setRatingFilter}>
            <SelectTrigger className="w-36">
              <Filter className="h-3.5 w-3.5 mr-1" />
              <SelectValue placeholder="Rating" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ratings</SelectItem>
              {[5,4,3,2,1].map(r => <SelectItem key={r} value={String(r)}>{r} Stars</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="rating-high">Highest Rating</SelectItem>
              <SelectItem value="rating-low">Lowest Rating</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bulk actions bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl">
            <span className="text-sm font-semibold text-foreground">{selectedIds.size} selected</span>
            <div className="flex gap-2 ml-auto">
              <Button size="sm" variant="outline" className="h-8 text-xs border-green-500/30 text-green-600 hover:bg-green-50"
                onClick={() => handleBulkAction("approved")}>
                <CheckCircle className="h-3 w-3 mr-1" /> Approve All
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs border-red-500/30 text-red-500 hover:bg-red-50"
                onClick={() => handleBulkAction("rejected")}>
                <XCircle className="h-3 w-3 mr-1" /> Reject All
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs text-red-500 hover:bg-red-50"
                onClick={handleBulkDelete}>
                <Trash2 className="h-3 w-3 mr-1" /> Delete All
              </Button>
            </div>
          </div>
        )}

        {/* Reviews Table */}
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-10">
                      <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0}
                        onChange={toggleSelectAll} className="rounded" />
                    </TableHead>
                    <TableHead>Guest</TableHead>
                    <TableHead>Tour / Product</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Review</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((review: any) => (
                    <TableRow key={review.id} className={`hover:bg-muted/20 transition-colors ${selectedIds.has(review.id) ? 'bg-primary/5' : ''}`}>
                      <TableCell>
                        <input type="checkbox" checked={selectedIds.has(review.id)} onChange={() => toggleSelect(review.id)} className="rounded" />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                            {(review.authorName || review.guestName || "G")[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-foreground">{review.authorName || review.guestName || "Anonymous"}</div>
                            {review.isGuest && <span className="text-[10px] bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded-full">Guest</span>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[140px] truncate">{review.tourTitle || "—"}</TableCell>
                      <TableCell><StarRating rating={review.rating || 5} /></TableCell>
                      <TableCell className="max-w-[200px]">
                        <p className="text-sm text-muted-foreground line-clamp-2">{review.comment || "—"}</p>
                      </TableCell>
                      <TableCell><StatusBadge status={review.status || "pending"} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {review.createdAt ? new Date(review.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setSelectedReview(review)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {(review.status || "pending") !== "approved" && (
                            <Button size="sm" variant="outline" className="h-7 text-xs border-green-500/30 text-green-600 hover:bg-green-50 hover:border-green-500"
                              onClick={() => updateMutation.mutate({ id: review.id, status: "approved" })} disabled={updateMutation.isPending}>
                              <CheckCircle className="h-3 w-3" />
                            </Button>
                          )}
                          {(review.status || "pending") !== "rejected" && (
                            <Button size="sm" variant="outline" className="h-7 text-xs border-red-500/30 text-red-500 hover:bg-red-50 hover:border-red-500"
                              onClick={() => updateMutation.mutate({ id: review.id, status: "rejected" })} disabled={updateMutation.isPending}>
                              <XCircle className="h-3 w-3" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:bg-red-50"
                            onClick={() => { if (confirm("Delete this review?")) deleteMutation.mutate(review.id); }} disabled={deleteMutation.isPending}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="px-4 py-2.5 border-t border-border text-xs text-muted-foreground">
                Showing {filtered.length} of {reviews.length} reviews
              </div>
            </div>
          )}
        </div>

        {/* Info card */}
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-500" /> About Guest Reviews
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Guests can submit reviews without creating an account. Guest reviews require approval before going public.
            Verified registered users' reviews are automatically marked as verified. Use bulk selection for fast moderation.
          </p>
        </div>
      </div>

      {/* Review Detail Dialog */}
      <Dialog open={!!selectedReview} onOpenChange={open => !open && setSelectedReview(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
              Review Detail
            </DialogTitle>
            <DialogDescription>Full review information and moderation</DialogDescription>
          </DialogHeader>
          {selectedReview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/40 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">Guest</div>
                  <div className="font-semibold">{selectedReview.authorName || selectedReview.guestName || "Anonymous"}</div>
                  {selectedReview.isGuest && <Badge variant="outline" className="text-xs mt-1">Guest</Badge>}
                </div>
                <div className="bg-muted/40 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">Tour</div>
                  <div className="font-semibold">{selectedReview.tourTitle || "—"}</div>
                </div>
                <div className="bg-muted/40 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">Rating</div>
                  <StarRating rating={selectedReview.rating || 5} />
                </div>
                <div className="bg-muted/40 rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">Status</div>
                  <StatusBadge status={selectedReview.status || "pending"} />
                </div>
              </div>
              {selectedReview.comment && (
                <div className="bg-muted/40 rounded-lg p-4">
                  <div className="text-xs text-muted-foreground mb-2">Review Content</div>
                  <p className="text-sm text-foreground leading-relaxed">{selectedReview.comment}</p>
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                Submitted: {selectedReview.createdAt ? new Date(selectedReview.createdAt).toLocaleString('en-AU') : "Unknown"}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedReview(null)}>Close</Button>
            {selectedReview && (selectedReview.status || "pending") !== "approved" && (
              <Button className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => { updateMutation.mutate({ id: selectedReview.id, status: "approved" }); setSelectedReview(null); }}>
                <CheckCircle className="h-4 w-4 mr-1" /> Approve
              </Button>
            )}
            {selectedReview && (selectedReview.status || "pending") !== "rejected" && (
              <Button variant="destructive"
                onClick={() => { updateMutation.mutate({ id: selectedReview.id, status: "rejected" }); setSelectedReview(null); }}>
                <XCircle className="h-4 w-4 mr-1" /> Reject
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
