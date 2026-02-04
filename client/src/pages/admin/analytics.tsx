import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useTranslation } from "react-i18next";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchBookingStats } from "@/lib/api";

export default function AdminAnalytics() {
  const { t } = useTranslation();

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: fetchBookingStats,
  });

  const { data: revenueDaily = [] } = useQuery({
    queryKey: ["revenue-daily"],
    queryFn: () => fetch("/api/analytics/revenue/daily").then(res => res.json()),
  });

  const { data: topTours = [] } = useQuery({
    queryKey: ["top-tours"],
    queryFn: () => fetch("/api/analytics/top-tours").then(res => res.json()),
  });

  // Prepare Pie Chart data from stats
  const statusData = stats ? [
    { name: t("booking.confirmed"), value: stats.confirmed, color: "#10b981" },
    { name: t("booking.pending"), value: stats.pending, color: "#f59e0b" },
    { name: t("booking.completed", "Completed"), value: stats.completed || 0, color: "#3b82f6" },
  ].filter(d => d.value > 0) : [];

  return (
    <DashboardLayout type="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t("admin.analyticsTitle", "Advanced Analytics")}</h1>
          <p className="text-muted-foreground">{t("admin.analyticsDesc", "Deep dive into business performance and customer trends.")}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Over Time */}
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.revenueOverTime", "Revenue (Last 30 Days)")}</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueDaily}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                  />
                  <YAxis tickFormatter={(val) => `${val/1000}k`} />
                  <ReTooltip 
                    formatter={(val: number) => [`${val.toLocaleString()} VT`, "Revenue"]}
                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                  />
                  <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Booking Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.bookingDistribution", "Booking Status")}</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <ReTooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 ml-4">
                {statusData.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></div>
                    <span>{d.name}: {d.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Performing Tours */}
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.topPerformingTours", "Top Performing Tours")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topTours} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="tourName" type="category" width={150} tick={{ fontSize: 12 }} />
                  <ReTooltip 
                    formatter={(val: number) => [`${val.toLocaleString()} VT`, "Revenue"]}
                  />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
