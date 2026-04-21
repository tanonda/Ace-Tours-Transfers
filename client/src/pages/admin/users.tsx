import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { fetchAllUsers, fetchBookings, updateUserRole, resetUserPassword, createUser, sendWelcomeEmail, updateUserStatus } from "@/lib/api";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { Search, Mail, Phone, Download, Users, DollarSign, Calendar, MapPin, PlusCircle, Pencil, Send, KeyRound, LayoutGrid, List, EyeOff, CheckCircle2, AlertTriangle, MoreVertical, XCircle, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { User, Booking, InsertUser } from "@shared/schema";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";

const userFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters").max(50, "Password too long"),
  role: z.enum(["customer"]),
});

export default function AdminUsers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showInactive, setShowInactive] = useState(true);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: fetchAllUsers,
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => fetchBookings(),
  });

  const filteredUsers = users.filter(user => {
    const isCustomer = user.role === 'customer';
    const matchesSearch = !searchQuery ||
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.phone?.includes(searchQuery);

    const matchesVisibility = showInactive || user.isActive !== false;

    return isCustomer && matchesSearch && matchesVisibility;
  });

  const getUserBookings = (userId: string): Booking[] => {
    return bookings.filter(b => b.userId === userId);
  };

  const getUserTotalSpent = (userId: string): number => {
    return getUserBookings(userId).reduce((sum, b) =>
      sum + parseFloat(b.amount?.replace(/[^0-9.-]+/g, '') || '0'), 0
    );
  };

  const userStats = useMemo(() => {
    const totalUsers = users.length;
    const adminUsers = users.filter(u => u.role === 'admin').length;
    const fieldServiceUsers = users.filter(u => u.role === 'field_service').length;
    const customerUsers = users.filter(u => u.role === 'customer').length;

    const totalSpent = users.reduce((sum, u) => sum + getUserTotalSpent(u.id), 0);
    const avgSpent = totalUsers > 0 ? totalSpent / totalUsers : 0;

    return {
      total: totalUsers,
      admin: adminUsers,
      fieldService: fieldServiceUsers,
      customer: customerUsers,
      totalSpent,
      avgSpent
    };
  }, [users, bookings]);

  const handleExportUsers = () => {
    const csvContent = [
      ['Name', 'Email', 'Phone', 'Role', 'Bookings', 'Total Spent', 'Join Date', 'Last Updated'].join(','),
      ...filteredUsers.map(u => [
        u.name || '',
        u.email,
        u.phone || '',
        u.role,
        getUserBookings(u.id).length,
        `$${getUserTotalSpent(u.id).toFixed(2)}`,
        u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '',
        u.updatedAt ? new Date(u.updatedAt).toLocaleDateString() : '',
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({ title: "Export Complete", description: "User list has been downloaded." });
  };

  const handleUpdateRole = async (userId: string, role: string) => {
    try {
      await updateUserRole(userId, role);
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Role Updated", description: "User role has been updated." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update user role.", variant: "destructive" });
      console.error("Failed to update user role:", error);
    }
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => updateUserStatus(id, isActive),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: variables.isActive ? "User Activated" : "User Suspended", description: `Account for UID ${variables.id.slice(0, 8)} is now ${variables.isActive ? 'active' : 'suspended'}.` });
    },
    onError: () => toast({ title: "Error", description: "Failed to update account status.", variant: "destructive" }),
  });

  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const handleBulkStatusUpdate = async (isActive: boolean) => {
    if (selectedItems.length === 0) return;
    setIsBulkProcessing(true);
    try {
      for (const id of selectedItems) {
        await statusMutation.mutateAsync({ id, isActive });
      }
      setSelectedItems([]);
      toast({ title: "Bulk Update Complete", description: `Successfully ${isActive ? 'activated' : 'suspended'} ${selectedItems.length} customers.` });
    } catch (err: any) {
      toast({ title: "Error", description: "Bulk status update encountered errors.", variant: "destructive" });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const form = useForm<z.infer<typeof userFormSchema>>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      role: "customer",
    },
  });

  const onSubmitCreateUser = async (values: z.infer<typeof userFormSchema>) => {
    try {
      const username = values.email.split('@')[0] + '_' + Math.random().toString(36).substring(2, 7);
      await createUser({
        ...values,
        username,
      } as InsertUser);
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Success", description: "New user created successfully." });
      setIsCreateUserDialogOpen(false);
      form.reset();
    } catch (error) {
      toast({ title: "Error", description: "Failed to create user." });
      console.error("Failed to create user:", error);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;
    try {
      await resetUserPassword(selectedUser.id, newPassword);
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Success", description: "User password reset successfully." });
      setIsResetPasswordDialogOpen(false);
      setNewPassword('');
    } catch (error) {
      toast({ title: "Error", description: "Failed to reset password." });
      console.error("Failed to reset password:", error);
    }
  };

  const sendWelcomeMutation = useMutation({
    mutationFn: (userId: string) => sendWelcomeEmail(userId),
    onSuccess: () => toast({ title: "Welcome email sent", description: "An invitation email has been dispatched." }),
    onError: () => toast({ title: "Error", description: "Failed to send welcome email.", variant: "destructive" }),
  });


  return (
    <DashboardLayout type="admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#004165]">Customer Management</h1>
            <p className="text-muted-foreground">View and manage registered customers. For staff and admin accounts, visit the Staff page.</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Button onClick={() => setIsCreateUserDialogOpen(true)} data-testid="button-create-user" className="flex-1 sm:flex-none">
              <PlusCircle className="h-4 w-4 mr-2" /> Add Customer
            </Button>
            <Button variant="outline" onClick={handleExportUsers} data-testid="button-export-users" className="flex-1 sm:flex-none">
              <Download className="h-4 w-4 mr-2" /> Export List
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-100">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold">{userStats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-red-100">
                  <Users className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Admins</p>
                  <p className="text-2xl font-bold">{userStats.admin}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-orange-100">
                  <Users className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Field Service</p>
                  <p className="text-2xl font-bold">{userStats.fieldService}</p>
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
                  <p className="text-sm text-muted-foreground">Customers</p>
                  <p className="text-2xl font-bold">{userStats.customer}</p>
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
                  <p className="text-sm text-muted-foreground">Total Spent</p>
                  <p className="text-2xl font-bold">${userStats.totalSpent.toFixed(0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="relative w-full lg:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                className="pl-8 w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-customers"
              />
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
              <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto bg-muted/30 px-3 py-1.5 rounded-md border border-border">
                <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Show Inactive</label>
                <button
                  onClick={() => setShowInactive(!showInactive)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${showInactive ? 'bg-primary' : 'bg-input'}`}
                >
                  <span className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform ${showInactive ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              {selectedItems.length > 0 && (
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 bg-primary/5 px-2 py-1.5 rounded-lg border border-primary/20 w-full sm:w-auto">
                  <span className="text-xs font-bold text-primary mr-1 px-1">{selectedItems.length} Selected</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleBulkStatusUpdate(true)} className="h-8 text-xs text-green-600 border-green-200">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Activate
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleBulkStatusUpdate(false)} className="h-8 text-xs text-orange-600 border-orange-200">
                      <XCircle className="h-3 w-3 mr-1" /> Suspend
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex gap-1 bg-muted p-1 rounded-md ml-auto sm:ml-0">
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {viewMode === 'list' ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <div className={`w-4 h-4 rounded flex items-center justify-center cursor-pointer border ${selectedItems.length === filteredUsers.length && filteredUsers.length > 0 ? "bg-primary border-primary text-primary-foreground" : "bg-white border-gray-300"}`}
                        onClick={() => setSelectedItems(selectedItems.length === filteredUsers.length ? [] : filteredUsers.map((u: any) => u.id))}
                      >
                        {selectedItems.length === filteredUsers.length && filteredUsers.length > 0 && <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                      </div>
                    </TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Join Date</TableHead>
                    <TableHead className="text-center">Bookings</TableHead>
                    <TableHead className="text-right">Total Spent</TableHead>
                    <TableHead className="text-right">Account</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        Loading users...
                      </TableCell>
                    </TableRow>
                  ) : filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        No users found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => {
                      const userBookings = getUserBookings(user.id);
                      const totalSpent = getUserTotalSpent(user.id);

                      return (
                        <TableRow key={user.id} data-testid={`row-user-${user.id}`} className={!user.isActive ? "opacity-60 bg-muted/30" : ""}>
                          <TableCell>
                            <div className={`w-4 h-4 rounded flex items-center justify-center cursor-pointer border ${selectedItems.includes(user.id) ? "bg-primary border-primary text-primary-foreground" : "bg-white border-gray-300"}`}
                              onClick={() => setSelectedItems(prev => prev.includes(user.id) ? prev.filter(id => id !== user.id) : [...prev, user.id])}
                            >
                              {selectedItems.includes(user.id) && <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                <AvatarFallback className={!user.isActive ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary font-semibold"}>
                                  {user.name?.split(' ').map(n => n[0]).join('') || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{user.name || 'Unknown'}</div>
                                <div className="text-[10px] text-muted-foreground flex items-center gap-1 uppercase tracking-tighter">
                                  ID: {user.id.slice(0, 8)}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1 text-xs">
                              <div className="flex items-center gap-2">
                                <Mail className="h-3 w-3 text-muted-foreground" />
                                {user.email}
                              </div>
                              {user.phone && (
                                <div className="flex items-center gap-2">
                                  <Phone className="h-3 w-3 text-muted-foreground" />
                                  {user.phone}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            {user.createdAt
                              ? new Date(user.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })
                              : 'N/A'
                            }
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="font-medium">{userBookings.length}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            ${totalSpent.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            {user.isActive !== false ?
                              <Badge variant="secondary" className="bg-green-100 text-green-700 border-0 hover:bg-green-100 text-[10px] font-bold uppercase tracking-widest px-1.5 py-0">Active</Badge> :
                              <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-0 hover:bg-orange-100 text-[10px] font-bold uppercase tracking-widest px-1.5 py-0">Suspended</Badge>
                            }
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedUser(user)} title="View Profile"><Pencil className="h-4 w-4 text-muted-foreground" /></Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4 text-muted-foreground" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Account Management</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => statusMutation.mutate({ id: user.id, isActive: !user.isActive })}>
                                    {user.isActive !== false ? <><XCircle className="h-4 w-4 mr-2" /> Suspend Account</> : <><CheckCircle2 className="h-4 w-4 mr-2" /> Activate Account</>}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setSelectedUser(user); setIsResetPasswordDialogOpen(true); }}>
                                    <KeyRound className="h-4 w-4 mr-2" /> Reset Password
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => sendWelcomeMutation.mutate(user.id)}>
                                    <Send className="h-4 w-4 mr-2" /> Resend Welcome
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isLoading ? (
                  <div className="col-span-full text-center py-8">Loading users...</div>
                ) : filteredUsers.length === 0 ? (
                  <div className="col-span-full text-center py-8">No users found.</div>
                ) : (
                  filteredUsers.map((user) => {
                    const userBookings = getUserBookings(user.id);
                    const totalSpent = getUserTotalSpent(user.id);

                    return (
                      <Card key={user.id} className="overflow-hidden cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setSelectedUser(user)}>
                        <CardHeader className="pb-2 bg-slate-50 border-b">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                  {user.name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <CardTitle className="text-base">{user.name || 'Unknown'}</CardTitle>
                                <CardDescription className="text-xs">ID: #{user.id.slice(0, 8)}</CardDescription>
                              </div>
                            </div>
                            <Badge variant="outline" className="capitalize text-xs">{user.role}</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-4 pb-2 space-y-3">
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Mail className="h-4 w-4 shrink-0" />
                              <span className="truncate" title={user.email}>{user.email}</span>
                            </div>
                            {user.phone && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Phone className="h-4 w-4 shrink-0" />
                                <span>{user.phone}</span>
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2 pt-2 border-t mt-2">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Bookings</p>
                              <p className="font-semibold">{userBookings.length}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground mb-1">Total Spent</p>
                              <p className="font-semibold text-green-600">${totalSpent.toFixed(2)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            {selectedUser && (
              <>
                <DialogHeader>
                  <DialogTitle>User Profile: {selectedUser.name}</DialogTitle>
                  <DialogDescription>
                    Detailed information and booking history for {selectedUser.name}.
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
                          {selectedUser.name?.split(' ').map(n => n[0]).join('') || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="text-xl font-bold">{selectedUser.name || 'Unknown'}</h3>
                        <p className="text-muted-foreground">{selectedUser.email}</p>
                        <Badge className="capitalize mt-1">{selectedUser.role}</Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Mail className="h-4 w-4" /> Email
                        </div>
                        <p className="font-medium">{selectedUser.email}</p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Phone className="h-4 w-4" /> Phone
                        </div>
                        <p className="font-medium">{selectedUser.phone || 'Not provided'}</p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Calendar className="h-4 w-4" /> Member Since
                        </div>
                        <p className="font-medium">
                          {selectedUser.createdAt
                            ? new Date(selectedUser.createdAt).toLocaleDateString()
                            : 'N/A'
                          }
                        </p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <DollarSign className="h-4 w-4" /> Total Spent
                        </div>
                        <p className="font-medium text-green-600">
                          ${getUserTotalSpent(selectedUser.id).toFixed(2)}
                        </p>
                      </div>
                      <div className="p-4 border rounded-lg col-span-2">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <Pencil className="h-4 w-4" /> User Role
                        </div>
                        <Select onValueChange={(value) => handleUpdateRole(selectedUser.id, value)} value={selectedUser.role}>
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="customer">Customer</SelectItem>
                            <SelectItem value="field_service">Field Service</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={sendWelcomeMutation.isPending}
                        onClick={() => selectedUser && sendWelcomeMutation.mutate(selectedUser.id)}
                      >
                        <Send className="h-3.5 w-3.5 mr-1.5" />
                        Send Welcome Email
                      </Button>
                      <Button variant="outline" onClick={() => setIsResetPasswordDialogOpen(true)}>
                        <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                        Reset Password
                      </Button>
                    </div>
                  </TabsContent>
                  <TabsContent value="bookings">
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {getUserBookings(selectedUser.id).length > 0 ? (
                        getUserBookings(selectedUser.id).map(booking => (
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

        {/* Create New User Dialog */}
        <Dialog open={isCreateUserDialogOpen} onOpenChange={setIsCreateUserDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Customer</DialogTitle>
              <DialogDescription>
                Create a new customer profile.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitCreateUser)} className="space-y-4 py-2">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name *</FormLabel>
                    <FormControl><Input placeholder="Jane Smith" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address *</FormLabel>
                    <FormControl><Input type="email" placeholder="jane@example.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone (optional)</FormLabel>
                    <FormControl><Input placeholder="+678 5555 1234" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password *</FormLabel>
                    <FormControl><Input type="password" placeholder="Min. 6 characters" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="customer">Customer</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => { setIsCreateUserDialogOpen(false); form.reset(); }}>
                    Cancel
                  </Button>
                  <Button type="submit">Add Customer</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Reset Password Dialog */}
        <Dialog open={isResetPasswordDialogOpen} onOpenChange={setIsResetPasswordDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Reset Password for {selectedUser?.name}</DialogTitle>
              <DialogDescription>
                Enter a new password for this user.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="new-password" className="text-right">
                  New Password
                </Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="col-span-3"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleResetPassword} disabled={!newPassword}>Reset Password</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
