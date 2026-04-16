import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchNotifications, markNotificationRead } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import {
  Bell, Check, ExternalLink, Loader2, Send, Megaphone,
  Info, AlertTriangle, CheckCircle, XCircle, Trash2, Users, User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const TYPE_CONFIG: Record<string, { label: string; icon: any; iconClass: string; badge: string }> = {
  info:    { label: "Info",    icon: Info,          iconClass: "text-blue-600",   badge: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  success: { label: "Success", icon: CheckCircle,   iconClass: "text-green-600",  badge: "bg-green-500/10 text-green-600 border-green-500/20" },
  warning: { label: "Warning", icon: AlertTriangle, iconClass: "text-yellow-600", badge: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
  error:   { label: "Alert",   icon: XCircle,       iconClass: "text-red-500",    badge: "bg-red-500/10 text-red-500 border-red-500/20" },
};

export default function AdminNotifications() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({ title: "", message: "", type: "info", link: "", audience: "all" });

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    refetchInterval: 30000,
  });

  const { data: allNotifications = [], isLoading: isLoadingAll } = useQuery({
    queryKey: ["notifications-all"],
    queryFn: async () => {
      const res = await fetch("/api/notifications/all", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch("/api/users", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });
  const staffUsers = (allUsers as any[]).filter((u: any) => u.role === "admin" || u.role === "field_service");

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-all"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const csrfToken = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/)?.[1] || "";
      const res = await fetch("/api/notifications/mark-all-read", { method: "POST", credentials: "include", headers: { "X-CSRF-Token": csrfToken } });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-all"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-all"] });
      toast({ title: "Notification deleted" });
    },
  });

  const broadcastMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { title: form.title.trim(), message: form.message.trim(), type: form.type };
      if (form.link.trim()) payload.link = form.link.trim();
      if (form.audience !== "all") payload.userId = form.audience;
      const res = await fetch("/api/notifications/broadcast", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed to send"); }
      return res.json();
    },
    onSuccess: () => {
      setForm({ title: "", message: "", type: "info", link: "", audience: "all" });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-all"] });
      toast({ title: "Message sent!", description: "Notification broadcast successfully." });
    },
    onError: (err: Error) => toast({ title: "Failed to send", description: err.message, variant: "destructive" }),
  });

  const unreadCount = (notifications as any[]).filter((n: any) => !n.read).length;

  function NotificationRow({ n, showDelete = false }: { n: any; showDelete?: boolean }) {
    const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
    const Icon = cfg.icon;
    return (
      <div className={`p-5 flex gap-4 transition-colors ${n.read ? "bg-background hover:bg-muted/30" : "bg-primary/5 hover:bg-primary/10"}`}>
        <div className="pt-0.5 shrink-0">
          <Icon className={`h-5 w-5 ${cfg.iconClass}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-1 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`font-semibold text-sm ${!n.read ? "text-foreground" : "text-foreground/80"}`}>{n.title}</h3>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.badge}`}>{cfg.label}</span>
              {!n.userId && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-purple-500/10 text-purple-600 border-purple-500/20">All Staff</span>}
              {!n.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0 inline-block" />}
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {new Date(n.createdAt).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <p className={`text-sm mb-3 leading-relaxed ${!n.read ? "text-foreground/90" : "text-muted-foreground"}`}>{n.message}</p>
          <div className="flex gap-2 flex-wrap">
            {n.link && (
              <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={() => setLocation(n.link)}>
                View Details <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            )}
            {!n.read && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => markReadMutation.mutate(n.id)} disabled={markReadMutation.isPending}>
                <Check className="h-3 w-3 mr-1" /> Mark read
              </Button>
            )}
            {showDelete && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950" onClick={() => deleteMutation.mutate(n.id)} disabled={deleteMutation.isPending}>
                <Trash2 className="h-3 w-3 mr-1" /> Delete
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout type="admin">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("dashboard.notifications")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">System alerts, booking events, and staff announcements.</p>
        </div>

        <Tabs defaultValue="inbox">
          <TabsList>
            <TabsTrigger value="inbox" className="gap-2">
              <Bell className="h-4 w-4" />
              Inbox
              {unreadCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground leading-none">
                  {unreadCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="board" className="gap-2">
              <Megaphone className="h-4 w-4" />
              Message Board
            </TabsTrigger>
            <TabsTrigger value="history">All History</TabsTrigger>
          </TabsList>

          {/* INBOX */}
          <TabsContent value="inbox" className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}` : "You're all caught up!"}
              </p>
              {unreadCount > 0 && (
                <Button variant="outline" size="sm" onClick={() => markAllReadMutation.mutate()} disabled={markAllReadMutation.isPending}>
                  {markAllReadMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-2" />}
                  Mark all read
                </Button>
              )}
            </div>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              {isLoading ? (
                <div className="p-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : (notifications as any[]).length === 0 ? (
                <div className="p-16 text-center text-muted-foreground">
                  <Bell className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p className="font-medium">No unread notifications</p>
                  <p className="text-sm mt-1">Check "All History" to see past notifications.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {(notifications as any[]).map((n: any) => <NotificationRow key={n.id} n={n} />)}
                </div>
              )}
            </div>
          </TabsContent>

          {/* MESSAGE BOARD */}
          <TabsContent value="board" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Compose */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Megaphone className="h-5 w-5 text-primary" /> Compose Message
                    </CardTitle>
                    <CardDescription>
                      Send an announcement to all staff or a specific team member.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Audience</Label>
                      <Select value={form.audience} onValueChange={v => setForm(f => ({ ...f, audience: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">
                            <div className="flex items-center gap-2"><Users className="h-4 w-4" /> All Staff</div>
                          </SelectItem>
                          {staffUsers.map((u: any) => (
                            <SelectItem key={u.id} value={u.id}>
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4" /> {u.name}
                                <span className="text-muted-foreground text-xs">({u.role})</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Type</Label>
                      <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
                            const Icon = cfg.icon;
                            return (
                              <SelectItem key={key} value={key}>
                                <div className="flex items-center gap-2">
                                  <Icon className={`h-4 w-4 ${cfg.iconClass}`} /> {cfg.label}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Title *</Label>
                      <Input
                        placeholder="e.g. Pickup change for tomorrow"
                        value={form.title}
                        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                        maxLength={100}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Message *</Label>
                      <Textarea
                        placeholder="Write your message here..."
                        value={form.message}
                        onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                        rows={4}
                        maxLength={1000}
                      />
                      <p className="text-xs text-muted-foreground text-right">{form.message.length}/1000</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Link <span className="text-muted-foreground font-normal">(optional)</span></Label>
                      <Input
                        placeholder="e.g. /admin/bookings"
                        value={form.link}
                        onChange={e => setForm(f => ({ ...f, link: e.target.value }))}
                      />
                    </div>

                    <Button
                      className="w-full"
                      onClick={() => broadcastMutation.mutate()}
                      disabled={broadcastMutation.isPending || !form.title.trim() || !form.message.trim()}
                    >
                      {broadcastMutation.isPending
                        ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</>
                        : <><Send className="h-4 w-4 mr-2" /> Send Message</>
                      }
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Recent sent */}
              <div className="lg:col-span-3">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-foreground">Recently Sent</h3>
                  <span className="text-xs text-muted-foreground">Most recent 20</span>
                </div>
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  {isLoadingAll ? (
                    <div className="p-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : (allNotifications as any[]).length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground">
                      <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-20" />
                      <p className="font-medium">No messages sent yet</p>
                      <p className="text-sm mt-1">Use the form to send your first announcement.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {(allNotifications as any[]).slice(0, 20).map((n: any) => (
                        <NotificationRow key={n.id} n={n} showDelete />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ALL HISTORY */}
          <TabsContent value="history" className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">All system and manual notifications.</p>
              <span className="text-xs text-muted-foreground">{(allNotifications as any[]).length} total</span>
            </div>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              {isLoadingAll ? (
                <div className="p-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : (allNotifications as any[]).length === 0 ? (
                <div className="p-16 text-center text-muted-foreground">
                  <Bell className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No notification history yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {(allNotifications as any[]).map((n: any) => (
                    <NotificationRow key={n.id} n={n} showDelete />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
