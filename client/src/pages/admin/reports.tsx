import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchRevenue, fetchBookingStats, fetchBookings } from "@/lib/api";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Download, TrendingUp, CreditCard, DollarSign, Calendar, Users, FileText, Map } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function AdminReports() {
  const { t, i18n } = useTranslation();
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 3);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [guestDate, setGuestDate] = useState(() => new Date().toISOString().split("T")[0]);

  const { data: revenueData = [], isLoading: isLoadingRevenue } = useQuery({
    queryKey: ["revenue"],
    queryFn: fetchRevenue,
  });

  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["stats"],
    queryFn: fetchBookingStats,
  });

  const { data: allBookings = [], isLoading: isLoadingBookings } = useQuery({
    queryKey: ["bookings"],
    queryFn: fetchBookings,
  });

  const fmtCurrency = (val: number) =>
    `${Math.round(val).toLocaleString()} VT`;

  const filteredBookings = allBookings.filter(b => {
    if (!b.date) return false;
    return b.date >= dateFrom && b.date <= dateTo;
  });

  const guestManifest = allBookings.filter(b => b.date === guestDate && b.status !== "cancelled");

  const totalRevenue = revenueData.reduce((acc, curr) => acc + curr.total, 0);
  const averageMonthly = totalRevenue / (revenueData.length || 1);

  const filteredRevenue = filteredBookings.reduce((sum, b) => {
    const amount = parseFloat(String(b.amount ?? "0").replace(/[^0-9.]/g, "")) || 0;
    return sum + amount;
  }, 0);

  const exportBookingCSV = () => {
    const rows = [
      ["Booking ID", "Customer", "Tour", "Date", "Guests", "Amount", "Status", "Email"],
      ...filteredBookings.map(b => [
        `ACT-${(b.id || "").replace(/^book_/i, "").replace(/-/g, "").slice(0, 8).toUpperCase()}`,
        b.customerName || "",
        b.tourName || "",
        b.date || "",
        String(b.guests || ""),
        b.amount || "",
        b.status || "",
        b.customerEmail || "",
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bookings-report-${dateFrom}-to-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportGuestManifest = () => {
    const rows = [
      ["#", "Customer Name", "Email", "Tour/Transfer", "Guests", "Status", "Amount"],
      ...guestManifest.map((b, i) => [
        String(i + 1),
        b.customerName || "",
        b.customerEmail || "",
        b.tourName || "",
        String(b.guests || ""),
        b.status || "",
        b.amount || "",
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `guest-manifest-${guestDate}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (isLoadingRevenue || isLoadingStats) {
    return (
      <DashboardLayout type="admin">
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout type="admin">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("dashboard.reports")}</h1>
            <p className="text-sm text-muted-foreground">Financial overview, booking reports, and guest manifests</p>
          </div>
        </div>

        {/* KPI Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fmtCurrency(totalRevenue)}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total || 0}</div>
              <p className="text-xs text-muted-foreground text-green-500">{stats?.confirmed} confirmed</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Monthly Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fmtCurrency(averageMonthly)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.pending || 0}</div>
              <p className="text-xs text-muted-foreground">Requires attention</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="revenue">
          <TabsList>
            <TabsTrigger value="revenue">Revenue Chart</TabsTrigger>
            <TabsTrigger value="bookings">Booking Report</TabsTrigger>
            <TabsTrigger value="manifest">Guest Manifest</TabsTrigger>
          </TabsList>

          {/* Revenue Chart */}
          <TabsContent value="revenue" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Over Time</CardTitle>
                <CardDescription>Monthly revenue trend</CardDescription>
              </CardHeader>
              <CardContent className="pl-2">
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                      <Tooltip
                        cursor={{ fill: 'transparent' }}
                        formatter={(val: number) => [fmtCurrency(val), "Revenue"]}
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                      />
                      <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Booking Report */}
          <TabsContent value="bookings" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Booking Report</CardTitle>
                    <CardDescription>Filter by date range and export to CSV</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={exportBookingCSV} disabled={filteredBookings.length === 0}>
                    <Download className="h-4 w-4 mr-2" /> Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 mb-4 p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm whitespace-nowrap">From</Label>
                    <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40 h-8" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm whitespace-nowrap">To</Label>
                    <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40 h-8" />
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    <Badge variant="secondary">{filteredBookings.length} bookings</Badge>
                    <Badge variant="outline" className="text-green-600">{fmtCurrency(filteredRevenue)} revenue</Badge>
                  </div>
                </div>

                {isLoadingBookings ? (
                  <div className="flex justify-center py-8"><Loader2 className="animate-spin h-5 w-5" /></div>
                ) : filteredBookings.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No bookings in this date range.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Booking ID</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Tour / Transfer</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Guests</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredBookings.map(b => (
                          <TableRow key={b.id}>
                            <TableCell className="font-mono text-xs">
                              ACT-{(b.id || "").replace(/^book_/i, "").replace(/-/g, "").slice(0, 8).toUpperCase()}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm font-medium">{b.customerName}</div>
                              <div className="text-xs text-muted-foreground">{b.customerEmail}</div>
                            </TableCell>
                            <TableCell className="text-sm">{b.tourName}</TableCell>
                            <TableCell className="text-sm">{b.date}</TableCell>
                            <TableCell className="text-sm">{b.guests}</TableCell>
                            <TableCell className="text-sm font-medium">{b.amount}</TableCell>
                            <TableCell>
                              <Badge className={
                                b.status === "confirmed" ? "bg-green-100 text-green-800" :
                                b.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                                b.status === "completed" ? "bg-blue-100 text-blue-800" :
                                "bg-red-100 text-red-800"
                              }>
                                {b.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Guest Manifest */}
          <TabsContent value="manifest" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Guest Manifest</CardTitle>
                    <CardDescription>Full list of guests for a specific date — useful for operations and guides</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={exportGuestManifest} disabled={guestManifest.length === 0}>
                    <Download className="h-4 w-4 mr-2" /> Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-4 p-4 bg-muted/30 rounded-lg">
                  <Label className="text-sm whitespace-nowrap">Date</Label>
                  <Input type="date" value={guestDate} onChange={e => setGuestDate(e.target.value)} className="w-44 h-8" />
                  <Badge variant="secondary" className="ml-auto">{guestManifest.length} guests</Badge>
                </div>

                {isLoadingBookings ? (
                  <div className="flex justify-center py-8"><Loader2 className="animate-spin h-5 w-5" /></div>
                ) : guestManifest.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>No bookings on {guestDate}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Guest Name</TableHead>
                          <TableHead>Contact</TableHead>
                          <TableHead>Tour / Transfer</TableHead>
                          <TableHead>Pax</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {guestManifest.map((b, i) => (
                          <TableRow key={b.id}>
                            <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                            <TableCell className="font-medium">{b.customerName}</TableCell>
                            <TableCell>
                              <div className="text-sm">{b.customerEmail}</div>
                              {b.customerPhone && <div className="text-xs text-muted-foreground">{b.customerPhone}</div>}
                            </TableCell>
                            <TableCell className="text-sm">{b.tourName}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm">
                                <Users className="h-3 w-3" />
                                {b.guests}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={
                                b.status === "confirmed" ? "bg-green-100 text-green-800" :
                                b.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                                "bg-blue-100 text-blue-800"
                              }>
                                {b.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium text-sm">{b.amount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
