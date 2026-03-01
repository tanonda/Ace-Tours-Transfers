import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, AlertCircle, Info, Landmark, Check, X, ShieldAlert, ChevronDown, Wallet, Calendar, User, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchBookings, updateBooking } from "@/lib/api";
import { format } from "date-fns";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type StalePayment = {
    id: string;
    bookingId: string;
    amount: number;
    currency: string;
    status: string;
    gatewayId: string;
    gatewayReference: string | null;
    createdAt: string;
    lastReconciledAt: string | null;
    reconciliationAttempts: number | null;
};

export default function AdminReconciliation() {
    const { t } = useTranslation();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [syncingPaymentId, setSyncingPaymentId] = useState<string | null>(null);
    const [isBatchSyncing, setIsBatchSyncing] = useState(false);

    const { data: payments = [], isLoading: isStaleLoading } = useQuery<StalePayment[]>({
        queryKey: ["stale-payments"],
        queryFn: () => fetch("/api/admin/reconciliation/stale").then(res => res.json()),
    });

    const { data: bookings = [], isLoading: isBookingsLoading } = useQuery({
        queryKey: ["admin-bookings"],
        queryFn: () => fetchBookings(),
    });

    const syncMutation = useMutation({
        mutationFn: async ({ id, note, forceStatus }: { id: string, note?: string, forceStatus?: string }) => {
            const res = await fetch(`/api/admin/reconciliation/sync/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ note, forceStatus }),
            });
            if (!res.ok) throw new Error(await res.text());
            return res.json();
        },
        onSuccess: (updatedPayment) => {
            toast({
                title: "Payment Synced",
                description: `Status updated to ${updatedPayment.status}`,
            });
            queryClient.invalidateQueries({ queryKey: ["stale-payments"] });
            queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
        },
        onError: (err: any) => {
            toast({
                title: "Sync Failed",
                description: err.message || "Failed to sync payment with gateway",
                variant: "destructive",
            });
        },
        onSettled: () => {
            setSyncingPaymentId(null);
        }
    });

    const updateBookingMutation = useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: any }) => updateBooking(id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
            toast({ title: "Success", description: "Booking updated successfully." });
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to update booking.", variant: "destructive" });
        },
    });

    const handleSync = (paymentId: string) => {
        setSyncingPaymentId(paymentId);
        syncMutation.mutate({ id: paymentId, note: "Admin manual sync trigger" });
    };

    const handleForceComplete = (paymentId: string) => {
        if (!confirm("Are you sure you want to FORCE complete this payment? This will confirm the booking and send tickets.")) return;
        setSyncingPaymentId(paymentId);
        syncMutation.mutate({ id: paymentId, note: "Admin forced completion", forceStatus: "completed" });
    };

    const handleForceFail = (paymentId: string) => {
        if (!confirm("Are you sure you want to Mark this payment as FAILED? This will cancel the booking.")) return;
        setSyncingPaymentId(paymentId);
        syncMutation.mutate({ id: paymentId, note: "Admin forced failure", forceStatus: "failed" });
    };

    const handleConfirmOffline = (id: string) => {
        updateBookingMutation.mutate({ id, updates: { status: 'confirmed' } });
    };

    const handleCancelOffline = (id: string) => {
        if (!confirm("Are you sure you want to cancel this booking?")) return;
        updateBookingMutation.mutate({ id, updates: { status: 'cancelled' } });
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return "Never";
        const date = new Date(dateString);
        return date.toLocaleString();
    };

    // Offline payment methods detection
    const OFFLINE_METHODS = [
        'manual_transfer', 'bank-transfer', 'bank_transfer', 'bank', 'cash',
        'cash-on-delivery', 'local-bank-transfer', 'local-bank', 'cash-at-office',
        'v-money', 'm-vatu', 'my-cash', 'digi-cash'
    ];
    const pendingOfflineBookings = bookings.filter(b =>
        b.status === 'pending' &&
        OFFLINE_METHODS.includes(b.paymentMethod || '')
    );

    return (
        <DashboardLayout type="admin">
            <div className="flex flex-col gap-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <Landmark className="h-6 w-6 text-muted-foreground" />
                        Management & Reconciliation
                    </h1>
                    <p className="text-sm text-muted-foreground">Monitor stale online payments and confirm offline manual bookings.</p>
                </div>

                <Tabs defaultValue="offline">
                    <TabsList>
                        <TabsTrigger value="offline" className="flex items-center gap-2">
                            <Wallet className="h-4 w-4" />
                            Offline Payments
                            {pendingOfflineBookings.length > 0 && (
                                <Badge variant="destructive" className="ml-1 h-5 w-5 flex items-center justify-center p-0 rounded-full">
                                    {pendingOfflineBookings.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="stale" className="flex items-center gap-2">
                            <RefreshCw className="h-4 w-4" />
                            Stale Online
                            {payments.length > 0 && (
                                <Badge variant="destructive" className="ml-1 h-5 w-5 flex items-center justify-center p-0 rounded-full">
                                    {payments.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="offline" className="mt-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium flex items-center gap-2 text-blue-600">
                                        <Wallet className="h-4 w-4" /> Pending Offline
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{pendingOfflineBookings.length}</div>
                                    <p className="text-xs text-muted-foreground">Waiting for manual confirmation</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-600">
                                        <DollarSign className="h-4 w-4" /> Total Value
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">
                                        VUV {pendingOfflineBookings.reduce((sum, b) => sum + ((b.totalAmountCents || 0) / 100), 0).toLocaleString()}
                                    </div>
                                    <p className="text-xs text-muted-foreground">Projected revenue from pending items</p>
                                </CardContent>
                            </Card>
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle>Awaiting Confirmation</CardTitle>
                                <CardDescription>
                                    Bookings made with manual methods (Bank Transfer, Cash) that require admin verification.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {isBookingsLoading ? (
                                    <div className="flex justify-center p-8"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>
                                ) : pendingOfflineBookings.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg bg-muted/20 border-border">
                                        <Check className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                                        <h3 className="text-lg font-medium">All Reconciled</h3>
                                        <p className="text-sm text-muted-foreground">No pending offline payments to confirm.</p>
                                    </div>
                                ) : (
                                    <div className="rounded-md border overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/50">
                                                    <TableHead>Booking</TableHead>
                                                    <TableHead>Guest</TableHead>
                                                    <TableHead>Method</TableHead>
                                                    <TableHead className="text-right">Amount</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {pendingOfflineBookings.map((booking) => (
                                                    <TableRow key={booking.id}>
                                                        <TableCell className="font-mono text-xs">
                                                            {booking.id.split('-')[0].toUpperCase()}
                                                            <div className="text-[10px] text-muted-foreground mt-1">
                                                                {format(new Date(booking.createdAt), "MMM dd, yyyy")}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="font-semibold text-sm">{booking.customerName}</div>
                                                            <div className="text-xs text-muted-foreground">{booking.customerEmail}</div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className="capitalize text-[10px]">
                                                                {booking.paymentMethod?.replace(/[-_]/g, ' ') || 'Manual'}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold text-primary">
                                                            VUV {((booking.totalAmountCents || 0) / 100).toLocaleString()}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <Button
                                                                    size="sm"
                                                                    className="h-8 bg-green-600 hover:bg-green-700"
                                                                    onClick={() => handleConfirmOffline(booking.id)}
                                                                >
                                                                    Confirm
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-8 text-destructive"
                                                                    onClick={() => handleCancelOffline(booking.id)}
                                                                >
                                                                    <X className="h-4 w-4" />
                                                                </Button>
                                                            </div>
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

                    <TabsContent value="stale" className="mt-6 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Stale Online Payments</CardTitle>
                                <CardDescription>
                                    Payments that have been in 'processing' status longer than expected.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {isStaleLoading ? (
                                    <div className="flex justify-center p-8"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>
                                ) : payments.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg bg-muted/20 border-border">
                                        <Info className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                                        <h3 className="text-lg font-medium">No Stale Online Payments</h3>
                                    </div>
                                ) : (
                                    <div className="rounded-md border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Payment ID</TableHead>
                                                    <TableHead>Amount</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {payments.map((payment) => (
                                                    <TableRow key={payment.id}>
                                                        <TableCell className="font-mono text-xs">
                                                            {payment.id.split('-')[0]}...
                                                            <div className="text-[10px] text-muted-foreground mt-1">Ref: {payment.gatewayReference || 'N/A'}</div>
                                                        </TableCell>
                                                        <TableCell>{payment.currency.toUpperCase()} {(payment.amount / 100).toFixed(2)}</TableCell>
                                                        <TableCell><Badge variant="secondary">{payment.status}</Badge></TableCell>
                                                        <TableCell className="text-right">
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="outline" size="sm">Actions <ChevronDown className="h-4 w-4 ml-2" /></Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuItem onClick={() => handleSync(payment.id)}>Auto Sync</DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => handleForceComplete(payment.id)} className="text-green-600">Force Complete</DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => handleForceFail(payment.id)} className="text-destructive">Force Fail</DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
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
                </Tabs>
            </div>
        </DashboardLayout>
    );
}
