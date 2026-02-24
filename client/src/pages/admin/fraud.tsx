import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  ShieldAlert, ShieldCheck, ShieldX, AlertTriangle, CheckCircle2,
  XCircle, Eye, RefreshCw, TrendingUp, Users, Mail, Zap, Clock,
  DollarSign, UserX, MailX
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FraudSignalBadge {
  code: string;
  label: string;
  icon: React.ReactNode;
  color: string;
}

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
  fraud: {
    score: number;
    level: string;
    signals: string[];
  } | null;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function fetchFlaggedBookings(): Promise<FlaggedBooking[]> {
  const res = await fetch("/api/admin/fraud", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch flagged bookings");
  return res.json();
}

async function approveBooking(id: string) {
  const res = await fetch(`/api/admin/fraud/${id}/approve`, {
    method: "POST", credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to approve booking");
  return res.json();
}

async function dismissBooking(id: string) {
  const res = await fetch(`/api/admin/fraud/${id}/dismiss`, {
    method: "POST", credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to dismiss booking");
  return res.json();
}

// ─── Signal display map ───────────────────────────────────────────────────────

const SIGNAL_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  EMAIL_VELOCITY:   { label: "Email velocity",    color: "bg-orange-100 text-orange-800 border-orange-200", icon: <Mail className="w-3 h-3" /> },
  IP_VELOCITY:      { label: "IP velocity",       color: "bg-orange-100 text-orange-800 border-orange-200", icon: <Zap className="w-3 h-3" /> },
  IP_BURST:         { label: "IP burst (bot?)",   color: "bg-red-100 text-red-800 border-red-200",          icon: <AlertTriangle className="w-3 h-3" /> },
  DUPLICATE_BOOKING:{ label: "Duplicate booking", color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: <Users className="w-3 h-3" /> },
  HIGH_PAX_COUNT:   { label: "Large group",       color: "bg-blue-100 text-blue-800 border-blue-200",       icon: <Users className="w-3 h-3" /> },
  HIGH_VALUE_ORDER: { label: "High value",        color: "bg-purple-100 text-purple-800 border-purple-200", icon: <DollarSign className="w-3 h-3" /> },
  DISPOSABLE_EMAIL: { label: "Temp email",        color: "bg-red-100 text-red-800 border-red-200",          icon: <MailX className="w-3 h-3" /> },
  SUSPICIOUS_NAME:  { label: "Suspicious name",   color: "bg-gray-100 text-gray-700 border-gray-200",       icon: <UserX className="w-3 h-3" /> },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function riskLevelConfig(level: string) {
  switch (level) {
    case "critical": return { color: "bg-red-100 text-red-800 border-red-300",      dot: "bg-red-500",    label: "Critical" };
    case "high":     return { color: "bg-orange-100 text-orange-800 border-orange-300", dot: "bg-orange-500", label: "High" };
    case "medium":   return { color: "bg-yellow-100 text-yellow-800 border-yellow-300", dot: "bg-yellow-500", label: "Medium" };
    default:         return { color: "bg-green-100 text-green-800 border-green-300", dot: "bg-green-500", label: "Low" };
  }
}

function formatVUV(cents: number) {
  return `${Math.round(cents / 100).toLocaleString()} VUV`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminFraud() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [detail, setDetail] = useState<FlaggedBooking | null>(null);

  const { data: flagged = [], isLoading, refetch } = useQuery({
    queryKey: ["fraud-flagged"],
    queryFn: fetchFlaggedBookings,
    refetchInterval: 60_000,
  });

  const approveMutation = useMutation({
    mutationFn: approveBooking,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["fraud-flagged"] });
      toast({ title: "Booking approved", description: "Fraud flag cleared." });
      if (detail?.id === id) setDetail(null);
    },
    onError: () => toast({ title: "Error", description: "Could not approve booking.", variant: "destructive" }),
  });

  const dismissMutation = useMutation({
    mutationFn: dismissBooking,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["fraud-flagged"] });
      toast({ title: "Booking cancelled", description: "Flagged booking has been dismissed." });
      if (detail?.id === id) setDetail(null);
    },
    onError: () => toast({ title: "Error", description: "Could not dismiss booking.", variant: "destructive" }),
  });

  const criticalCount = flagged.filter(b => b.fraud?.level === "critical").length;
  const highCount = flagged.filter(b => b.fraud?.level === "high").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-lg border border-red-200">
              <ShieldAlert className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Fraud Review Queue</h1>
              <p className="text-sm text-gray-500">Bookings flagged by automated risk detection</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-red-500 flex-shrink-0" />
              <div>
                <p className="text-2xl font-bold">{flagged.length}</p>
                <p className="text-xs text-gray-500">Pending review</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="p-4 flex items-center gap-3">
              <ShieldAlert className="w-8 h-8 text-orange-500 flex-shrink-0" />
              <div>
                <p className="text-2xl font-bold">{criticalCount}</p>
                <p className="text-xs text-gray-500">Critical risk</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-yellow-500">
            <CardContent className="p-4 flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-yellow-500 flex-shrink-0" />
              <div>
                <p className="text-2xl font-bold">{highCount}</p>
                <p className="text-xs text-gray-500">High risk</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Explanation */}
        {flagged.length > 0 && (
          <Alert className="border-amber-200 bg-amber-50">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 text-sm">
              These bookings have been flagged by the automated fraud detection system. Review each one and either
              <strong> approve</strong> (clears the flag, booking proceeds normally) or <strong>dismiss</strong> (cancels the booking).
              Bookings are not automatically cancelled unless a critical bot signal (IP burst) is detected.
            </AlertDescription>
          </Alert>
        )}

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Flagged Bookings</CardTitle>
            <CardDescription>
              {isLoading ? "Loading…" : flagged.length === 0 ? "No flagged bookings. All clear! ✅" : `${flagged.length} booking(s) awaiting review`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {!isLoading && flagged.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Customer</TableHead>
                    <TableHead>Tour</TableHead>
                    <TableHead className="text-center">Risk</TableHead>
                    <TableHead>Signals</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flagged.map(booking => {
                    const risk = booking.fraud ? riskLevelConfig(booking.fraud.level) : riskLevelConfig("low");
                    return (
                      <TableRow key={booking.id} className="hover:bg-gray-50">
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{booking.customerName}</p>
                            <p className="text-xs text-gray-500">{booking.customerEmail}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">{booking.tourName}</p>
                            <p className="text-xs text-gray-500">{booking.date} · {booking.guests} guests</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${risk.color}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${risk.dot}`} />
                              {risk.label}
                            </span>
                            {booking.fraud && (
                              <span className="text-xs text-gray-400">Score: {booking.fraud.score}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {booking.fraud?.signals.map(sig => {
                              const s = SIGNAL_MAP[sig];
                              if (!s) return <span key={sig} className="text-xs px-1.5 py-0.5 bg-gray-100 rounded border text-gray-600">{sig}</span>;
                              return (
                                <span key={sig} className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border font-medium ${s.color}`}>
                                  {s.icon}{s.label}
                                </span>
                              );
                            })}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-mono">{formatVUV(booking.totalAmountCents)}</TableCell>
                        <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(booking.createdAt)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline" size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => setDetail(booking)}
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              Details
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700 text-white"
                              disabled={approveMutation.isPending}
                              onClick={() => approveMutation.mutate(booking.id)}
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Approve
                            </Button>
                            <Button
                              variant="destructive" size="sm"
                              className="h-7 px-2 text-xs"
                              disabled={dismissMutation.isPending}
                              onClick={() => dismissMutation.mutate(booking.id)}
                            >
                              <XCircle className="w-3 h-3 mr-1" />
                              Dismiss
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            {!isLoading && flagged.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <ShieldCheck className="w-14 h-14 mb-3 text-green-400" />
                <p className="font-medium text-gray-600">No bookings flagged for review</p>
                <p className="text-sm mt-1">The fraud detection system is monitoring all new bookings.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!detail} onOpenChange={open => !open && setDetail(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500" />
              Fraud Review — {detail?.id?.slice(0, 8)}
            </DialogTitle>
            <DialogDescription>
              Full risk assessment details for this booking
            </DialogDescription>
          </DialogHeader>

          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Customer</p>
                  <p className="font-semibold">{detail.customerName}</p>
                  <p className="text-gray-500">{detail.customerEmail}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Booking</p>
                  <p className="font-semibold">{detail.tourName}</p>
                  <p className="text-gray-500">{detail.date} · {detail.guests} guests</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Value</p>
                  <p className="font-semibold font-mono">{formatVUV(detail.totalAmountCents)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Status</p>
                  <Badge variant="outline">{detail.status}</Badge>
                </div>
              </div>

              {detail.fraud && (
                <div className="border border-red-200 rounded-lg p-4 bg-red-50/50">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-semibold text-sm text-red-800">Risk Assessment</p>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${riskLevelConfig(detail.fraud.level).dot}`} />
                      <span className="text-sm font-bold">{detail.fraud.score}/100</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${riskLevelConfig(detail.fraud.level).color}`}>
                        {riskLevelConfig(detail.fraud.level).label}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Triggered signals</p>
                    <div className="flex flex-wrap gap-2">
                      {detail.fraud.signals.map(sig => {
                        const s = SIGNAL_MAP[sig] || { label: sig, color: "bg-gray-100 text-gray-700 border-gray-200", icon: null };
                        return (
                          <span key={sig} className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${s.color}`}>
                            {s.icon}{s.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {detail.notesClean && (
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-gray-700">{detail.notesClean}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDetail(null)}>Close</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={approveMutation.isPending}
              onClick={() => detail && approveMutation.mutate(detail.id)}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Approve (clear flag)
            </Button>
            <Button
              variant="destructive"
              disabled={dismissMutation.isPending}
              onClick={() => detail && dismissMutation.mutate(detail.id)}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Dismiss (cancel booking)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
