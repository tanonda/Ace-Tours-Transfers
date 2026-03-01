import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchNotifications, markNotificationRead } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useLocation } from "wouter";
import {
  Bell, BellOff, Check, CheckCheck, ExternalLink, Loader2, Send, Megaphone,
  Info, AlertTriangle, CheckCircle, XCircle, Trash2, Users, User, Filter,
  RefreshCw, MessageSquare, Clock, Search, ChevronDown, Inbox, History,
  Zap, Pin, MoreHorizontal, Archive
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// ─── Type config ──────────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  info:    { label: "Info",    Icon: Info,          pill: "bg-blue-500/12 text-blue-600 border-blue-400/30",   dot: "bg-blue-500",   glow: "shadow-blue-500/20" },
  success: { label: "Success", Icon: CheckCircle,   pill: "bg-emerald-500/12 text-emerald-600 border-emerald-400/30", dot: "bg-emerald-500", glow: "shadow-emerald-500/20" },
  warning: { label: "Warning", Icon: AlertTriangle, pill: "bg-amber-500/12 text-amber-600 border-amber-400/30",  dot: "bg-amber-500",  glow: "shadow-amber-500/20" },
  error:   { label: "Alert",   Icon: XCircle,       pill: "bg-red-500/12 text-red-500 border-red-400/30",       dot: "bg-red-500",    glow: "shadow-red-500/20" },
} as const;

type NotifType = keyof typeof TYPE_CONFIG;

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(date).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

// ─── Notification card ────────────────────────────────────────────────────────
function NotifCard({
  n, onMarkRead, onDelete, onNavigate, isMarkingRead, isDeleting, compact = false
}: {
  n: any; onMarkRead?: () => void; onDelete?: () => void;
  onNavigate?: () => void; isMarkingRead?: boolean; isDeleting?: boolean; compact?: boolean;
}) {
  const cfg = TYPE_CONFIG[n.type as NotifType] ?? TYPE_CONFIG.info;
  const { Icon } = cfg;
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className={`group relative flex gap-3 px-4 py-3.5 transition-all duration-150 border-b border-border/60 last:border-0
      ${!n.read ? "bg-primary/[0.03]" : "hover:bg-muted/40"}`}
    >
      {/* Unread bar */}
      {!n.read && <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full bg-primary" />}

      {/* Icon */}
      <div className={`shrink-0 mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center ${cfg.pill}`}>
        <Icon className="h-4 w-4" />
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-sm font-semibold leading-snug ${n.read ? "text-foreground/70" : "text-foreground"}`}>
              {n.title}
            </span>
            {!n.userId && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-600 border border-purple-400/20">
                <Users className="h-2.5 w-2.5" /> All Staff
              </span>
            )}
            {!n.read && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
            {/* Action menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(v => !v)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-all"
              >
                <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-6 z-50 w-40 rounded-lg border border-border bg-popover shadow-lg py-1 text-sm">
                  {!n.read && onMarkRead && (
                    <button onClick={() => { onMarkRead(); setShowMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted text-left">
                      <Check className="h-3.5 w-3.5" /> Mark read
                    </button>
                  )}
                  {n.link && onNavigate && (
                    <button onClick={() => { onNavigate(); setShowMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted text-left">
                      <ExternalLink className="h-3.5 w-3.5" /> View page
                    </button>
                  )}
                  {onDelete && (
                    <button onClick={() => { onDelete(); setShowMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950 text-red-500 text-left">
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <p className={`text-xs mt-0.5 leading-relaxed ${n.read ? "text-muted-foreground" : "text-foreground/80"}`}>
          {n.message}
        </p>

        {/* Inline actions */}
        {!compact && (
          <div className="flex items-center gap-2 mt-2">
            {n.link && onNavigate && (
              <button onClick={onNavigate}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
                View details <ExternalLink className="h-3 w-3" />
              </button>
            )}
            {!n.read && onMarkRead && (
              <button onClick={onMarkRead} disabled={isMarkingRead}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                {isMarkingRead ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Mark read
              </button>
            )}
            {onDelete && (
              <button onClick={onDelete} disabled={isDeleting}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-red-500 transition-colors ml-auto">
                {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Compose panel ────────────────────────────────────────────────────────────
function ComposePanel({ staffUsers, onSent }: { staffUsers: any[]; onSent: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ title: "", message: "", type: "info" as NotifType, link: "", audience: "all" });
  const [preview, setPreview] = useState(false);

  const broadcastMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { title: form.title.trim(), message: form.message.trim(), type: form.type };
      if (form.link.trim()) payload.link = form.link.trim();
      if (form.audience !== "all") payload.userId = form.audience;
      const res = await fetch("/api/notifications/broadcast", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      setForm({ title: "", message: "", type: "info", link: "", audience: "all" });
      setPreview(false);
      toast({ title: "📣 Message sent", description: "Your notification was broadcast successfully." });
      onSent();
    },
    onError: (err: Error) => toast({ title: "Send failed", description: err.message, variant: "destructive" }),
  });

  const cfg = TYPE_CONFIG[form.type];
  const { Icon } = cfg;
  const recipientLabel = form.audience === "all" ? "All Staff" : staffUsers.find(u => u.id === form.audience)?.name ?? "Unknown";
  const canSend = form.title.trim().length > 0 && form.message.trim().length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Megaphone className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="font-semibold text-sm">Compose</span>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setPreview(false)} className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${!preview ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}>Edit</button>
          <button onClick={() => setPreview(true)} disabled={!canSend} className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${preview ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground disabled:opacity-40"}`}>Preview</button>
        </div>
      </div>

      {preview ? (
        /* Preview */
        <div className="flex-1 p-4 space-y-3">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Preview — as seen by recipient</p>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <NotifCard n={{ ...form, id: "preview", read: false, createdAt: new Date().toISOString(), userId: form.audience !== "all" ? form.audience : null }} compact />
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between"><span>To:</span><span className="font-medium text-foreground">{recipientLabel}</span></div>
            <div className="flex justify-between"><span>Type:</span><span className="font-medium text-foreground">{cfg.label}</span></div>
            {form.link && <div className="flex justify-between"><span>Link:</span><span className="font-medium text-foreground truncate ml-2">{form.link}</span></div>}
          </div>
        </div>
      ) : (
        /* Edit form */
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Audience + Type row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">To</Label>
              <Select value={form.audience} onValueChange={v => setForm(f => ({ ...f, audience: v }))}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all"><div className="flex items-center gap-2"><Users className="h-3.5 w-3.5" />All Staff</div></SelectItem>
                  {staffUsers.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>
                      <div className="flex items-center gap-2"><User className="h-3.5 w-3.5" />{u.name}</div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as NotifType }))}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(TYPE_CONFIG) as [NotifType, typeof TYPE_CONFIG[NotifType]][]).map(([key, c]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <c.Icon className={`h-3.5 w-3.5 ${c.pill.split(" ")[1]}`} />
                        {c.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Subject *</Label>
            <Input
              className="h-8 text-sm"
              placeholder="e.g. Schedule change for tomorrow"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              maxLength={100}
            />
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Message *</Label>
              <span className="text-[10px] text-muted-foreground">{form.message.length}/1000</span>
            </div>
            <Textarea
              className="text-sm resize-none"
              placeholder="Write your message..."
              rows={5}
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              maxLength={1000}
            />
          </div>

          {/* Link */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Link <span className="opacity-60">(optional)</span></Label>
            <Input
              className="h-8 text-sm font-mono"
              placeholder="/admin/bookings"
              value={form.link}
              onChange={e => setForm(f => ({ ...f, link: e.target.value }))}
            />
          </div>
        </div>
      )}

      {/* Footer send */}
      <div className="px-4 py-3 border-t border-border bg-muted/30">
        <Button
          className="w-full h-9 gap-2 font-semibold"
          onClick={() => broadcastMutation.mutate()}
          disabled={broadcastMutation.isPending || !canSend}
        >
          {broadcastMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {broadcastMutation.isPending ? "Sending..." : `Send to ${recipientLabel}`}
        </Button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AdminNotifications() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [tab, setTab] = useState<"inbox" | "board" | "history">("inbox");
  const [typeFilter, setTypeFilter] = useState<"all" | NotifType>("all");
  const [search, setSearch] = useState("");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  // ── Queries ──
  const { data: inbox = [], isLoading: inboxLoading, refetch: refetchInbox } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    refetchInterval: 30000,
  });

  const { data: allNotifs = [], isLoading: allLoading, refetch: refetchAll } = useQuery({
    queryKey: ["notifications-all"],
    queryFn: async () => {
      const res = await fetch("/api/notifications/all", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
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
  const staffUsers = (allUsers as any[]).filter(u => u.role === "admin" || u.role === "field_service");

  // ── Mutations ──
  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-all"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications/mark-all-read", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-all"] });
      toast({ title: "All notifications marked as read" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-all"] });
    },
  });

  // ── Derived data ──
  const unreadCount = (inbox as any[]).filter(n => !n.read).length;

  function applyFilters(items: any[]) {
    return items.filter(n => {
      if (typeFilter !== "all" && n.type !== typeFilter) return false;
      if (showUnreadOnly && n.read) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!n.title.toLowerCase().includes(q) && !n.message.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }

  const filteredInbox = applyFilters(inbox as any[]);
  const filteredHistory = applyFilters(allNotifs as any[]);
  // Board = manually created (userId null = all staff, or targeted to specific user) — exclude system ones by heuristic
  const boardMessages = (allNotifs as any[]).filter(n => !n.type || true); // show all in board for now

  function refetchAll2() {
    refetchInbox();
    refetchAll();
  }

  // ── Stats ──
  const stats = {
    total: (allNotifs as any[]).length,
    unread: unreadCount,
    broadcasts: (allNotifs as any[]).filter(n => !n.userId).length,
    alerts: (allNotifs as any[]).filter(n => n.type === "error" || n.type === "warning").length,
  };

  return (
    <DashboardLayout type="admin">
      <div className="flex flex-col gap-5 h-full">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
              <Bell className="h-6 w-6 text-primary" />
              Notifications
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-primary text-primary-foreground">
                  {unreadCount}
                </span>
              )}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">System alerts, booking events and staff broadcasts</p>
          </div>
          <Button variant="outline" size="sm" onClick={refetchAll2} className="gap-2 shrink-0">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>

        {/* ── KPI strip ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total",      value: stats.total,      icon: Bell,        color: "text-foreground" },
            { label: "Unread",     value: stats.unread,     icon: Inbox,       color: "text-primary" },
            { label: "Broadcasts", value: stats.broadcasts, icon: Megaphone,   color: "text-purple-600" },
            { label: "Alerts",     value: stats.alerts,     icon: AlertTriangle, color: "text-amber-600" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <Icon className={`h-5 w-5 shrink-0 ${color}`} />
              <div>
                <div className={`text-2xl font-bold leading-none ${color}`}>{value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Main panel ── */}
        <div className="flex flex-col flex-1 bg-card border border-border rounded-xl overflow-hidden min-h-0">

          {/* Tab bar */}
          <div className="flex items-center border-b border-border px-4 gap-1 shrink-0 flex-wrap">
            {[
              { id: "inbox",   label: "Inbox",         icon: Inbox,       count: unreadCount },
              { id: "board",   label: "Message Board", icon: Megaphone,   count: null },
              { id: "history", label: "All History",   icon: History,     count: null },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as any)}
                className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                  ${tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
                {t.count !== null && t.count > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground leading-none">
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── INBOX ── */}
          {tab === "inbox" && (
            <div className="flex flex-col flex-1 min-h-0">
              {/* Toolbar */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/60 bg-muted/20 flex-wrap shrink-0">
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary/50"
                    placeholder="Search notifications..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <Select value={typeFilter} onValueChange={v => setTypeFilter(v as any)}>
                  <SelectTrigger className="h-7 text-xs w-[110px]"><SelectValue placeholder="All types" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {Object.entries(TYPE_CONFIG).map(([k, c]) => (
                      <SelectItem key={k} value={k}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  onClick={() => setShowUnreadOnly(v => !v)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors
                    ${showUnreadOnly ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}
                >
                  <BellOff className="h-3 w-3" /> Unread only
                </button>
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs ml-auto gap-1.5"
                    onClick={() => markAllReadMutation.mutate()} disabled={markAllReadMutation.isPending}>
                    {markAllReadMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
                    Mark all read
                  </Button>
                )}
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto">
                {inboxLoading ? (
                  <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : filteredInbox.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                    <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                      <Bell className="h-6 w-6 opacity-30" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium">{search || showUnreadOnly || typeFilter !== "all" ? "No matching notifications" : "You're all caught up!"}</p>
                      <p className="text-sm mt-0.5">
                        {search || showUnreadOnly || typeFilter !== "all" ? "Try adjusting your filters" : "No unread notifications right now"}
                      </p>
                    </div>
                  </div>
                ) : filteredInbox.map((n: any) => (
                  <NotifCard
                    key={n.id} n={n}
                    onMarkRead={() => markReadMutation.mutate(n.id)}
                    onDelete={() => deleteMutation.mutate(n.id)}
                    onNavigate={n.link ? () => setLocation(n.link) : undefined}
                    isMarkingRead={markReadMutation.isPending}
                    isDeleting={deleteMutation.isPending}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── MESSAGE BOARD ── */}
          {tab === "board" && (
            <div className="flex flex-1 min-h-0 divide-x divide-border">
              {/* Compose */}
              <div className="w-72 xl:w-80 shrink-0 flex flex-col">
                <ComposePanel staffUsers={staffUsers} onSent={refetchAll2} />
              </div>

              {/* Feed */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="px-4 py-2.5 border-b border-border/60 bg-muted/20 flex items-center justify-between shrink-0">
                  <span className="text-xs font-medium text-muted-foreground">BROADCAST HISTORY</span>
                  <span className="text-xs text-muted-foreground">{boardMessages.length} messages</span>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {allLoading ? (
                    <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : boardMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                        <Megaphone className="h-6 w-6 opacity-30" />
                      </div>
                      <div className="text-center">
                        <p className="font-medium">No broadcasts yet</p>
                        <p className="text-sm mt-0.5">Use the compose panel to send your first message</p>
                      </div>
                    </div>
                  ) : boardMessages.map((n: any) => (
                    <NotifCard
                      key={n.id} n={n}
                      onDelete={() => deleteMutation.mutate(n.id)}
                      onNavigate={n.link ? () => setLocation(n.link) : undefined}
                      isDeleting={deleteMutation.isPending}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── ALL HISTORY ── */}
          {tab === "history" && (
            <div className="flex flex-col flex-1 min-h-0">
              {/* Toolbar */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/60 bg-muted/20 flex-wrap shrink-0">
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary/50"
                    placeholder="Search all notifications..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <Select value={typeFilter} onValueChange={v => setTypeFilter(v as any)}>
                  <SelectTrigger className="h-7 text-xs w-[110px]"><SelectValue placeholder="All types" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {Object.entries(TYPE_CONFIG).map(([k, c]) => (
                      <SelectItem key={k} value={k}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground ml-auto">{filteredHistory.length} results</span>
              </div>

              <div className="flex-1 overflow-y-auto">
                {allLoading ? (
                  <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : filteredHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                    <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                      <History className="h-6 w-6 opacity-30" />
                    </div>
                    <p className="font-medium">{search || typeFilter !== "all" ? "No matching results" : "No notification history yet"}</p>
                  </div>
                ) : filteredHistory.map((n: any) => (
                  <NotifCard
                    key={n.id} n={n}
                    onMarkRead={!n.read ? () => markReadMutation.mutate(n.id) : undefined}
                    onDelete={() => deleteMutation.mutate(n.id)}
                    onNavigate={n.link ? () => setLocation(n.link) : undefined}
                    isMarkingRead={markReadMutation.isPending}
                    isDeleting={deleteMutation.isPending}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
