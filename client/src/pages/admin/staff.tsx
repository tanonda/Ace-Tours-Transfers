import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Mail, Shield, ShieldAlert, UserCog, Plus, Trash2, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAllUsers, updateUserRole, createUser } from "@/lib/api";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@shared/schema";
import { useAuth } from "@/lib/auth-context";

export default function AdminStaff() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { user: currentUser } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [promoteDialogOpen, setPromoteDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [targetRole, setTargetRole] = useState<string>("");
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [newStaff, setNewStaff] = useState({ name: '', email: '', password: '', role: 'field_service', username: '' });

    const { data: users = [], isLoading } = useQuery({
        queryKey: ["users"],
        queryFn: fetchAllUsers,
    });

    const updateRoleMutation = useMutation({
        mutationFn: ({ id, role }: { id: string; role: string }) => updateUserRole(id, role),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
            toast({ title: "Role Updated", description: "User permissions have been updated." });
            setPromoteDialogOpen(false);
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to update role.", variant: "destructive" });
        },
    });

    const createMutation = useMutation({
        mutationFn: createUser,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
            toast({ title: "Staff Created", description: "New staff account has been created." });
            setCreateDialogOpen(false);
            setNewStaff({ name: '', email: '', password: '', role: 'field_service', username: '' });
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to create staff account.", variant: "destructive" });
        },
    });

    const filteredUsers = users.filter(u =>
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleRoleChange = (user: User, newRole: string) => {
        setSelectedUser(user);
        setTargetRole(newRole);
        setPromoteDialogOpen(true);
    };

    const confirmRoleChange = () => {
        if (selectedUser && targetRole) {
            updateRoleMutation.mutate({ id: selectedUser.id, role: targetRole });
        }
    };

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'admin': return 'bg-purple-100 text-purple-800 border-purple-200';
            case 'field_service': return 'bg-blue-100 text-blue-800 border-blue-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    return (
        <DashboardLayout type="admin">
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-[#004165]">Staff Management</h1>
                        <p className="text-muted-foreground">Manage user roles and access permissions.</p>
                    </div>
                    <Button onClick={() => setCreateDialogOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" /> Add Staff
                    </Button>
                </div>

                <Card>
                    <CardHeader className="pb-3">
                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search users..."
                                className="pl-8"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Current Role</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8">Loading users...</TableCell>
                                    </TableRow>
                                ) : filteredUsers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8">No users found.</TableCell>
                                    </TableRow>
                                ) : (
                                    filteredUsers.map((user) => (
                                        <TableRow key={user.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar>
                                                        <AvatarFallback>
                                                            {user.name.split(' ').map(n => n[0]).join('')}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="font-medium">{user.name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>{user.email}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={getRoleBadgeColor(user.role)}>
                                                    {user.role === 'admin' && <ShieldAlert className="h-3 w-3 mr-1" />}
                                                    {user.role === 'field_service' && <UserCog className="h-3 w-3 mr-1" />}
                                                    {user.role}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Select
                                                    disabled={user.id === currentUser?.id} // Cannot change own role
                                                    onValueChange={(val) => handleRoleChange(user, val)}
                                                    value={user.role}
                                                >
                                                    <SelectTrigger className="w-[140px]">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="customer">Customer</SelectItem>
                                                        <SelectItem value="field_service">Field Service</SelectItem>
                                                        <SelectItem value="admin">Admin</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Confirmation Dialog */}
                <Dialog open={promoteDialogOpen} onOpenChange={setPromoteDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Change User Role</DialogTitle>
                            <DialogDescription>
                                Are you sure you want to change <strong>{selectedUser?.name}</strong>'s role to <strong>{targetRole}</strong>?
                                {targetRole === 'admin' && (
                                    <div className="mt-2 p-2 bg-red-50 text-red-800 rounded text-sm flex items-center gap-2">
                                        <ShieldAlert className="h-4 w-4" /> Warning: Admins have full access to the system.
                                    </div>
                                )}
                                {targetRole === 'field_service' && (
                                    <div className="mt-2 p-2 bg-blue-50 text-blue-800 rounded text-sm flex items-center gap-2">
                                        <UserCog className="h-4 w-4" /> Info: Field Service Staff can view bookings and calendar but cannot access settings or finance.
                                    </div>
                                )}
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setPromoteDialogOpen(false)}>Cancel</Button>
                            <Button onClick={confirmRoleChange} disabled={updateRoleMutation.isPending}>
                                {updateRoleMutation.isPending && <span className="animate-spin mr-2">⏳</span>}
                                Confirm Change
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Create Staff Dialog */}
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add New Staff Member</DialogTitle>
                            <DialogDescription>
                                Create a new staff account with appropriate role.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Full Name</label>
                                <Input
                                    placeholder="Enter full name"
                                    value={newStaff.name}
                                    onChange={(e) => setNewStaff(s => ({ ...s, name: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Email</label>
                                <Input
                                    type="email"
                                    placeholder="staff@acetours.vu"
                                    value={newStaff.email}
                                    onChange={(e) => setNewStaff(s => ({ ...s, email: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Username</label>
                                <Input
                                    placeholder="Enter username"
                                    value={newStaff.username}
                                    onChange={(e) => setNewStaff(s => ({ ...s, username: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Password</label>
                                <Input
                                    type="password"
                                    placeholder="Enter password"
                                    value={newStaff.password}
                                    onChange={(e) => setNewStaff(s => ({ ...s, password: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Role</label>
                                <Select
                                    value={newStaff.role}
                                    onValueChange={(val) => setNewStaff(s => ({ ...s, role: val }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="field_service">
                                            <div className="flex items-center gap-2">
                                                <UserCog className="h-4 w-4" /> Field Service
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="admin">
                                            <div className="flex items-center gap-2">
                                                <ShieldAlert className="h-4 w-4" /> Admin
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                            <Button
                                onClick={() => createMutation.mutate(newStaff)}
                                disabled={createMutation.isPending || !newStaff.name || !newStaff.email || !newStaff.password || !newStaff.username}
                            >
                                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create Staff
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </DashboardLayout>
    );
}
