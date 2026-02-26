import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchBookings, fetchBookingStats, fetchTours, updateBooking, exportBookingsCSV } from "@/lib/api";
import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  TrendingUp, DollarSign, CalendarCheck, Map, Activity,
  ExternalLink, AlertCircle, Download, Plus, BarChart2, ChevronRight, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";

function BookingModal({ booking, onClose, onUpdate, t }: { booking: any; onClose: () => void; onUpdate: (status: string) => void; t: (key: string) => string }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000]">
      <div className="bg-card p-6 rounded-2xl w-[440px] max-w-[92vw] border border-border shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-foreground text-lg font-semibold">{t("dashboard.bookingDetails")}</h3>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm mb-5">
          {[
            [t("booking.id"), `ACT-${(booking.id||'').replace(/^book_/i,'').replace(/-/g,'').slice(0,8).toUpperCase()}`],
            [t("booking.customer"), booking.customerName],
            [t("booking.tour"), booking.tourName],
            [t("booking.date"), booking.date],
            [t("booking.guests"), booking.guests],
            [t("booking.amount"), booking.amount],
          ].map(([label, val]) => (
            <div key={String(label)} className="bg-muted/40 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
              <div className="font-semibold text-foreground">{val}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mb-2">
          <button data-testid="button-confirm-booking" onClick={() => onUpdate('confirmed')} className="flex-1 py-2.5 rounded-lg bg-green-500 text-white font-semibold text-sm hover:bg-green-600 transition-colors">{t("booking.confirm")}</button>
          <button data-testid="button-cancel-booking" onClick={() => onUpdate('cancelled')} className="flex-1 py-2.5 rounded-lg bg-red-500 text-white font-semibold text-sm hover:bg-red-600 transition-colors">{t("booking.cancel")}</button>
        </div>
        <button data-testid="button-close-modal" onClick={onClose} className="w-full py-2.5 rounded-lg border border-border bg-transparent text-foreground text-sm hover:bg-muted transition-colors">{t("dashboard.close")}</button>
      </div>
    </div>
  );
}

function BookingsTable({ rows, onOpenBooking, t }: { rows: any[]; onOpenBooking: (b: any) => void; t: (k: string) => string }) {
  const getTranslatedStatus = (status: string) => {
    const s = status?.toLowerCase();
    if (s === 'paid' || s === 'confirmed') return t("booking.confirmed");
    if (s === 'pending') return t("booking.pending");
    if (s === 'completed') return t("booking.completed");
    if (s === 'cancelled') return t("booking.cancelled");
    return status;
  };
  return (
    <table className="w-full border-collapse">
      <thead className="text-left text-muted-foreground">
        <tr>
          {[t("booking.id"), t("booking.customer"), t("dashboard.route"), t("booking.date"), t("booking.amount"), t("booking.status"), t("dashboard.action")].map(h => (
            <th key={h} className="py-3 px-2 text-xs uppercase tracking-wide border-b border-border">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.id} data-testid={`row-booking-${r.id}`} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
            <td className="py-3 px-2 text-foreground text-sm font-mono text-xs">#{(r.id||'').slice(0,6)}</td>
            <td className="py-3 px-2">
              <div className="text-sm font-medium text-foreground">{r.customerName}</div>
              {r.customerEmail && <div className="text-xs text-muted-foreground">{r.customerEmail}</div>}
            </td>
            <td className="py-3 px-2 text-foreground text-sm max-w-[150px] truncate">{r.tourName}</td>
            <td className="py-3 px-2 text-muted-foreground text-sm">{r.date}</td>
            <td className="py-3 px-2 text-foreground text-sm font-semibold">{r.amount}</td>
            <td className="py-3 px-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                r.status === 'confirmed' || r.status === 'paid' ? 'bg-green-500/15 text-green-600' :
                r.status === 'pending' ? 'bg-yellow-500/15 text-yellow-600' :
                r.status === 'completed' ? 'bg-blue-500/15 text-blue-600' :
                'bg-red-500/15 text-red-500'}`}>
                {getTranslatedStatus(r.status)}
              </span>
            </td>
            <td className="py-3 px-2">
              <button data-testid={`button-open-${r.id}`} onClick={() => onOpenBooking(r)} className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md border-none font-semibold cursor-pointer text-xs hover:opacity-90 transition-opacity">
                {t("common.view")}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function KPICard({ label, value, delta, icon: Icon, colorClass, sublabel, href }: {
  label: string; value: string | number; delta?: string; icon: any; colorClass: string; sublabel?: string; href?: string;
}) {
  return (
    <div className="p-5 rounded-xl bg-card border border-border hover:border-primary/20 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClass}`}>
          <Icon className="w-5 h-5" />
        </div>
        {delta && (
          <div className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-green-500/10 text-green-600">
            <TrendingUp className="w-3 h-3" />{delta}
          </div>
        )}
        {href && (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
      <div className="text-2xl font-bold text-foreground mb-0.5">{value}</div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      {sublabel && <div className="text-xs text-muted-foreground mt-1">{sublabel}</div>}
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { t, i18n } = useTranslation();

  const fmtVT = (n?: number) => {
    if (n == null) return '-';
    const locale = i18n.language === 'zh' ? 'zh-CN' : i18n.language === 'fr' ? 'fr-FR' : 'en-US';
    return `${n.toLocaleString(locale)} ${t("dashboard.currencySuffix")}`;
  };

  const { data: bookings = [] } = useQuery({ queryKey: ["bookings"], queryFn: fetchBookings });
  const { data: stats } = useQuery({ queryKey: ["stats"], queryFn: fetchBookingStats });
  const { data: tours = [] } = useQuery({ queryKey: ["tours"], queryFn: fetchTours });

  const { data: uptimeData } = useQuery({
    queryKey: ["uptime"],
    queryFn: async () => {
      const res = await fetch("/api/admin/uptime");
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 5 * 60 * 1000,
    retry: false,
  });

  const { data: revenueByCategory = [] } = useQuery({
    queryKey: ["revenue-by-category"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/revenue-by-category");
      if (!res.ok) return [];
      return res.json();
    },
    retry: false,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateBooking(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast({ title: t("dashboard.bookingUpdated"), description: t("dashboard.bookingUpdatedDesc") });
      setSelectedBooking(null);
    },
    onError: () => toast({ title: t("common.error"), description: t("dashboard.updateFailed"), variant: "destructive" }),
  });

  const handleExportCSV = async () => {
    try {
      await exportBookingsCSV();
      toast({ title: t("dashboard.exportComplete"), description: t("dashboard.exportCompleteDesc") });
    } catch {
      toast({ title: t("common.error"), description: t("dashboard.exportFailed"), variant: "destructive" });
    }
  };

  const filteredBookings = bookings.filter(b => {
    const statusMatch = statusFilter === 'all' || b.status.toLowerCase() === statusFilter.toLowerCase();
    if (!searchQuery.trim()) return statusMatch;
    const q = searchQuery.toLowerCase();
    const matches = b.customerName?.toLowerCase().includes(q) || b.tourName?.toLowerCase().includes(q) ||
      b.id?.toLowerCase().includes(q) || b.amount?.toLowerCase().includes(q) ||
      b.status?.toLowerCase().includes(q) || b.date?.toLowerCase().includes(q);
    return statusMatch && matches;
  });

  const recentBookings = filteredBookings.slice(0, 10);
  const totalRevenue = bookings.reduce((sum, b) => sum + (parseFloat(String(b.amount).replace(/[^0-9.]/g, '')) || 0), 0);
  const pendingCount = bookings.filter(b => b.status === 'pending').length;
  const confirmedCount = bookings.filter(b => b.status === 'confirmed').length;

  // BetterStack uptime
  const uptimeStatus = uptimeData?.status;
  const uptimeValue = uptimeData?.uptime ?? (uptimeData?.configured === false ? "Configure" : "N/A");
  const uptimeDot = uptimeStatus === 'up' ? 'bg-green-500' : uptimeStatus === 'down' ? 'bg-red-500' : 'bg-yellow-400';
  const uptimeLabel = uptimeStatus === 'up' ? 'Operational' : uptimeStatus === 'down' ? '⚠ Down' : 'Unknown';

  return (
    <DashboardLayout type="admin">
      {selectedBooking && (
        <BookingModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onUpdate={(status) => updateMutation.mutate({ id: selectedBooking.id, status })}
          t={t}
        />
      )}

      <div className="flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("dashboard.welcome")}, {user?.name || 'Admin'}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("dashboard.whatsHappening")}</p>
          </div>
          <div className="flex gap-2">
            <input
              data-testid="input-search"
              placeholder={t("common.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="py-2.5 px-3.5 rounded-lg border border-border min-w-[200px] bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <Button data-testid="button-export-csv" onClick={handleExportCSV} size="sm" className="gap-2">
              <Download className="w-4 h-4" />
              {t("common.export")}
            </Button>
          </div>
        </div>

        {/* Pending alert banner */}
        {pendingCount > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-sm">
            <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0" />
            <span className="font-semibold text-yellow-700">{pendingCount} booking{pendingCount > 1 ? 's' : ''} pending review</span>
            <button onClick={() => setStatusFilter('pending')} className="ml-auto text-xs font-semibold text-yellow-700 hover:underline">
              Show pending →
            </button>
          </div>
        )}

        {/* KPI Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label={t("dashboard.revenue")}
            value={`VT ${totalRevenue.toLocaleString()}`}
            delta="+8%"
            icon={DollarSign}
            colorClass="bg-yellow-500/15 text-yellow-600"
            sublabel="All bookings to date"
          />
          <KPICard
            label={t("dashboard.bookings")}
            value={stats?.total || bookings.length}
            delta={`${confirmedCount} confirmed`}
            icon={CalendarCheck}
            colorClass="bg-blue-500/15 text-blue-600"
            sublabel={`${pendingCount} pending`}
          />
          <KPICard
            label={t("dashboard.activeTours")}
            value={tours.filter((t: any) => t.isActive !== false).length}
            icon={Map}
            colorClass="bg-green-500/15 text-green-600"
            sublabel={`${tours.length} total products`}
          />
          {/* Uptime card with live BetterStack link */}
          <div className="p-5 rounded-xl bg-card border border-border hover:border-primary/20 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-red-500/15 text-red-500">
                <Activity className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${uptimeDot} ${uptimeStatus === 'up' ? 'animate-pulse' : ''}`} />
                <span className="text-xs font-medium text-muted-foreground">{uptimeLabel}</span>
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground mb-0.5">{uptimeValue}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">{t("dashboard.uptime")}</div>
            <a href="https://uptime.betterstack.com" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              BetterStack <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">

          {/* Bookings table */}
          <div className="rounded-xl bg-card border border-border overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="text-foreground text-base font-semibold">{t("dashboard.recentBookings")}</h3>
              <div className="flex items-center gap-2">
                <select
                  data-testid="select-status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="py-1.5 px-3 rounded-md bg-muted border border-border text-foreground text-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="all">{t("dashboard.allStatuses")}</option>
                  <option value="confirmed">{t("booking.confirmed")}</option>
                  <option value="pending">{t("booking.pending")}</option>
                  <option value="cancelled">{t("booking.cancelled")}</option>
                </select>
                <button onClick={() => setLocation('/admin/bookings')} className="text-xs text-primary hover:underline flex items-center gap-0.5">
                  All <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
            {recentBookings.length > 0 ? (
              <div className="overflow-x-auto">
                <BookingsTable rows={recentBookings} onOpenBooking={setSelectedBooking} t={t} />
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">{t("dashboard.noBookingsYet")}</div>
            )}
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-4">

            {/* Revenue breakdown chart */}
            <div className="p-5 rounded-xl bg-card border border-border">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-foreground text-sm font-semibold">{t("dashboard.revenueBreakdown")}</h4>
                <button onClick={() => setLocation('/admin/analytics')} className="text-xs text-primary hover:underline">Details →</button>
              </div>
              {revenueByCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={revenueByCategory} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <XAxis dataKey="category" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip
                      formatter={(val: number) => [`${Math.round(val / 100).toLocaleString()} VT`, "Revenue"]}
                      contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                    />
                    <Bar dataKey="revenueCents" radius={[4, 4, 0, 0]}>
                      {revenueByCategory.map((_: any, i: number) => (
                        <Cell key={i} fill={["#3b82f6", "#ef4444", "#22c55e"][i % 3]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[120px] flex items-end justify-around gap-3">
                  {[["#3b82f6", "50%"], ["#ef4444", "75%"], ["#22c55e", "90%"]].map(([c, h], i) => (
                    <div key={i} className="flex-1 rounded-t-md opacity-30" style={{ backgroundColor: c, height: h }} />
                  ))}
                </div>
              )}
              <div className="flex justify-around mt-3 text-xs text-muted-foreground">
                <span>{t("nav.tours")}</span><span>{t("nav.transfers")}</span><span>Bus Hire</span>
              </div>
            </div>

            {/* System health with BetterStack link */}
            <div className="p-5 rounded-xl bg-card border border-border">
              <h4 className="text-foreground text-sm font-semibold mb-3">{t("dashboard.systemHealth")}</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-foreground">{t("dashboard.allSystemsNominal")}</span>
                </div>
                <div className="text-xs text-muted-foreground">{t("dashboard.apiLatency")} • {t("dashboard.dbConnections")}</div>
              </div>
              <div className="mt-3 pt-3 border-t border-border">
                <a href="https://uptime.betterstack.com" target="_blank" rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> Open BetterStack monitoring
                </a>
              </div>
            </div>

            {/* Quick actions */}
            <div className="p-5 rounded-xl bg-card border border-border">
              <h4 className="text-foreground text-sm font-semibold mb-3">{t("dashboard.quickActions")}</h4>
              <div className="flex flex-wrap gap-2">
                <button data-testid="button-new-booking" onClick={() => setLocation('/reservations?tab=book-new')}
                  className="bg-muted px-3 py-2 rounded-lg border border-border text-foreground text-xs hover:bg-accent transition-colors">
                  {t("dashboard.newBooking")}
                </button>
                <button data-testid="button-create-promo" onClick={() => setLocation('/admin/promotions')}
                  className="bg-muted px-3 py-2 rounded-lg border border-border text-foreground text-xs hover:bg-accent transition-colors">
                  {t("dashboard.createPromo")}
                </button>
                <button data-testid="button-view-reports" onClick={() => setLocation('/admin/reports')}
                  className="bg-muted px-3 py-2 rounded-lg border border-border text-foreground text-xs hover:bg-accent transition-colors">
                  {t("dashboard.viewReports")}
                </button>
              </div>
            </div>

            {/* Recent activity */}
            <div className="p-5 rounded-xl bg-gradient-to-br from-primary/10 to-destructive/10 border border-primary/30">
              <h4 className="text-foreground text-sm font-semibold">{t("dashboard.notifications")}</h4>
              <ul className="mt-3 space-y-2">
                {bookings.slice(0, 3).map((b: any) => (
                  <li key={b.id} className="flex items-center gap-2 text-sm">
                    <span className={`w-1.5 h-1.5 rounded-full ${b.status === 'confirmed' ? 'bg-green-500' : b.status === 'pending' ? 'bg-yellow-500' : 'bg-red-400'}`} />
                    <span className={b.status === 'confirmed' ? 'text-green-500' : b.status === 'pending' ? 'text-yellow-500' : 'text-red-400'}>
                      {b.status === 'confirmed' ? t("booking.confirmed") : b.status === 'pending' ? t("dashboard.newBookingNotif") : t("booking.cancelled")}
                    </span>
                    <span className="text-muted-foreground">#{b.id?.slice(0, 6)}</span>
                  </li>
                ))}
                {bookings.length === 0 && <li className="text-muted-foreground text-sm">{t("dashboard.noRecentActivity")}</li>}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
