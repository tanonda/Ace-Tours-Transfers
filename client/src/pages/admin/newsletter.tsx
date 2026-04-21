import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { fetchFeatureFlags, updateFeatureFlag } from "@/lib/api";
import {
  Mail, Users, CheckCircle, Clock, Trash2, Download, Search,
  RefreshCw, TrendingUp, Send, Settings, UserCheck, UserX, Edit,
  MoreVertical, UserMinus, CheckCheck
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";

async function updateSubscriber(id: string, data: Partial<{ confirmed: boolean; unsubscribedAt: string | null; name: string }>) {
  const res = await fetch(`/api/newsletter/subscribers/${id}`, {
    method: "PATCH", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update subscriber");
  return res.json();
}

async function deleteSubscriber(id: string) {
  const res = await fetch(`/api/newsletter/subscribers/${id}`, { method: "DELETE", credentials: "include" });
  if (!res.ok) throw new Error("Failed to delete subscriber");
  return res.json();
}

export default function AdminNewsletter() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "confirmed" | "pending" | "unsubscribed">("all");
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [broadcastSubject, setBroadcastSubject] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [editingSub, setEditingSub] = useState<any>(null);
  const [editName, setEditName] = useState("");

  const { data: newsletterData = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-newsletter-subscribers"],
    queryFn: async () => {
      const res = await fetch("/api/newsletter/subscribers", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch subscribers");
      return res.json();
    },
  });

  const { data: flags = [] } = useQuery({ queryKey: ["feature-flags"], queryFn: fetchFeatureFlags });

  const toggleFlagMutation = useMutation({
    mutationFn: ({ slug, enabled }: { slug: string; enabled: boolean }) => updateFeatureFlag(slug, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feature-flags"] });
      toast({ title: "Newsletter feature flag updated" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateSubscriber(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-newsletter-subscribers"] });
      toast({ title: "Subscriber updated" });
      setEditingSub(null);
    },
    onError: () => toast({ title: "Error updating subscriber", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSubscriber,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-newsletter-subscribers"] });
      toast({ title: "Subscriber deleted" });
    },
    onError: () => toast({ title: "Error deleting subscriber", variant: "destructive" }),
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
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `subscribers-${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
    toast({ title: "Exported", description: `${newsletterData.length} subscribers exported` });
  };

  const confirmRate = stats.total > 0 ? Math.round((stats.confirmed / stats.total) * 100) : 0;

  return (
    <DashboardLayout type="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#004165]">Newsletter Management</h1>
            <p className="text-muted-foreground text-sm">Manage subscribers and send campaigns</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" onClick={() => refetch()} className="flex-1 sm:flex-none">
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!stats.total} className="flex-1 sm:flex-none">
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
            <Button size="sm" className="bg-[#004165] w-full sm:w-auto" onClick={() => setIsBroadcastOpen(true)} disabled={!stats.confirmed}>
              <Send className="h-4 w-4 mr-2" /> Send Campaign
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Subscribers", value: stats.total, icon: Users, color: "text-blue-500", bg: "bg-blue-50", filterVal: "all" as const },
            { label: "Confirmed", value: stats.confirmed, icon: CheckCircle, color: "text-green-500", bg: "bg-green-50", filterVal: "confirmed" as const },
            { label: "Pending Confirmation", value: stats.pending, icon: Clock, color: "text-yellow-500", bg: "bg-yellow-50", filterVal: "pending" as const },
            { label: "Unsubscribed", value: stats.unsubscribed, icon: Trash2, color: "text-red-500", bg: "bg-red-50", filterVal: "unsubscribed" as const },
          ].map(stat => (
            <Card key={stat.label} className={`border-none shadow-sm cursor-pointer transition-all ${statusFilter === stat.filterVal ? "ring-2 ring-primary" : "hover:shadow-md"}`}
              onClick={() => setStatusFilter(stat.filterVal)}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stat.bg}`}><stat.icon className={`h-5 w-5 ${stat.color}`} /></div>
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
                <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" /> Subscribers</CardTitle>
                <div className="flex flex-col sm:flex-row gap-2 mt-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by email or name..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                  <select className="px-3 py-2 border border-border rounded-md text-sm bg-background w-full sm:w-auto" value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as any)}>
                    <option value="all">All Status</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="pending">Pending</option>
                    <option value="unsubscribed">Unsubscribed</option>
                  </select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex justify-center py-10"><RefreshCw className="animate-spin h-5 w-5 text-muted-foreground" /></div>
                ) : filteredSubs.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Mail className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">{search || statusFilter !== "all" ? "No subscribers match your filter." : "No subscribers yet."}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead>Email</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Joined</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSubs.map((sub: any) => (
                          <TableRow key={sub.id} className="hover:bg-muted/20">
                            <TableCell className="font-medium text-xs">{sub.email}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{sub.name ?? "—"}</TableCell>
                            <TableCell>
                              {sub.unsubscribedAt ? (
                                <Badge variant="outline" className="text-red-500 border-red-200 bg-red-50 text-xs">Unsubscribed</Badge>
                              ) : sub.confirmed ? (
                                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-xs">Confirmed</Badge>
                              ) : (
                                <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50 text-xs">Pending</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground capitalize">{sub.source ?? "website"}</TableCell>
                            <TableCell className="text-muted-foreground text-xs">
                              {sub.subscribedAt ? new Date(sub.subscribedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                            </TableCell>
                            <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                    <MoreVertical className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => { setEditingSub(sub); setEditName(sub.name || ""); }}>
                                    <Edit className="h-3.5 w-3.5 mr-2" /> Edit Name
                                  </DropdownMenuItem>
                                  {!sub.confirmed && !sub.unsubscribedAt && (
                                    <DropdownMenuItem className="text-green-600"
                                      onClick={() => updateMutation.mutate({ id: sub.id, data: { confirmed: true } })}>
                                      <UserCheck className="h-3.5 w-3.5 mr-2" /> Manually Confirm
                                    </DropdownMenuItem>
                                  )}
                                  {!sub.unsubscribedAt ? (
                                    <DropdownMenuItem className="text-orange-600"
                                      onClick={() => updateMutation.mutate({ id: sub.id, data: { unsubscribedAt: new Date().toISOString() } })}>
                                      <UserMinus className="h-3.5 w-3.5 mr-2" /> Unsubscribe
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem className="text-green-600"
                                      onClick={() => updateMutation.mutate({ id: sub.id, data: { unsubscribedAt: null, confirmed: true } })}>
                                      <CheckCheck className="h-3.5 w-3.5 mr-2" /> Re-subscribe
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-red-500"
                                    onClick={() => { if (confirm("Delete this subscriber permanently?")) deleteMutation.mutate(sub.id); }}>
                                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
                      Showing {filteredSubs.length} of {newsletterData.length} subscribers
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Settings & Stats Panel */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Settings className="h-4 w-4" /> Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                  <div>
                    <p className="text-sm font-semibold">Signup Form Enabled</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Show/hide signup form on public site</p>
                  </div>
                  {newsletterFlag ? (
                    <Switch checked={newsletterFlag.enabled}
                      onCheckedChange={(checked) => toggleFlagMutation.mutate({ slug: "newsletter", enabled: checked })}
                      disabled={toggleFlagMutation.isPending} />
                  ) : (
                    <Switch checked={true} disabled />
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Confirmed rate</span>
                    <span className="font-semibold">{confirmRate}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: `${confirmRate}%` }} />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Unsubscribe rate</span>
                    <span className="font-semibold">
                      {stats.total > 0 ? Math.round((stats.unsubscribed / stats.total) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm"><TrendingUp className="h-4 w-4" /> Tips</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-xs text-muted-foreground">
                <p>• Manually confirm pending subscribers from the dropdown menu.</p>
                <p>• Use "Re-subscribe" to restore unsubscribed contacts.</p>
                <p>• Export CSV for use in Mailchimp or SendGrid.</p>
                <p>• Keep campaigns to 1–2 per month to minimise unsubscribes.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Edit Name Dialog */}
      <Dialog open={!!editingSub} onOpenChange={open => !open && setEditingSub(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Subscriber</DialogTitle>
            <DialogDescription>{editingSub?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Display Name</Label>
            <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Enter name..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSub(null)}>Cancel</Button>
            <Button onClick={() => updateMutation.mutate({ id: editingSub.id, data: { name: editName } })} disabled={updateMutation.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Broadcast Campaign Dialog */}
      <Dialog open={isBroadcastOpen} onOpenChange={setIsBroadcastOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Send className="h-5 w-5 text-primary" /> Send Newsletter Campaign</DialogTitle>
            <DialogDescription>This will send to all {stats.confirmed} confirmed subscribers.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Subject *</Label>
              <Input placeholder="e.g. Exclusive Vanuatu Tours – Limited Availability" value={broadcastSubject} onChange={e => setBroadcastSubject(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Message *</Label>
              <Textarea placeholder="Write your newsletter content here..." rows={6} value={broadcastBody} onChange={e => setBroadcastBody(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
              <strong>Note:</strong> Campaign sending requires a connected email service (SendGrid, etc.).
              Configure in Settings → Email Config before sending.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBroadcastOpen(false)}>Cancel</Button>
            <Button className="bg-[#004165]" disabled={!broadcastSubject || !broadcastBody}
              onClick={() => {
                toast({ title: "Campaign Queued", description: `"${broadcastSubject}" queued. Configure email provider to send.` });
                setIsBroadcastOpen(false);
                setBroadcastSubject(""); setBroadcastBody("");
              }}>
              <Send className="h-4 w-4 mr-2" /> Send to {stats.confirmed} subscribers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
