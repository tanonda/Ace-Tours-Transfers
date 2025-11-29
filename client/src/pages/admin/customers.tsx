import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Mail, Phone, Download, Users, DollarSign, Calendar, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchCustomers, fetchBookings } from "@/lib/api";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import type { User, Booking } from "@shared/schema";

export default function AdminCustomers() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<User | null>(null);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: fetchCustomers,
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings"],
    queryFn: fetchBookings,
  });

  const filteredCustomers = customers.filter(customer => 
    customer.role === 'customer' && (
      customer.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const getCustomerBookings = (userId: string): Booking[] => {
    return bookings.filter(b => b.userId === userId);
  };

  const getCustomerTotalSpent = (userId: string): number => {
    return getCustomerBookings(userId).reduce((sum, b) => 
      sum + parseFloat(b.amount?.replace(/[^0-9.-]+/g, '') || '0'), 0
    );
  };

  const customerStats = useMemo(() => {
    const customerList = customers.filter(c => c.role === 'customer');
    const totalSpent = customerList.reduce((sum, c) => sum + getCustomerTotalSpent(c.id), 0);
    const avgSpent = customerList.length > 0 ? totalSpent / customerList.length : 0;
    const activeCustomers = customerList.filter(c => getCustomerBookings(c.id).length > 0).length;
    
    return {
      total: customerList.length,
      active: activeCustomers,
      totalSpent,
      avgSpent
    };
  }, [customers, bookings]);

  const handleExportCustomers = () => {
    const csvContent = [
      ['Name', 'Email', 'Phone', 'Bookings', 'Total Spent', 'Join Date'].join(','),
      ...filteredCustomers.map(c => [
        c.name || '',
        c.email,
        c.phone || '',
        getCustomerBookings(c.id).length,
        `$${getCustomerTotalSpent(c.id).toFixed(2)}`,
        c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ''
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({ title: "Export Complete", description: "Customer list has been downloaded." });
  };

  return (
    <DashboardLayout type="admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#004165]">Customers</h1>
            <p className="text-muted-foreground">View and manage registered customers.</p>
          </div>
          <Button variant="outline" onClick={handleExportCustomers} data-testid="button-export-customers">
            <Download className="h-4 w-4 mr-2" /> Export List
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-100">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Customers</p>
                  <p className="text-2xl font-bold">{customerStats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-100">
                  <Users className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Customers</p>
                  <p className="text-2xl font-bold">{customerStats.active}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-purple-100">
                  <DollarSign className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">${customerStats.totalSpent.toFixed(0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-yellow-100">
                  <DollarSign className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg. Spending</p>
                  <p className="text-2xl font-bold">${customerStats.avgSpent.toFixed(0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search customers..." 
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-customers"
              />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Join Date</TableHead>
                  <TableHead className="text-center">Bookings</TableHead>
                  <TableHead className="text-right">Total Spent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Loading customers...
                    </TableCell>
                  </TableRow>
                ) : filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      No customers found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((customer) => {
                    const customerBookings = getCustomerBookings(customer.id);
                    const totalSpent = getCustomerTotalSpent(customer.id);
                    
                    return (
                      <TableRow key={customer.id} data-testid={`row-customer-${customer.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarFallback>
                                {customer.name?.split(' ').map(n => n[0]).join('') || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{customer.name || 'Unknown'}</div>
                              <div className="text-sm text-muted-foreground">
                                ID: #{customer.id.slice(0, 8)}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-2">
                              <Mail className="h-3 w-3 text-muted-foreground" /> 
                              {customer.email}
                            </div>
                            {customer.phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="h-3 w-3 text-muted-foreground" /> 
                                {customer.phone}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {customer.createdAt 
                            ? new Date(customer.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })
                            : 'N/A'
                          }
                        </TableCell>
                        <TableCell className="text-center">
                          {customerBookings.length}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${totalSpent.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge className={customerBookings.length > 0 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                          }>
                            {customerBookings.length > 0 ? 'Active' : 'New'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setSelectedCustomer(customer)}
                            data-testid={`button-view-${customer.id}`}
                          >
                            View Profile
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
          <DialogContent className="sm:max-w-[600px]">
            {selectedCustomer && (
              <>
                <DialogHeader>
                  <DialogTitle>Customer Profile</DialogTitle>
                  <DialogDescription>
                    Detailed information and booking history
                  </DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="profile" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="profile">Profile</TabsTrigger>
                    <TabsTrigger value="bookings">Booking History</TabsTrigger>
                  </TabsList>
                  <TabsContent value="profile" className="space-y-4">
                    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                      <Avatar className="h-16 w-16">
                        <AvatarFallback className="text-xl">
                          {selectedCustomer.name?.split(' ').map(n => n[0]).join('') || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="text-xl font-bold">{selectedCustomer.name || 'Unknown'}</h3>
                        <p className="text-muted-foreground">{selectedCustomer.email}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Mail className="h-4 w-4" /> Email
                        </div>
                        <p className="font-medium">{selectedCustomer.email}</p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Phone className="h-4 w-4" /> Phone
                        </div>
                        <p className="font-medium">{selectedCustomer.phone || 'Not provided'}</p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Calendar className="h-4 w-4" /> Member Since
                        </div>
                        <p className="font-medium">
                          {selectedCustomer.createdAt 
                            ? new Date(selectedCustomer.createdAt).toLocaleDateString()
                            : 'N/A'
                          }
                        </p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <DollarSign className="h-4 w-4" /> Total Spent
                        </div>
                        <p className="font-medium text-green-600">
                          ${getCustomerTotalSpent(selectedCustomer.id).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="bookings">
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {getCustomerBookings(selectedCustomer.id).length > 0 ? (
                        getCustomerBookings(selectedCustomer.id).map(booking => (
                          <div key={booking.id} className="p-4 border rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium">{booking.tourName}</h4>
                              <Badge className={
                                booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                                booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                booking.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                                'bg-red-100 text-red-800'
                              }>
                                {booking.status}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(booking.date).toLocaleDateString()}
                              </div>
                              <div className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {booking.guests} guests
                              </div>
                              <div className="text-right font-medium text-foreground">
                                {booking.amount}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>No bookings yet</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
