import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Search, Mail, Shield, ShieldAlert, UserCog, Plus, Loader2, MoreVertical,
  KeyRound, Trash2, Eye, EyeOff, RefreshCw, Users, UserCheck, Lock
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAllUsers, updateUserRole, createUser, resetUserPassword } from "@/lib/api";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@shared/schema";
import { useAuth } from "@/lib/auth-context";

const ROLE_CONFIG: Record<string, { label: string; color: string; description: string; icon: React.ReactNode }> = {
  admin: {
    label: "Admin",
    color: "bg-purple-100 text-purple-800 border-purple-200",
    description: "Full system access — bookings, settings, users, analytics",
    icon: <ShieldAlert className="h-3.5 w-3.5" />,
  },
  field_service: {
    label: "Field Service",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    description: "Read bookings and calendar. Cannot access settings or financials.",
    icon: <UserCog className="h-3.5 w-3.5" />,
  },
};

export default function AdminStaff() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{ type: "role" | "delete" | "password"; user: User; newRole?: string } | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewUserOpen, setViewUserOpen] = useState<User | null>(null);
  const [newStaff, setNewStaff] = useState({ name: "", email: "", password: "", role: "field_service", username: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetPasswordDialogUser, setResetPasswordDialogUser] = useState<User | null>(null);

  const { data: allUsers = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: fetchAllUsers,
  });

  // Staff = admins + field_service only
  const staffUsers = allUsers.filter((u: User) => u.role === "admin" || u.role === "field_service");
  const filtered = staffUsers.filter((u: User) =>
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: staffUsers.length,
    admins: staffUsers.filter((u: User) => u.role === "admin").length,
    field: staffUsers.filter((u: User) => u.role === "field_service").length,
  };

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => updateUserRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Role updated", description: "Staff permissions have been updated." });
      setConfirmDialog(null);
    },
    onError: () => toast({ title: "Error updating role", variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Staff account created", description: `${newStaff.name} has been added.` });
      setCreateDialogOpen(false);
      setNewStaff({ name: "", email: "", password: "", role: "field_service", username: "" });
    },
    onError: () => toast({ title: "Failed to create staff account", variant: "destructive" }),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => resetUserPassword(id, password),
    onSuccess: () => {
      toast({ title: "Password reset successfully" });
      setResetPasswordDialogUser(null);
      setResetPasswordValue("");
    },
    onError: () => toast({ title: "Failed to reset password", variant: "destructive" }),
  });

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <DashboardLayout type="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#004165]/10 rounded-xl">
              <Users className="h-6 w-6 text-[#004165]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#004165]">Staff Management</h1>
              <p className="text-muted-foreground text-sm">Manage admin and field service accounts</p>
            </div>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)} className="bg-[#004165] hover:bg-[#004165]/90">
            <Plus className="mr-2 h-4 w-4" /> Add Staff Member
          </Button>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Staff", value: stats.total, color: "border-l-[#004165]", icon: <Users className="h-5 w-5 text-[#004165]" /> },
            { label: "Admins", value: stats.admins, color: "border-l-purple-500", icon: <ShieldAlert className="h-5 w-5 text-purple-500" /> },
            { label: "Field Service", value: stats.field, color: "border-l-blue-500", icon: <UserCog className="h-5 w-5 text-blue-500" /> },
          ].map(s => (
            <Card key={s.label} className={`border-l-4 ${s.color}`}>
              <CardContent className="p-4 flex items-center gap-3">
                {s.icon}
                <div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Roles explanation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
            <div key={key} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/20">
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.color} shrink-0 mt-0.5`}>
                {cfg.icon}{cfg.label}
              </span>
              <p className="text-xs text-muted-foreground">{cfg.description}</p>
            </div>
          ))}
        </div>

        {/* Staff Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <CardTitle className="text-base">Staff Accounts</CardTitle>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search staff…" className="pl-8" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p>No staff accounts found.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((user: User) => {
                    const roleCfg = ROLE_CONFIG[user.role] || ROLE_CONFIG.field_service;
                    const isMe = user.id === currentUser?.id;
                    return (
                      <TableRow key={user.id} className="hover:bg-muted/20">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback className="bg-[#004165]/10 text-[#004165] text-xs font-bold">
                                {getInitials(user.name || "?")}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-semibold text-sm">{user.name}
                                {isMe && <span className="ml-1.5 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">You</span>}
                              </p>
                              <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <a href={`mailto:${user.email}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {user.email}
                          </a>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${roleCfg.color}`}>
                            {roleCfg.icon}
                            <span className="ml-1">{roleCfg.label}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm font-mono text-muted-foreground">
                          {(user as any).username || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setViewUserOpen(user)}>
                                <Eye className="h-3.5 w-3.5 mr-2" /> View Details
                              </DropdownMenuItem>
                              {!isMe && (
                                <>
                                  {user.role !== "admin" ? (
                                    <DropdownMenuItem className="text-purple-600"
                                      onClick={() => setConfirmDialog({ type: "role", user, newRole: "admin" })}>
                                      <ShieldAlert className="h-3.5 w-3.5 mr-2" /> Promote to Admin
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem className="text-blue-600"
                                      onClick={() => setConfirmDialog({ type: "role", user, newRole: "field_service" })}>
                                      <UserCog className="h-3.5 w-3.5 mr-2" /> Demote to Field Service
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => { setResetPasswordDialogUser(user); setResetPasswordValue(""); }}>
                                    <KeyRound className="h-3.5 w-3.5 mr-2" /> Reset Password
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
              {filtered.length} staff member{filtered.length !== 1 ? "s" : ""}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Role Change Confirm */}
      <Dialog open={confirmDialog?.type === "role"} onOpenChange={open => !open && setConfirmDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>
              Change <strong>{confirmDialog?.user.name}</strong>'s role to <strong>{confirmDialog?.newRole}</strong>?
            </DialogDescription>
          </DialogHeader>
          {confirmDialog?.newRole === "admin" && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              Admins have full system access including settings, financials, and user management.
            </div>
          )}
          {confirmDialog?.newRole === "field_service" && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 flex items-start gap-2">
              <UserCog className="h-4 w-4 shrink-0 mt-0.5" />
              Field Service staff can only view bookings and the calendar.
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>Cancel</Button>
            <Button disabled={updateRoleMutation.isPending}
              onClick={() => confirmDialog && updateRoleMutation.mutate({ id: confirmDialog.user.id, role: confirmDialog.newRole! })}>
              {updateRoleMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View User Details */}
      <Dialog open={!!viewUserOpen} onOpenChange={open => !open && setViewUserOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Staff Details</DialogTitle>
          </DialogHeader>
          {viewUserOpen && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 py-2">
                <Avatar className="h-14 w-14">
                  <AvatarFallback className="bg-[#004165]/10 text-[#004165] text-lg font-bold">
                    {getInitials(viewUserOpen.name || "?")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold text-lg">{viewUserOpen.name}</p>
                  <Badge variant="outline" className={`text-xs ${ROLE_CONFIG[viewUserOpen.role]?.color}`}>
                    {ROLE_CONFIG[viewUserOpen.role]?.label || viewUserOpen.role}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                {[
                  { label: "Email", value: viewUserOpen.email },
                  { label: "Username", value: (viewUserOpen as any).username || "—" },
                  { label: "User ID", value: viewUserOpen.id.slice(0, 16) + "…" },
                  { label: "Joined", value: (viewUserOpen as any).createdAt ? new Date((viewUserOpen as any).createdAt).toLocaleDateString("en-AU") : "—" },
                ].map(row => (
                  <div key={row.label} className="flex justify-between py-1.5 border-b border-border last:border-0">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-medium">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetPasswordDialogUser} onOpenChange={open => !open && setResetPasswordDialogUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> Reset Password</DialogTitle>
            <DialogDescription>Set a new password for <strong>{resetPasswordDialogUser?.name}</strong></DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>New Password</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Enter new password (min 6 chars)"
                value={resetPasswordValue}
                onChange={e => setResetPasswordValue(e.target.value)}
                className="pr-10"
              />
              <button type="button" className="absolute right-3 top-2.5 text-muted-foreground"
                onClick={() => setShowPassword(v => !v)}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordDialogUser(null)}>Cancel</Button>
            <Button
              disabled={resetPasswordMutation.isPending || resetPasswordValue.length < 6}
              onClick={() => resetPasswordDialogUser && resetPasswordMutation.mutate({ id: resetPasswordDialogUser.id, password: resetPasswordValue })}>
              {resetPasswordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Staff Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> Add Staff Member</DialogTitle>
            <DialogDescription>Create a new staff account with appropriate access level</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Full Name *</Label>
                <Input placeholder="Jane Smith" value={newStaff.name} onChange={e => setNewStaff(s => ({ ...s, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Username *</Label>
                <Input placeholder="jsmith" value={newStaff.username} onChange={e => setNewStaff(s => ({ ...s, username: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" placeholder="jane@acetours.vu" value={newStaff.email} onChange={e => setNewStaff(s => ({ ...s, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Password *</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password (min 6 chars)"
                  value={newStaff.password}
                  onChange={e => setNewStaff(s => ({ ...s, password: e.target.value }))}
                  className="pr-10"
                />
                <button type="button" className="absolute right-3 top-2.5 text-muted-foreground"
                  onClick={() => setShowPassword(v => !v)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Access Role *</Label>
              <Select value={newStaff.role} onValueChange={val => setNewStaff(s => ({ ...s, role: val }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">{cfg.icon} {cfg.label}</div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{ROLE_CONFIG[newStaff.role]?.description}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate(newStaff)}
              disabled={createMutation.isPending || !newStaff.name || !newStaff.email || !newStaff.password || !newStaff.username || newStaff.password.length < 6}
              className="bg-[#004165] hover:bg-[#004165]/90"
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Staff Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
