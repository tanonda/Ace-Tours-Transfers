import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  ShieldAlert, ShieldCheck, AlertTriangle, CheckCircle2, XCircle,
  Eye, RefreshCw, TrendingUp, Users, Mail, Zap, Clock, DollarSign,
  UserX, MailX, Search, Filter, Ban, Shield, ChevronDown
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface FlaggedBooking {
  id: string;
  customerName: string;
  customerEmail: string;
  tourName: string;
  date: string;
  guests: number;
  totalAmountCents: number;
  status: string;
  createdAt: string;
  notesClean: string;
  fraud: { score: number; level: string; signals: string[]; } | null;
}

async function fetchFlaggedBookings(): Promise<FlaggedBooking[]> {
  const res = await fetch("/api/admin/fraud", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch flagged bookings");
  return res.json();
}
async function approveBooking(id: string) {
  const csrfToken = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/)?.[1] || "";
  const res = await fetch(`/api/admin/fraud/${id}/approve`, { method: "POST", credentials: "include", headers: { "X-CSRF-Token": csrfToken } });
  if (!res.ok) throw new Error("Failed to approve booking");
  return res.json();
}
async function dismissBooking(id: string) {
  const csrfToken = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/)?.[1] || "";
  const res = await fetch(`/api/admin/fraud/${id}/dismiss`, { method: "POST", credentials: "include", headers: { "X-CSRF-Token": csrfToken } });
  if (!res.ok) throw new Error("Failed to dismiss booking");
  return res.json();
}
async function whitelistEmail(email: string) {
  const csrfToken = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/)?.[1] || "";
  const res = await fetch("/api/admin/fraud/whitelist", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error("Failed to whitelist email");
  return res.json();
}

const SIGNAL_MAP: Record<string, { label: string; color: string; icon: React.ReactNode; description: string }> = {
  EMAIL_VELOCITY:    { label: "Email velocity",    color: "bg-orange-100 text-orange-800 border-orange-200", icon: <Mail className="w-3 h-3" />,          description: "Same email used for multiple bookings in a short window" },
  IP_VELOCITY:       { label: "IP velocity",       color: "bg-orange-100 text-orange-800 border-orange-200", icon: <Zap className="w-3 h-3" />,           description: "Multiple bookings from the same IP address" },
  IP_BURST:          { label: "IP burst (bot?)",   color: "bg-red-100 text-red-800 border-red-200",          icon: <AlertTriangle className="w-3 h-3" />,  description: "Rapid-fire bookings from one IP — possible bot activity" },
  DUPLICATE_BOOKING: { label: "Duplicate booking", color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: <Users className="w-3 h-3" />,          description: "This booking appears to be a duplicate of another" },
  HIGH_PAX_COUNT:    { label: "Large group",       color: "bg-blue-100 text-blue-800 border-blue-200",       icon: <Users className="w-3 h-3" />,          description: "Unusually large guest count" },
  HIGH_VALUE_ORDER:  { label: "High value",        color: "bg-purple-100 text-purple-800 border-purple-200", icon: <DollarSign className="w-3 h-3" />,     description: "Total booking value is unusually high" },
  DISPOSABLE_EMAIL:  { label: "Temp email",        color: "bg-red-100 text-red-800 border-red-200",          icon: <MailX className="w-3 h-3" />,          description: "Email domain matches known disposable/temporary email providers" },
  SUSPICIOUS_NAME:   { label: "Suspicious name",   color: "bg-gray-100 text-gray-700 border-gray-200",       icon: <UserX className="w-3 h-3" />,          description: "Name contains patterns associated with spam or fake accounts" },
};

function riskConfig(level: string) {
  return {
    critical: { color: "bg-red-100 text-red-800 border-red-300",       dot: "bg-red-500",    label: "Critical", ring: "ring-red-200"    },
    high:     { color: "bg-orange-100 text-orange-800 border-orange-300", dot: "bg-orange-500", label: "High",     ring: "ring-orange-200" },
    medium:   { color: "bg-yellow-100 text-yellow-800 border-yellow-300", dot: "bg-yellow-500", label: "Medium",   ring: "ring-yellow-200" },
    low:      { color: "bg-green-100 text-green-800 border-green-300",  dot: "bg-green-500",  label: "Low",      ring: "ring-green-200"  },
  }[level] || { color: "bg-gray-100 text-gray-700 border-gray-300", dot: "bg-gray-400", label: "Unknown", ring: "ring-gray-200" };
}

function fmtVUV(cents: number) { return `${Math.round(cents / 100).toLocaleString()} VUV`; }
function fmtDate(d: string) { return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }); }
function fmtTime(d: string) { return new Date(d).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" }); }

export default function AdminFraud() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [detail, setDetail] = useState<FlaggedBooking | null>(null);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: flagged = [], isLoading, refetch } = useQuery({
    queryKey: ["fraud-flagged"],
    queryFn: fetchFlaggedBookings,
    refetchInterval: 60_000,
  });

  const approveMutation = useMutation({
    mutationFn: approveBooking,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["fraud-flagged"] });
      toast({ title: "Booking approved — fraud flag cleared" });
      if (detail?.id === id) setDetail(null);
      setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const dismissMutation = useMutation({
    mutationFn: dismissBooking,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["fraud-flagged"] });
      toast({ title: "Booking dismissed & cancelled" });
      if (detail?.id === id) setDetail(null);
      setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const whitelistMutation = useMutation({
    mutationFn: whitelistEmail,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["fraud-flagged"] }); toast({ title: "Email whitelisted" }); },
    onError: () => toast({ title: "Error whitelisting email", variant: "destructive" }),
  });

  const handleBulkApprove = async () => {
    for (const id of selectedIds) await approveBooking(id);
    queryClient.invalidateQueries({ queryKey: ["fraud-flagged"] });
    toast({ title: `${selectedIds.size} bookings approved` });
    setSelectedIds(new Set());
  };

  const handleBulkDismiss = async () => {
    if (!confirm(`Dismiss and cancel ${selectedIds.size} flagged bookings?`)) return;
    for (const id of selectedIds) await dismissBooking(id);
    queryClient.invalidateQueries({ queryKey: ["fraud-flagged"] });
    toast({ title: `${selectedIds.size} bookings dismissed` });
    setSelectedIds(new Set());
  };

  const filtered = flagged.filter(b => {
    const matchRisk = riskFilter === "all" || b.fraud?.level === riskFilter;
    const matchSearch = !search ||
      b.customerName.toLowerCase().includes(search.toLowerCase()) ||
      b.customerEmail.toLowerCase().includes(search.toLowerCase()) ||
      b.tourName.toLowerCase().includes(search.toLowerCase());
    return matchRisk && matchSearch;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = () => {
    selectedIds.size === filtered.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(filtered.map(b => b.id)));
  };

  const criticalCount = flagged.filter(b => b.fraud?.level === "critical").length;
  const highCount = flagged.filter(b => b.fraud?.level === "high").length;
  const mediumCount = flagged.filter(b => b.fraud?.level === "medium").length;
  const totalValue = flagged.reduce((s, b) => s + b.totalAmountCents, 0);

  return (
    <DashboardLayout type="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-50 rounded-xl border border-red-200">
              <ShieldAlert className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Fraud Review Queue</h1>
              <p className="text-sm text-muted-foreground">Bookings flagged by automated risk detection</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        </div>

        {/* KPI Summary row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Pending Review", value: flagged.length, color: "border-l-gray-400",    icon: <Filter className="h-5 w-5 text-gray-500" /> },
            { label: "Critical Risk",  value: criticalCount,  color: "border-l-red-500",     icon: <ShieldAlert className="h-5 w-5 text-red-500" /> },
            { label: "High Risk",      value: highCount,      color: "border-l-orange-500",  icon: <AlertTriangle className="h-5 w-5 text-orange-500" /> },
            { label: "Total Exposure", value: fmtVUV(totalValue), color: "border-l-purple-500", icon: <DollarSign className="h-5 w-5 text-purple-500" /> },
          ].map(s => (
            <Card key={s.label} className={`border-l-4 ${s.color}`}>
              <CardContent className="p-4 flex items-center gap-3">
                {s.icon}
                <div>
                  <p className="text-xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Alert banner */}
        {criticalCount > 0 && (
          <Alert className="border-red-200 bg-red-50">
            <ShieldAlert className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800 text-sm">
              <strong>{criticalCount} critical-risk</strong> booking{criticalCount > 1 ? "s" : ""} require immediate review.
              These may indicate bot activity or fraud. Approve to allow or Dismiss to cancel the booking.
            </AlertDescription>
          </Alert>
        )}

        {/* Filters + Search + Bulk actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search name, email, or tour..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={riskFilter} onValueChange={setRiskFilter}>
            <SelectTrigger className="w-40">
              <Shield className="h-3.5 w-3.5 mr-1.5" />
              <SelectValue placeholder="Risk level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 border border-primary/20 rounded-lg">
              <span className="text-sm font-semibold">{selectedIds.size} selected</span>
              <Button size="sm" variant="outline" className="h-7 text-xs border-green-500/30 text-green-600" onClick={handleBulkApprove}>
                <CheckCircle2 className="h-3 w-3 mr-1" /> Approve All
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs border-red-500/30 text-red-500" onClick={handleBulkDismiss}>
                <XCircle className="h-3 w-3 mr-1" /> Dismiss All
              </Button>
            </div>
          )}
        </div>

        {/* Main table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Flagged Bookings</CardTitle>
            <CardDescription>{isLoading ? "Loading…" : filtered.length === 0 ? "No flagged bookings. All clear! ✅" : `${filtered.length} booking(s) awaiting review`}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {!isLoading && filtered.length > 0 && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-10">
                        <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleAll} className="rounded" />
                      </TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Booking</TableHead>
                      <TableHead className="text-center">Risk Score</TableHead>
                      <TableHead>Signals</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(booking => {
                      const risk = riskConfig(booking.fraud?.level || "low");
                      const isSelected = selectedIds.has(booking.id);
                      return (
                        <TableRow key={booking.id}
                          className={`hover:bg-muted/20 cursor-pointer transition-colors ${isSelected ? "bg-primary/5" : ""} ${booking.fraud?.level === "critical" ? "border-l-2 border-l-red-500" : booking.fraud?.level === "high" ? "border-l-2 border-l-orange-400" : ""}`}
                          onClick={() => setDetail(booking)}>
                          <TableCell onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(booking.id)} className="rounded" />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                                {booking.customerName[0]?.toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-sm">{booking.customerName}</p>
                                <p className="text-xs text-muted-foreground">{booking.customerEmail}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm font-medium max-w-[150px] truncate">{booking.tourName}</p>
                            <p className="text-xs text-muted-foreground">{booking.date} · {booking.guests} guests</p>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${risk.color}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${risk.dot}`} />
                                {risk.label}
                              </span>
                              {booking.fraud && <span className="text-xs text-muted-foreground font-mono">{booking.fraud.score}/100</span>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {booking.fraud?.signals.slice(0, 3).map(sig => {
                                const s = SIGNAL_MAP[sig];
                                return s ? (
                                  <span key={sig} className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border font-medium ${s.color}`}>
                                    {s.icon}{s.label}
                                  </span>
                                ) : null;
                              })}
                              {(booking.fraud?.signals.length || 0) > 3 && (
                                <span className="text-xs text-muted-foreground">+{booking.fraud!.signals.length - 3} more</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-mono font-semibold">{fmtVUV(booking.totalAmountCents)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <div>
                                <div>{fmtDate(booking.createdAt)}</div>
                                <div className="text-muted-foreground/70">{fmtTime(booking.createdAt)}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setDetail(booking)}>
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="sm" className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700 text-white"
                                disabled={approveMutation.isPending}
                                onClick={() => approveMutation.mutate(booking.id)}>
                                <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
                              </Button>
                              <Button variant="destructive" size="sm" className="h-7 px-2 text-xs"
                                disabled={dismissMutation.isPending}
                                onClick={() => dismissMutation.mutate(booking.id)}>
                                <XCircle className="w-3 h-3 mr-1" /> Dismiss
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
                  Showing {filtered.length} of {flagged.length} flagged bookings
                </div>
              </div>
            )}
            {!isLoading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <ShieldCheck className="w-14 h-14 mb-3 text-green-400" />
                <p className="font-medium text-foreground">No bookings flagged for review</p>
                <p className="text-sm mt-1">The fraud detection system is actively monitoring all new bookings.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legend card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-orange-500" /> Fraud Signal Reference</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(SIGNAL_MAP).map(([key, s]) => (
                <div key={key} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30">
                  <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border font-medium shrink-0 ${s.color}`}>
                    {s.icon}{s.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{s.description}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!detail} onOpenChange={open => !open && setDetail(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500" />
              Fraud Review — {detail?.id?.slice(0, 8)}
            </DialogTitle>
            <DialogDescription>Full risk assessment and management controls</DialogDescription>
          </DialogHeader>

          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Customer</p>
                  <p className="font-semibold">{detail.customerName}</p>
                  <p className="text-muted-foreground text-xs">{detail.customerEmail}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Booking</p>
                  <p className="font-semibold">{detail.tourName}</p>
                  <p className="text-muted-foreground text-xs">{detail.date} · {detail.guests} guests</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Value</p>
                  <p className="font-semibold font-mono">{fmtVUV(detail.totalAmountCents)}</p>
                </div>
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Status</p>
                  <Badge variant="outline">{detail.status}</Badge>
                </div>
              </div>

              {detail.fraud && (
                <div className="border border-red-200 rounded-lg p-4 bg-red-50/50">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-semibold text-sm text-red-800">Risk Assessment</p>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${riskConfig(detail.fraud.level).dot}`} />
                      <span className="text-sm font-bold">{detail.fraud.score}/100</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${riskConfig(detail.fraud.level).color}`}>
                        {riskConfig(detail.fraud.level).label}
                      </span>
                    </div>
                  </div>
                  <div className="mb-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Risk score bar</p>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div className={`h-2.5 rounded-full transition-all ${detail.fraud.score >= 75 ? "bg-red-500" : detail.fraud.score >= 50 ? "bg-orange-400" : detail.fraud.score >= 25 ? "bg-yellow-400" : "bg-green-400"}`}
                        style={{ width: `${detail.fraud.score}%` }} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Triggered signals</p>
                  <div className="space-y-2">
                    {detail.fraud.signals.map(sig => {
                      const s = SIGNAL_MAP[sig] || { label: sig, color: "bg-gray-100 text-gray-700 border-gray-200", icon: null, description: "" };
                      return (
                        <div key={sig} className="flex items-start gap-2">
                          <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${s.color}`}>
                            {s.icon}{s.label}
                          </span>
                          <span className="text-xs text-muted-foreground">{s.description}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {detail.notesClean && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Customer Notes</p>
                  <p>{detail.notesClean}</p>
                </div>
              )}

              {/* Whitelist option */}
              <div className="border border-border rounded-lg p-3 bg-muted/20">
                <p className="text-xs font-semibold text-foreground mb-2">Trust Management</p>
                <Button variant="outline" size="sm" className="h-8 text-xs"
                  onClick={() => { whitelistMutation.mutate(detail.customerEmail); setDetail(null); }}>
                  <Shield className="h-3 w-3 mr-1.5" /> Whitelist {detail.customerEmail}
                </Button>
                <p className="text-xs text-muted-foreground mt-1.5">Future bookings from this email won't be flagged.</p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setDetail(null)}>Close</Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white"
              disabled={approveMutation.isPending}
              onClick={() => detail && approveMutation.mutate(detail.id)}>
              <CheckCircle2 className="w-4 h-4 mr-2" /> Approve (clear flag)
            </Button>
            <Button variant="destructive"
              disabled={dismissMutation.isPending}
              onClick={() => detail && dismissMutation.mutate(detail.id)}>
              <XCircle className="w-4 h-4 mr-2" /> Dismiss (cancel)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
