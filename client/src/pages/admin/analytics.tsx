import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { fetchBookings, fetchTours, fetchBookingStats, fetchRevenue } from "@/lib/api";
import { useState, useMemo, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Calendar, 
  MapPin,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  RefreshCw
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const COLORS = {
  primary: '#004165',
  accent1: '#FF6B6B',
  accent2: '#FFD93D',
  accent3: '#6BCB77',
  accent4: '#4D96FF',
};

function StatCard({ 
  title, 
  value, 
  change, 
  changeType, 
  icon: Icon,
  description 
}: { 
  title: string; 
  value: string; 
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: any;
  description?: string;
}) {
  return (
    <Card data-testid={`stat-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <h3 className="text-2xl font-bold mt-1">{value}</h3>
            {change && (
              <div className={`flex items-center gap-1 mt-1 text-sm ${
                changeType === 'positive' ? 'text-green-600' : 
                changeType === 'negative' ? 'text-red-600' : 'text-gray-600'
              }`}>
                {changeType === 'positive' ? <ArrowUpRight className="h-3 w-3" /> : 
                 changeType === 'negative' ? <ArrowDownRight className="h-3 w-3" /> : null}
                {change}
              </div>
            )}
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          <div className={`p-3 rounded-lg ${
            changeType === 'positive' ? 'bg-green-100' : 
            changeType === 'negative' ? 'bg-red-100' : 'bg-blue-100'
          }`}>
            <Icon className={`h-5 w-5 ${
              changeType === 'positive' ? 'text-green-600' : 
              changeType === 'negative' ? 'text-red-600' : 'text-blue-600'
            }`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminAnalytics() {
  const [timeRange, setTimeRange] = useState('30');
  const { toast } = useToast();
  
  const { data: bookings = [], isLoading: bookingsLoading, refetch: refetchBookings } = useQuery({
    queryKey: ["bookings"],
    queryFn: fetchBookings,
  });

  const { data: tours = [] } = useQuery({
    queryKey: ["tours"],
    queryFn: fetchTours,
  });

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: fetchBookingStats,
  });

  const { data: revenueData } = useQuery({
    queryKey: ["revenue"],
    queryFn: fetchRevenue,
  });

  const analytics = useMemo(() => {
    const totalRevenue = bookings.reduce((sum, b) => {
      const amount = parseFloat(b.amount?.replace(/[^0-9.-]+/g, '') || '0');
      return sum + amount;
    }, 0);

    const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;
    const pendingBookings = bookings.filter(b => b.status === 'pending').length;
    const cancelledBookings = bookings.filter(b => b.status === 'cancelled').length;
    const completedBookings = bookings.filter(b => b.status === 'completed').length;

    const tourBookings = bookings.filter(b => 
      tours.find(t => t.id === b.tourId && t.category === 'tour')
    ).length;
    const transferBookings = bookings.filter(b => 
      tours.find(t => t.id === b.tourId && t.category === 'transfer')
    ).length;

    const avgBookingValue = bookings.length > 0 ? totalRevenue / bookings.length : 0;

    const tourCounts: Record<string, number> = {};
    bookings.forEach(b => {
      const tourName = b.tourName || 'Unknown';
      tourCounts[tourName] = (tourCounts[tourName] || 0) + 1;
    });
    const popularTours = Object.entries(tourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const monthlyData: Record<string, number> = {};
    bookings.forEach(b => {
      const month = new Date(b.date).toLocaleString('default', { month: 'short' });
      const amount = parseFloat(b.amount?.replace(/[^0-9.-]+/g, '') || '0');
      monthlyData[month] = (monthlyData[month] || 0) + amount;
    });

    const monthlyBookings: Record<string, number> = {};
    bookings.forEach(b => {
      const month = new Date(b.date).toLocaleString('default', { month: 'short' });
      monthlyBookings[month] = (monthlyBookings[month] || 0) + 1;
    });

    return {
      totalRevenue,
      totalBookings: bookings.length,
      confirmedBookings,
      pendingBookings,
      cancelledBookings,
      completedBookings,
      tourBookings,
      transferBookings,
      avgBookingValue,
      popularTours,
      monthlyRevenue: monthlyData,
      monthlyBookings,
      conversionRate: bookings.length > 0 
        ? ((confirmedBookings + completedBookings) / bookings.length * 100).toFixed(1) 
        : '0',
    };
  }, [bookings, tours]);

  const handleExportReport = useCallback(() => {
    // Helper to escape CSV fields properly
    const escapeCSV = (value: string | number): string => {
      const str = String(value);
      // If contains comma, quote, or newline, wrap in quotes and escape existing quotes
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvData = [
      ['Analytics Report', `Generated: ${new Date().toLocaleDateString()}`],
      [''],
      ['Summary Metrics'],
      ['Metric', 'Value'],
      ['Total Revenue', `$${analytics.totalRevenue.toFixed(2)}`],
      ['Total Bookings', analytics.totalBookings],
      ['Average Booking Value', `$${analytics.avgBookingValue.toFixed(2)}`],
      ['Conversion Rate', `${analytics.conversionRate}%`],
      [''],
      ['Booking Status Breakdown'],
      ['Status', 'Count'],
      ['Confirmed', analytics.confirmedBookings],
      ['Pending', analytics.pendingBookings],
      ['Completed', analytics.completedBookings],
      ['Cancelled', analytics.cancelledBookings],
      [''],
      ['Service Type Breakdown'],
      ['Type', 'Count'],
      ['Tours', analytics.tourBookings],
      ['Transfers', analytics.transferBookings],
      [''],
      ['Top Performing Tours'],
      ['Tour Name', 'Bookings'],
      ...analytics.popularTours.map(([name, count]) => [name, count]),
      [''],
      ['Monthly Revenue'],
      ['Month', 'Revenue'],
      ...Object.entries(analytics.monthlyRevenue).map(([month, amount]) => [month, `$${amount.toFixed(2)}`]),
      [''],
      ['Monthly Bookings'],
      ['Month', 'Bookings'],
      ...Object.entries(analytics.monthlyBookings).map(([month, count]) => [month, count]),
    ];

    const csvContent = csvData.map(row => row.map(escapeCSV).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics_report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    toast({ title: "Export Complete", description: "Analytics report has been downloaded." });
  }, [analytics, toast]);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const revenueChartData = {
    labels: months,
    datasets: [
      {
        label: 'Revenue',
        data: months.map(m => analytics.monthlyRevenue[m] || 0),
        borderColor: COLORS.primary,
        backgroundColor: `${COLORS.primary}20`,
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const bookingsChartData = {
    labels: months,
    datasets: [
      {
        label: 'Bookings',
        data: months.map(m => analytics.monthlyBookings[m] || 0),
        backgroundColor: COLORS.accent4,
        borderRadius: 6,
      },
    ],
  };

  const statusChartData = {
    labels: ['Confirmed', 'Pending', 'Completed', 'Cancelled'],
    datasets: [
      {
        data: [
          analytics.confirmedBookings,
          analytics.pendingBookings,
          analytics.completedBookings,
          analytics.cancelledBookings,
        ],
        backgroundColor: [COLORS.accent3, COLORS.accent2, COLORS.accent4, COLORS.accent1],
        borderWidth: 0,
      },
    ],
  };

  const categoryChartData = {
    labels: ['Tours', 'Transfers'],
    datasets: [
      {
        data: [analytics.tourBookings, analytics.transferBookings],
        backgroundColor: [COLORS.primary, COLORS.accent4],
        borderWidth: 0,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0,0,0,0.05)',
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
    },
  };

  return (
    <DashboardLayout type="admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#004165]">Analytics Dashboard</h1>
            <p className="text-muted-foreground">
              Track your business performance and insights.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[140px]" data-testid="select-time-range">
                <SelectValue placeholder="Time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => refetchBookings()} data-testid="button-refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={handleExportReport} data-testid="button-export-report">
              <Download className="h-4 w-4 mr-2" /> Export Report
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Revenue"
            value={`$${analytics.totalRevenue.toLocaleString()}`}
            change="+12.5% from last month"
            changeType="positive"
            icon={DollarSign}
          />
          <StatCard
            title="Total Bookings"
            value={analytics.totalBookings.toString()}
            change="+8.2% from last month"
            changeType="positive"
            icon={Calendar}
          />
          <StatCard
            title="Avg. Booking Value"
            value={`$${analytics.avgBookingValue.toFixed(2)}`}
            change="+3.1% from last month"
            changeType="positive"
            icon={TrendingUp}
          />
          <StatCard
            title="Conversion Rate"
            value={`${analytics.conversionRate}%`}
            change="Confirmed + Completed"
            changeType="neutral"
            icon={Users}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-[#004165]" />
                Revenue Trend
              </CardTitle>
              <CardDescription>Monthly revenue over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <Line data={revenueChartData} options={chartOptions} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-[#004165]" />
                Booking Status
              </CardTitle>
              <CardDescription>Current booking breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <Doughnut data={statusChartData} options={doughnutOptions} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-[#004165]" />
                Bookings by Month
              </CardTitle>
              <CardDescription>Number of bookings per month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <Bar data={bookingsChartData} options={chartOptions} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-[#004165]" />
                Service Type
              </CardTitle>
              <CardDescription>Tours vs Transfers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <Doughnut data={categoryChartData} options={doughnutOptions} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Tours</CardTitle>
              <CardDescription>Most booked experiences</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.popularTours.length > 0 ? (
                  analytics.popularTours.map(([name, count], index) => (
                    <div key={name} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                          index === 0 ? 'bg-yellow-500' : 
                          index === 1 ? 'bg-gray-400' : 
                          index === 2 ? 'bg-amber-600' : 'bg-blue-500'
                        }`}>
                          {index + 1}
                        </div>
                        <span className="font-medium truncate max-w-[200px]">{name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{count} bookings</span>
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-[#004165] h-2 rounded-full" 
                            style={{ width: `${(count / (analytics.popularTours[0]?.[1] || 1)) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    No booking data available yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
              <CardDescription>Key performance indicators</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{analytics.confirmedBookings}</div>
                  <div className="text-sm text-green-700">Confirmed</div>
                </div>
                <div className="p-4 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{analytics.pendingBookings}</div>
                  <div className="text-sm text-yellow-700">Pending</div>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{analytics.completedBookings}</div>
                  <div className="text-sm text-blue-700">Completed</div>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{analytics.cancelledBookings}</div>
                  <div className="text-sm text-red-700">Cancelled</div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t">
                <h4 className="font-medium mb-3">Active Tours</h4>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total available tours</span>
                  <span className="font-bold text-lg">{tours.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
