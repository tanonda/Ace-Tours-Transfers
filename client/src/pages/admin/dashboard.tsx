import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchBookings, fetchBookingStats, fetchTours, updateBooking, exportBookingsCSV } from "@/lib/api";
import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

function KPI({ label, value, delta, colorClass }: { label: string; value: string | number; delta?: string; colorClass?: string }) {
  return (
    <div data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, '-')}`} className="p-4 rounded-xl bg-card border border-border">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${colorClass || 'bg-primary text-primary-foreground'}`}>
          {label[0]}
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {delta && (
          <div className={`text-xs font-medium ${delta.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
            {delta}
          </div>
        )}
      </div>
    </div>
  );
}

function BookingModal({ booking, onClose, onUpdate, t }: { booking: any; onClose: () => void; onUpdate: (status: string) => void; t: (key: string) => string }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000]">
      <div className="bg-card p-6 rounded-2xl w-[400px] max-w-[90%] border border-border">
        <h3 className="text-foreground text-lg font-semibold mb-4">{t("dashboard.bookingDetails")}</h3>
        <div className="flex flex-col gap-3 text-muted-foreground">
          <div><strong className="text-foreground">{t("booking.id")}:</strong> #{`ACT-${(booking.id||'').replace(/^book_/i,'').replace(/-/g,'').slice(0,8).toUpperCase()}`}</div>
          <div><strong className="text-foreground">{t("booking.customer")}:</strong> {booking.customerName}</div>
          <div><strong className="text-foreground">{t("booking.tour")}:</strong> {booking.tourName}</div>
          <div><strong className="text-foreground">{t("booking.date")}:</strong> {booking.date}</div>
          <div><strong className="text-foreground">{t("booking.guests")}:</strong> {booking.guests}</div>
          <div><strong className="text-foreground">{t("booking.amount")}:</strong> {booking.amount}</div>
          <div><strong className="text-foreground">{t("booking.status")}:</strong> {booking.status}</div>
        </div>
        <div className="mt-5 flex gap-2">
          <button
            data-testid="button-confirm-booking"
            onClick={() => onUpdate('confirmed')}
            className="flex-1 py-2.5 rounded-lg border-none bg-green-500 text-white font-semibold cursor-pointer hover:bg-green-600 transition-colors"
          >
            {t("booking.confirm")}
          </button>
          <button
            data-testid="button-cancel-booking"
            onClick={() => onUpdate('cancelled')}
            className="flex-1 py-2.5 rounded-lg border-none bg-red-500 text-white font-semibold cursor-pointer hover:bg-red-600 transition-colors"
          >
            {t("booking.cancel")}
          </button>
        </div>
        <button
          data-testid="button-close-modal"
          onClick={onClose}
          className="mt-3 w-full py-2.5 rounded-lg border border-border bg-transparent text-foreground cursor-pointer hover:bg-muted transition-colors"
        >
          {t("dashboard.close")}
        </button>
      </div>
    </div>
  );
}

function Table({ rows, onOpenBooking, t }: { rows: any[]; onOpenBooking: (booking: any) => void; t: (key: string) => string }) {
  const getTranslatedStatus = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === 'paid' || statusLower === 'confirmed') return t("booking.confirmed");
    if (statusLower === 'pending') return t("booking.pending");
    if (statusLower === 'completed') return t("booking.completed");
    if (statusLower === 'cancelled') return t("booking.cancelled");
    return status;
  };

  return (
    <table className="w-full border-collapse">
      <thead className="text-left text-muted-foreground">
        <tr>
          <th className="py-3 px-2 text-xs uppercase tracking-wide border-b border-border">{t("booking.id")}</th>
          <th className="py-3 px-2 text-xs uppercase tracking-wide border-b border-border">{t("booking.customer")}</th>
          <th className="py-3 px-2 text-xs uppercase tracking-wide border-b border-border">{t("dashboard.route")}</th>
          <th className="py-3 px-2 text-xs uppercase tracking-wide border-b border-border">{t("booking.date")}</th>
          <th className="py-3 px-2 text-xs uppercase tracking-wide border-b border-border">{t("booking.amount")}</th>
          <th className="py-3 px-2 text-xs uppercase tracking-wide border-b border-border">{t("booking.status")}</th>
          <th className="py-3 px-2 text-xs uppercase tracking-wide border-b border-border">{t("dashboard.action")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.id} data-testid={`row-booking-${r.id}`} className="border-b border-border/30">
            <td className="py-3 px-2 text-foreground text-sm">#{r.id?.slice(0, 6) || r.id}</td>
            <td className="py-3 px-2 text-foreground text-sm">{r.customerName || r.name}</td>
            <td className="py-3 px-2 text-foreground text-sm">{r.tourName || r.route}</td>
            <td className="py-3 px-2 text-foreground text-sm">{r.date}</td>
            <td className="py-3 px-2 text-foreground text-sm">{r.amount}</td>
            <td className="py-3 px-2">
              <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${r.status === 'confirmed' || r.status === 'Paid'
                  ? 'bg-green-500/15 text-green-500'
                  : r.status === 'pending' || r.status === 'Pending'
                    ? 'bg-yellow-500/15 text-yellow-500'
                    : 'bg-red-500/15 text-red-500'
                }`}>
                {getTranslatedStatus(r.status)}
              </span>
            </td>
            <td className="py-3 px-2">
              <button
                data-testid={`button-open-${r.id}`}
                onClick={() => onOpenBooking(r)}
                className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md border-none font-semibold cursor-pointer text-xs hover:opacity-90 transition-opacity"
              >
                {t("common.view")}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
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
    const locale = i18n.language === 'zh' ? 'zh-CN' : i18n.language === 'fr' ? 'fr-FR' : i18n.language === 'es' ? 'es-ES' : 'en-US';
    return `${n.toLocaleString(locale)} ${t("dashboard.currencySuffix")}`;
  };

  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings"],
    queryFn: fetchBookings,
  });

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: fetchBookingStats,
  });

  const { data: tours = [] } = useQuery({
    queryKey: ["tours"],
    queryFn: fetchTours,
  });

  // C: Live uptime from BetterStack proxy (free tier). Falls back to "N/A" if not configured.
  const { data: uptimeData } = useQuery({
    queryKey: ["uptime"],
    queryFn: async () => {
      const res = await fetch("/api/admin/uptime");
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 5 * 60 * 1000, // refresh every 5 min
    retry: false,
  });

  // C: Revenue breakdown by category for Recharts bar chart
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
    onError: () => {
      toast({ title: t("common.error"), description: t("dashboard.updateFailed"), variant: "destructive" });
    }
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
    // Filter by status
    const statusMatch = statusFilter === 'all' || b.status.toLowerCase() === statusFilter.toLowerCase();

    // Filter by search query (searches across multiple fields)
    if (!searchQuery.trim()) return statusMatch;

    const query = searchQuery.toLowerCase();
    const matches =
      b.customerName?.toLowerCase().includes(query) ||
      b.tourName?.toLowerCase().includes(query) ||
      b.id?.toLowerCase().includes(query) ||
      b.amount?.toLowerCase().includes(query) ||
      b.status?.toLowerCase().includes(query) ||
      b.date?.toLowerCase().includes(query) ||
      b.guests?.toString().includes(query);

    return statusMatch && matches;
  });

  const recentBookings = filteredBookings.slice(0, 10);
  const totalRevenue = bookings.reduce((sum, b) => {
    const amount = parseFloat(String(b.amount).replace(/[^0-9.]/g, '')) || 0;
    return sum + amount;
  }, 0);

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
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {t("dashboard.welcome")}, {user?.name || 'Admin'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("dashboard.whatsHappening")}
            </p>
          </div>
          <div className="flex gap-2">
            <input
              data-testid="input-search"
              placeholder={t("common.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="py-2.5 px-3.5 rounded-lg border border-border min-w-[200px] bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button
              data-testid="button-export-csv"
              onClick={handleExportCSV}
              className="bg-primary py-2.5 px-4 rounded-lg cursor-pointer border-none text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              {t("common.export")}
            </button>
          </div>
        </div>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPI label={t("dashboard.revenue")} value={fmtVT(totalRevenue * 100)} delta="+8%" colorClass="bg-yellow-500 text-yellow-950" />
          <KPI label={t("dashboard.bookings")} value={stats?.total || bookings.length} delta="+3%" colorClass="bg-blue-500 text-blue-950" />
          <KPI label={t("dashboard.activeTours")} value={tours.length} delta="+1%" colorClass="bg-green-500 text-green-950" />
          <KPI
            label={t("dashboard.uptime")}
            value={uptimeData?.uptime ?? "N/A"}
            delta={uptimeData?.status === "up" ? "Operational" : uptimeData?.status === "down" ? "⚠ Down" : undefined}
            colorClass="bg-red-400 text-red-950"
          />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
          <div className="p-5 rounded-xl bg-card border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-foreground text-base font-semibold">{t("dashboard.recentBookings")}</h3>
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
            </div>
            {recentBookings.length > 0 ? (
              <Table rows={recentBookings} onOpenBooking={setSelectedBooking} t={t} />
            ) : (
              <div className="py-10 text-center text-muted-foreground">
                {t("dashboard.noBookingsYet")}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="p-5 rounded-xl bg-card border border-border">
              <h4 className="text-foreground text-sm font-semibold mb-3">{t("dashboard.revenueBreakdown")}</h4>
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
                  <div className="flex-1 bg-blue-500 rounded-t-md" style={{ height: "50%" }} />
                  <div className="flex-1 bg-red-400 rounded-t-md" style={{ height: "75%" }} />
                  <div className="flex-1 bg-green-500 rounded-t-md" style={{ height: "90%" }} />
                </div>
              )}
              <div className="flex justify-around mt-3 text-xs text-muted-foreground">
                <span>{t("nav.tours")}</span>
                <span>{t("nav.transfers")}</span>
                <span>Bus Hire</span>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-card border border-border">
              <h4 className="text-foreground text-sm font-semibold mb-3">{t("dashboard.systemHealth")}</h4>
              <div className="text-sm text-muted-foreground">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  <span className="text-foreground">{t("dashboard.allSystemsNominal")}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("dashboard.apiLatency")} • {t("dashboard.dbConnections")}
                </div>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-card border border-border">
              <h4 className="text-foreground text-sm font-semibold mb-3">{t("dashboard.quickActions")}</h4>
              <div className="flex flex-wrap gap-2">
                <button
                  data-testid="button-new-booking"
                  onClick={() => setLocation('/reservations?tab=book-new')}
                  className="bg-muted px-3 py-2 rounded-lg cursor-pointer border border-border text-foreground text-xs hover:bg-accent transition-colors"
                >
                  {t("dashboard.newBooking")}
                </button>
                <button
                  data-testid="button-create-promo"
                  onClick={() => setLocation('/admin/promotions')}
                  className="bg-muted px-3 py-2 rounded-lg cursor-pointer border border-border text-foreground text-xs hover:bg-accent transition-colors"
                >
                  {t("dashboard.createPromo")}
                </button>
                <button
                  data-testid="button-view-reports"
                  onClick={() => setLocation('/admin/reports')}
                  className="bg-muted px-3 py-2 rounded-lg cursor-pointer border border-border text-foreground text-xs hover:bg-accent transition-colors"
                >
                  {t("dashboard.viewReports")}
                </button>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-gradient-to-br from-primary/10 to-destructive/10 border border-primary/30">
              <h4 className="text-foreground text-sm font-semibold">{t("dashboard.notifications")}</h4>
              <ul className="mt-3 space-y-2">
                {bookings.slice(0, 3).map((b) => (
                  <li key={b.id} className="flex items-center gap-2 text-sm">
                    <span className={`w-1.5 h-1.5 rounded-full ${b.status === 'confirmed' ? 'bg-green-500' :
                        b.status === 'pending' ? 'bg-yellow-500' : 'bg-red-400'
                      }`}></span>
                    <span className={
                      b.status === 'confirmed' ? 'text-green-500' :
                        b.status === 'pending' ? 'text-yellow-500' : 'text-red-400'
                    }>
                      {b.status === 'confirmed' ? t("booking.confirmed") : b.status === 'pending' ? t("dashboard.newBookingNotif") : t("booking.cancelled")}
                    </span>
                    <span className="text-muted-foreground">#{b.id?.slice(0, 6)}</span>
                  </li>
                ))}
                {bookings.length === 0 && (
                  <li className="text-muted-foreground text-sm">{t("dashboard.noRecentActivity")}</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
