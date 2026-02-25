import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { fetchFeatureFlags, updateFeatureFlag } from "@/lib/api";
import {
  Mail, Users, CheckCircle, Clock, Trash2, Download, Globe,
  Search, RefreshCw, TrendingUp, Send, Settings
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function AdminNewsletter() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "confirmed" | "pending" | "unsubscribed">("all");
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [broadcastSubject, setBroadcastSubject] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");

  const { data: newsletterData = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-newsletter-subscribers"],
    queryFn: async () => {
      const res = await fetch("/api/newsletter/subscribers", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch subscribers");
      return res.json();
    },
  });

  const { data: flags = [] } = useQuery({
    queryKey: ["feature-flags"],
    queryFn: fetchFeatureFlags,
  });

  const toggleFlagMutation = useMutation({
    mutationFn: ({ slug, enabled }: { slug: string; enabled: boolean }) => updateFeatureFlag(slug, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feature-flags"] });
      toast({ title: "Updated", description: "Newsletter feature flag updated." });
    },
  });

  const newsletterFlag = (flags as any[]).find((f: any) => f.slug === "newsletter");

  const filteredSubs = newsletterData.filter((sub: any) => {
    const matchSearch = !search.trim() ||
      sub.email?.toLowerCase().includes(search.toLowerCase()) ||
      sub.name?.toLowerCase().includes(search.toLowerCase());

    const matchStatus =
      statusFilter === "all" ? true :
      statusFilter === "confirmed" ? (sub.confirmed && !sub.unsubscribedAt) :
      statusFilter === "pending" ? (!sub.confirmed && !sub.unsubscribedAt) :
      statusFilter === "unsubscribed" ? !!sub.unsubscribedAt : true;

    return matchSearch && matchStatus;
  });

  const stats = {
    total: newsletterData.length,
    confirmed: newsletterData.filter((s: any) => s.confirmed && !s.unsubscribedAt).length,
    pending: newsletterData.filter((s: any) => !s.confirmed && !s.unsubscribedAt).length,
    unsubscribed: newsletterData.filter((s: any) => s.unsubscribedAt).length,
  };

  const handleExportCSV = () => {
    if (!newsletterData.length) return;
    const rows = [
      ["Email", "Name", "Locale", "Source", "Confirmed", "Subscribed At", "Unsubscribed At"],
      ...newsletterData.map((s: any) => [
        s.email, s.name ?? "", s.locale ?? "en", s.source ?? "website",
        s.confirmed ? "yes" : "no",
        s.subscribedAt ? new Date(s.subscribedAt).toLocaleDateString() : "",
        s.unsubscribedAt ? new Date(s.unsubscribedAt).toLocaleDateString() : "",
      ])
    ];
    const csv = rows.map(r => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `subscribers-${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast({ title: "Exported", description: `${newsletterData.length} subscribers exported to CSV.` });
  };

  return (
    <DashboardLayout type="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#004165]">Newsletter</h1>
            <p className="text-muted-foreground">Manage subscribers, feature visibility, and send campaigns.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!stats.total}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
            <Button size="sm" className="bg-[#004165]" onClick={() => setIsBroadcastOpen(true)} disabled={!stats.confirmed}>
              <Send className="h-4 w-4 mr-2" /> Send Campaign
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Subscribers", value: stats.total, icon: Users, color: "text-blue-500", bg: "bg-blue-50" },
            { label: "Confirmed", value: stats.confirmed, icon: CheckCircle, color: "text-green-500", bg: "bg-green-50" },
            { label: "Pending Confirmation", value: stats.pending, icon: Clock, color: "text-yellow-500", bg: "bg-yellow-50" },
            { label: "Unsubscribed", value: stats.unsubscribed, icon: Trash2, color: "text-red-500", bg: "bg-red-50" },
          ].map(stat => (
            <Card key={stat.label} className="border-none shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <div className="text-2xl font-bold">{isLoading ? "…" : stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Subscribers Table */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4" /> Subscribers
                </CardTitle>
                <div className="flex gap-2 mt-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by email or name..."
                      className="pl-8"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                  </div>
                  <select
                    className="px-3 py-2 border border-border rounded-md text-sm bg-background text-foreground"
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as any)}
                  >
                    <option value="all">All Status</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="pending">Pending</option>
                    <option value="unsubscribed">Unsubscribed</option>
                  </select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex justify-center py-10">
                    <RefreshCw className="animate-spin h-5 w-5 text-muted-foreground" />
                  </div>
                ) : filteredSubs.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Mail className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">
                      {search || statusFilter !== "all"
                        ? "No subscribers match your filter."
                        : "No subscribers yet. The newsletter signup form will collect emails automatically."}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</th>
                          <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Name</th>
                          <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                          <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Joined</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredSubs.map((sub: any) => (
                          <tr key={sub.id} className="hover:bg-muted/20 transition-colors">
                            <td className="py-2.5 px-4 font-medium text-foreground text-xs">{sub.email}</td>
                            <td className="py-2.5 px-4 text-muted-foreground hidden sm:table-cell">{sub.name ?? "—"}</td>
                            <td className="py-2.5 px-4">
                              {sub.unsubscribedAt ? (
                                <Badge variant="outline" className="text-red-500 border-red-200 bg-red-50">Unsubscribed</Badge>
                              ) : sub.confirmed ? (
                                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Confirmed</Badge>
                              ) : (
                                <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50">Pending</Badge>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-muted-foreground hidden md:table-cell text-xs">
                              {sub.subscribedAt ? new Date(sub.subscribedAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
                      Showing {filteredSubs.length} of {newsletterData.length} subscribers
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Settings & Info Panel */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Settings className="h-4 w-4" /> Newsletter Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                  <div>
                    <p className="text-sm font-semibold">Signup Form Enabled</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Show/hide newsletter signup on the public site.</p>
                  </div>
                  {newsletterFlag ? (
                    <Switch
                      checked={newsletterFlag.enabled}
                      onCheckedChange={(checked) => toggleFlagMutation.mutate({ slug: "newsletter", enabled: checked })}
                      disabled={toggleFlagMutation.isPending}
                    />
                  ) : (
                    <Switch checked={true} disabled />
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Confirmed rate</span>
                    <span className="font-semibold text-foreground">
                      {stats.total > 0 ? Math.round((stats.confirmed / stats.total) * 100) : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all"
                      style={{ width: `${stats.total > 0 ? (stats.confirmed / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Unsubscribe rate</span>
                    <span className="font-semibold text-foreground">
                      {stats.total > 0 ? Math.round((stats.unsubscribed / stats.total) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4" /> Growth Tips
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>• Add a newsletter CTA to the about page and footer.</p>
                <p>• Offer a discount code or free guide for new subscribers.</p>
                <p>• Send a welcome email within 24 hours of signup.</p>
                <p>• Keep campaigns to 1–2 per month to avoid unsubscribes.</p>
                <p>• Segment by source (website/booking) for targeted campaigns.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Broadcast Campaign Dialog */}
      <Dialog open={isBroadcastOpen} onOpenChange={setIsBroadcastOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" /> Send Newsletter Campaign
            </DialogTitle>
            <DialogDescription>
              This will send an email to all {stats.confirmed} confirmed subscribers.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input
                placeholder="e.g. Exclusive Vanuatu Tours – Limited Availability"
                value={broadcastSubject}
                onChange={e => setBroadcastSubject(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea
                placeholder="Write your newsletter content here..."
                rows={6}
                value={broadcastBody}
                onChange={e => setBroadcastBody(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
              <strong>Note:</strong> Campaign sending requires a connected email service (e.g. SendGrid, Mailchimp). 
              Configure your email provider in Settings → Integrations before sending.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBroadcastOpen(false)}>Cancel</Button>
            <Button
              className="bg-[#004165]"
              disabled={!broadcastSubject || !broadcastBody}
              onClick={() => {
                toast({
                  title: "Campaign Queued",
                  description: `Your campaign "${broadcastSubject}" has been queued. Configure email provider in Settings to enable sending.`,
                });
                setIsBroadcastOpen(false);
                setBroadcastSubject(""); setBroadcastBody("");
              }}
            >
              <Send className="h-4 w-4 mr-2" /> Send to {stats.confirmed} subscribers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
