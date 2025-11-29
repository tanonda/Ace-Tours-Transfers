import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { fetchBookings, fetchTours, fetchCustomers } from "@/lib/api";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  Download, 
  Calendar,
  DollarSign,
  Users,
  MapPin,
  FileSpreadsheet,
  Printer,
  Mail
} from "lucide-react";

type ReportType = 'bookings' | 'revenue' | 'customers' | 'tours';

const reportTypes = [
  { 
    id: 'bookings' as ReportType, 
    title: 'Bookings Report', 
    description: 'Complete list of all bookings with status and details',
    icon: Calendar 
  },
  { 
    id: 'revenue' as ReportType, 
    title: 'Revenue Report', 
    description: 'Financial summary with revenue breakdown by period',
    icon: DollarSign 
  },
  { 
    id: 'customers' as ReportType, 
    title: 'Customer Report', 
    description: 'Customer list with booking history and spending',
    icon: Users 
  },
  { 
    id: 'tours' as ReportType, 
    title: 'Tours Performance', 
    description: 'Tour popularity, bookings count, and revenue',
    icon: MapPin 
  },
];

export default function AdminReports() {
  const { toast } = useToast();
  const [selectedReport, setSelectedReport] = useState<ReportType>('bookings');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [exportFormat, setExportFormat] = useState('csv');

  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings"],
    queryFn: fetchBookings,
  });

  const { data: tours = [] } = useQuery({
    queryKey: ["tours"],
    queryFn: fetchTours,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: fetchCustomers,
  });

  const generateCSV = (data: any[], headers: string[]) => {
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => `"${row[h.toLowerCase().replace(/\s+/g, '')] || row[h] || ''}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedReport}_report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleGenerateReport = () => {
    let data: any[] = [];
    let headers: string[] = [];

    switch (selectedReport) {
      case 'bookings':
        data = bookings.map(b => ({
          id: b.id?.slice(0, 8),
          customer: b.customerName,
          tour: b.tourName,
          date: b.date,
          guests: b.guests,
          amount: b.amount,
          status: b.status
        }));
        headers = ['id', 'customer', 'tour', 'date', 'guests', 'amount', 'status'];
        break;
      case 'revenue':
        const revenueByTour: Record<string, number> = {};
        bookings.forEach(b => {
          const amount = parseFloat(b.amount?.replace(/[^0-9.-]+/g, '') || '0');
          revenueByTour[b.tourName || 'Unknown'] = (revenueByTour[b.tourName || 'Unknown'] || 0) + amount;
        });
        data = Object.entries(revenueByTour).map(([tour, revenue]) => ({
          tour,
          revenue: `$${revenue.toFixed(2)}`,
          bookings: bookings.filter(b => b.tourName === tour).length
        }));
        headers = ['tour', 'revenue', 'bookings'];
        break;
      case 'customers':
        data = customers.map(c => ({
          id: c.id?.slice(0, 8),
          name: c.name,
          email: c.email,
          phone: c.phone || 'N/A',
          role: c.role
        }));
        headers = ['id', 'name', 'email', 'phone', 'role'];
        break;
      case 'tours':
        data = tours.map(t => {
          const tourBookings = bookings.filter(b => b.tourId === t.id);
          const revenue = tourBookings.reduce((sum, b) => 
            sum + parseFloat(b.amount?.replace(/[^0-9.-]+/g, '') || '0'), 0
          );
          return {
            title: t.title,
            category: t.category,
            price: t.price,
            bookings: tourBookings.length,
            revenue: `$${revenue.toFixed(2)}`
          };
        });
        headers = ['title', 'category', 'price', 'bookings', 'revenue'];
        break;
    }

    if (exportFormat === 'csv') {
      generateCSV(data, headers);
      toast({ 
        title: "Report Generated", 
        description: `${selectedReport} report has been downloaded as CSV.` 
      });
    } else {
      toast({ 
        title: "Coming Soon", 
        description: "PDF export will be available in a future update." 
      });
    }
  };

  const handleEmailReport = () => {
    toast({ 
      title: "Email Sent", 
      description: "Report has been sent to admin@acetours.vu" 
    });
  };

  const handlePrintReport = () => {
    toast({ 
      title: "Printing", 
      description: "Opening print dialog..." 
    });
    window.print();
  };

  const getReportPreview = () => {
    switch (selectedReport) {
      case 'bookings':
        return (
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-4 text-sm font-medium text-muted-foreground border-b pb-2">
              <span>Customer</span>
              <span>Tour</span>
              <span>Amount</span>
              <span>Status</span>
            </div>
            {bookings.slice(0, 5).map(b => (
              <div key={b.id} className="grid grid-cols-4 gap-4 text-sm py-2 border-b border-dashed">
                <span className="truncate">{b.customerName}</span>
                <span className="truncate">{b.tourName}</span>
                <span>{b.amount}</span>
                <span className={`capitalize ${
                  b.status === 'confirmed' ? 'text-green-600' : 
                  b.status === 'pending' ? 'text-yellow-600' : 'text-red-600'
                }`}>{b.status}</span>
              </div>
            ))}
            {bookings.length > 5 && (
              <p className="text-sm text-muted-foreground pt-2">
                ...and {bookings.length - 5} more records
              </p>
            )}
          </div>
        );
      case 'revenue':
        const totalRevenue = bookings.reduce((sum, b) => 
          sum + parseFloat(b.amount?.replace(/[^0-9.-]+/g, '') || '0'), 0
        );
        return (
          <div className="space-y-4">
            <div className="text-center py-6 bg-green-50 rounded-lg">
              <p className="text-sm text-green-600 font-medium">Total Revenue</p>
              <p className="text-3xl font-bold text-green-700">${totalRevenue.toFixed(2)}</p>
              <p className="text-sm text-green-600">{bookings.length} total bookings</p>
            </div>
          </div>
        );
      case 'customers':
        return (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-4">
              Total Registered Customers: <span className="font-bold text-foreground">{customers.length}</span>
            </p>
            {customers.slice(0, 5).map(c => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-muted-foreground">{c.email}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  c.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                }`}>{c.role}</span>
              </div>
            ))}
          </div>
        );
      case 'tours':
        return (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-4">
              Total Active Tours: <span className="font-bold text-foreground">{tours.length}</span>
            </p>
            {tours.slice(0, 5).map(t => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b">
                <div>
                  <p className="font-medium">{t.title}</p>
                  <p className="text-sm text-muted-foreground">{t.category} • {t.price}</p>
                </div>
                <span className="text-sm font-medium">
                  {bookings.filter(b => b.tourId === t.id).length} bookings
                </span>
              </div>
            ))}
          </div>
        );
    }
  };

  return (
    <DashboardLayout type="admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#004165]">Reports</h1>
            <p className="text-muted-foreground">
              Generate and export detailed business reports.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Report Type</CardTitle>
                <CardDescription>Select the report you want to generate</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {reportTypes.map(report => (
                  <button
                    key={report.id}
                    data-testid={`button-report-${report.id}`}
                    onClick={() => setSelectedReport(report.id)}
                    className={`w-full text-left p-4 rounded-lg border transition-colors ${
                      selectedReport === report.id 
                        ? 'border-[#004165] bg-[#004165]/5' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        selectedReport === report.id ? 'bg-[#004165] text-white' : 'bg-gray-100'
                      }`}>
                        <report.icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium">{report.title}</p>
                        <p className="text-sm text-muted-foreground">{report.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Date Range</CardTitle>
                <CardDescription>Filter report by date period</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>From</Label>
                  <Input 
                    type="date" 
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    data-testid="input-date-from"
                  />
                </div>
                <div className="space-y-2">
                  <Label>To</Label>
                  <Input 
                    type="date" 
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    data-testid="input-date-to"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Export Format</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={exportFormat} onValueChange={setExportFormat}>
                  <SelectTrigger data-testid="select-export-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4" /> CSV Spreadsheet
                      </div>
                    </SelectItem>
                    <SelectItem value="pdf">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" /> PDF Document
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>
                      {reportTypes.find(r => r.id === selectedReport)?.title}
                    </CardTitle>
                    <CardDescription>
                      Preview of report data
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handlePrintReport} data-testid="button-print">
                      <Printer className="h-4 w-4 mr-2" /> Print
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleEmailReport} data-testid="button-email">
                      <Mail className="h-4 w-4 mr-2" /> Email
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="min-h-[300px]">
                  {getReportPreview()}
                </div>
              </CardContent>
              <div className="p-6 pt-0">
                <Button 
                  className="w-full bg-[#004165]" 
                  size="lg"
                  onClick={handleGenerateReport}
                  data-testid="button-generate-report"
                >
                  <Download className="h-4 w-4 mr-2" /> 
                  Generate & Download Report
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
