import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useTranslation } from "react-i18next";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, Legend, Sector
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchBookingStats } from "@/lib/api";
import { TrendingUp, DollarSign, Users, Star, Download, RefreshCw, BarChart2, PieChart as PieIcon, Calendar } from "lucide-react";

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"];

function KPI({ label, value, sublabel, icon: Icon, colorClass }: { label: string; value: string | number; sublabel?: string; icon: any; colorClass: string }) {
  return (
    <div className="p-5 rounded-xl bg-card border border-border">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClass}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="text-2xl font-bold text-foreground mb-0.5">{value}</div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      {sublabel && <div className="text-xs text-primary mt-1">{sublabel}</div>}
    </div>
  );
}

export default function AdminAnalytics() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<"30" | "90" | "365">("30");
  const [activeIdx, setActiveIdx] = useState<number | undefined>(undefined);

  const { data: stats, refetch } = useQuery({ queryKey: ["stats"], queryFn: fetchBookingStats });
  const { data: revenueDaily = [] } = useQuery({
    queryKey: ["revenue-daily", period],
    queryFn: () => fetch(`/api/analytics/revenue/daily?days=${period}`).then(res => res.json()),
  });
  const { data: topProducts = [] } = useQuery({
    queryKey: ["top-products", period],
    queryFn: () => fetch(`/api/analytics/top-products?days=${period}`).then(res => res.json()),
  });
  const { data: revenueByCategory = [] } = useQuery({
    queryKey: ["revenue-by-category", period],
    queryFn: () => fetch(`/api/analytics/revenue-by-category?days=${period}`).then(res => res.json()),
  });

  const totalRevenue = revenueDaily.reduce((s: number, d: any) => s + (d.amount || 0), 0)
    || (stats?.totalRevenueCents || 0);
  const avgDaily = revenueDaily.length ? (totalRevenue / revenueDaily.length) : 0;

  const statusData = stats ? [
    { name: "Confirmed", value: stats.confirmed || 0, color: "#22c55e" },
    { name: "Pending", value: stats.pending || 0, color: "#f59e0b" },
    { name: "Completed", value: stats.completed || 0, color: "#3b82f6" },
    { name: "Cancelled", value: stats.cancelled || 0, color: "#ef4444" },
    { name: "Failed", value: stats.failed || 0, color: "#71717a" },
  ].filter(d => d.value > 0) : [];

  const exportCSV = () => {
    if (!revenueDaily.length) return;
    const rows = [["Date", "Revenue (VT)"], ...revenueDaily.map((d: any) => [d.date, Math.round(d.amount || 0)])];
    const csv = rows.map(r => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `analytics-${period}days-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
    if (percent < 0.05) return null;
    const RADIAN = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <DashboardLayout type="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t("admin.analyticsTitle", "Advanced Analytics")}</h1>
            <p className="text-muted-foreground text-sm mt-1">{t("admin.analyticsDesc", "Business performance and customer trends.")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
              <SelectTrigger className="w-36 h-9">
                <Calendar className="h-3.5 w-3.5 mr-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-1.5" /> Refresh</Button>
            <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1.5" /> Export CSV</Button>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPI label="Total Revenue" value={`${Math.round(totalRevenue / 100).toLocaleString()} VT`}
            sublabel={`~${Math.round(avgDaily / 100).toLocaleString()} VT/day`}
            icon={DollarSign} colorClass="bg-yellow-500/15 text-yellow-600" />
          <KPI label="Total Bookings" value={stats?.total || 0}
            sublabel={`${stats?.confirmed || 0} confirmed`}
            icon={BarChart2} colorClass="bg-blue-500/15 text-blue-600" />
          <KPI label="Avg Booking Value" value={
            stats?.total ? `${Math.round(totalRevenue / (stats.total * 100)).toLocaleString()} VT` : "—"
          } icon={TrendingUp} colorClass="bg-green-500/15 text-green-600" />
          <KPI label="Top Product" value={topProducts[0]?.productName?.split(' ').slice(0, 2).join(' ') || "—"}
            sublabel={topProducts[0] ? `${Math.round((topProducts[0].revenue || 0) / 100).toLocaleString()} VT` : undefined}
            icon={Star} colorClass="bg-purple-500/15 text-purple-600" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Over Time */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{t("admin.revenueOverTime", "Revenue Trend")}</CardTitle>
                  <CardDescription>Last {period} days</CardDescription>
                </div>
                <Badge variant="outline" className="text-green-600 border-green-500/30">
                  {Math.round(totalRevenue / 100).toLocaleString()} VT
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueDaily}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tickFormatter={val => new Date(val).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={val => `${Math.round(val / 1000)}k`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <ReTooltip
                    formatter={(val: number) => [`${Math.round(val).toLocaleString()} VT`, "Revenue"]}
                    labelFormatter={label => new Date(label).toLocaleDateString()}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                  />
                  <Line type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Booking Status Donut */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("admin.bookingDistribution", "Booking Status")}</CardTitle>
              <CardDescription>Distribution of all booking statuses</CardDescription>
            </CardHeader>
            <CardContent className="h-[260px]">
              {statusData.length > 0 ? (
                <div className="flex items-center gap-4 h-full">
                  <ResponsiveContainer width="60%" height="100%">
                    <PieChart>
                      <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                        paddingAngle={3} dataKey="value" labelLine={false} label={renderCustomLabel}>
                        {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <ReTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-2 flex-1">
                    {statusData.map((d, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="text-muted-foreground">{d.name}</span>
                        <span className="font-semibold ml-auto">{d.value}</span>
                      </div>
                    ))}
                    <div className="border-t border-border pt-2 mt-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Total</span>
                        <span className="font-bold ml-auto">{stats?.total || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No booking data yet</div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Tours */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Performing Products</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Tours, transfers & vehicle hires — by revenue</p>
              <CardDescription>By total revenue generated</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                {topProducts.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProducts} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="productName" type="category" width={130} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <ReTooltip
                        formatter={(val: number) => [`${Math.round(val / 100).toLocaleString()} VT`, "Revenue"]}
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                      />
                      <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                        {topProducts.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No product data yet</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Revenue by Category */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Revenue by Category</CardTitle>
              <CardDescription>Tours vs Transfers vs Vehicle Hire breakdown</CardDescription>
            </CardHeader>
            <CardContent className="h-[260px]">
              {revenueByCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueByCategory}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="category" tick={{ fontSize: 12 }} axisLine={false} tickLine={false}
                      tickFormatter={(val) => (val === 'vehicle' || val === 'bus') ? 'Vehicle Hire' : val.charAt(0).toUpperCase() + val.slice(1) + 's'}
                    />
                    <YAxis tickFormatter={v => `${Math.round(v / 1000)}k`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <ReTooltip
                      formatter={(val: number) => [`${Math.round(val / 100).toLocaleString()} VT`, "Revenue"]}
                      labelFormatter={(label) => (label === 'vehicle' || label === 'bus') ? 'Vehicle Hire' : String(label).charAt(0).toUpperCase() + String(label).slice(1) + 's'}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                    />
                    <Bar dataKey="revenueCents" radius={[4, 4, 0, 0]}>
                      {revenueByCategory.map((_: any, i: number) => (
                        <Cell key={i} fill={["#3b82f6", "#ef4444", "#22c55e"][i % 3]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No category data yet</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
