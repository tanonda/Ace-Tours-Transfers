import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
    Loader2, ArrowLeft, Search, CheckCircle, XCircle, AlertCircle,
    CalendarDays, Users, MapPin, Phone, FileText, CreditCard, Edit3, Ban
} from "lucide-react";
import { Layout } from "@/components/layout";
import { format } from "date-fns";

interface BookingSession {
    booking: any;
    items: any[];
    payments: any[];
    sessionExpiresAt: number;
}

export default function ManageBooking() {
    const { toast } = useToast();

    // Lookup state
    const [bookingRef, setBookingRef] = useState("");
    const [email, setEmail] = useState("");
    const [isVerifying, setIsVerifying] = useState(false);

    // Session state
    const [session, setSession] = useState<BookingSession | null>(null);

    // Edit state
    const [isEditing, setIsEditing] = useState(false);
    const [editFields, setEditFields] = useState({ pickupLocation: "", notes: "", customerPhone: "" });
    const [isSaving, setIsSaving] = useState(false);

    // Modify state
    const [isModifying, setIsModifying] = useState(false);
    const [modifyFields, setModifyFields] = useState({ date: "", adultPax: 0, childPax: 0 });
    const [isSubmittingModify, setIsSubmittingModify] = useState(false);

    // Cancel state
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsVerifying(true);
        try {
            const res = await fetch("/api/bookings/session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ bookingId: bookingRef.trim(), email: email.trim() }),
            });

            if (res.ok) {
                const data = await res.json();
                setSession(data);
                setEditFields({
                    pickupLocation: data.booking.pickupLocation || "",
                    notes: data.booking.notes || "",
                    customerPhone: data.booking.customerPhone || "",
                });
                toast({ title: "Booking Found", description: "You can now view and manage your booking." });
            } else {
                const err = await res.json();
                toast({
                    title: "Verification Failed",
                    description: err.error || "Could not find your booking. Please check your details.",
                    variant: "destructive",
                });
            }
        } catch {
            toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
        } finally {
            setIsVerifying(false);
        }
    };

    const refreshBooking = async () => {
        try {
            const res = await fetch("/api/bookings/session/current", { credentials: "include" });
            if (res.ok) {
                const data = await res.json();
                setSession(data);
                setEditFields({
                    pickupLocation: data.booking.pickupLocation || "",
                    notes: data.booking.notes || "",
                    customerPhone: data.booking.customerPhone || "",
                });
            }
        } catch { /* silently fail */ }
    };

    const handleSaveDetails = async () => {
        setIsSaving(true);
        try {
            const res = await fetch("/api/bookings/session/update", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(editFields),
            });

            if (res.ok) {
                toast({ title: "Saved", description: "Your booking details have been updated." });
                setIsEditing(false);
                await refreshBooking();
            } else {
                const err = await res.json();
                toast({ title: "Error", description: err.error || "Failed to save.", variant: "destructive" });
            }
        } catch {
            toast({ title: "Error", description: "Failed to save changes.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleModify = async () => {
        setIsSubmittingModify(true);
        try {
            const payload: any = {};
            if (modifyFields.date) payload.date = modifyFields.date;
            if (modifyFields.adultPax > 0) payload.adultPax = modifyFields.adultPax;
            if (modifyFields.childPax >= 0 && isModifying) payload.childPax = modifyFields.childPax;

            const res = await fetch("/api/bookings/session/modify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (res.ok) {
                if (data.requiresAdditionalPayment) {
                    toast({
                        title: "Additional Payment Required",
                        description: data.message,
                    });
                } else if (data.creditPending) {
                    toast({
                        title: "Credit Pending",
                        description: data.message,
                    });
                } else if (data.changed) {
                    toast({ title: "Booking Updated", description: data.message || "Changes applied successfully." });
                } else {
                    toast({ title: "No Changes", description: "Nothing was changed." });
                }
                setIsModifying(false);
                await refreshBooking();
            } else {
                toast({
                    title: "Modification Failed",
                    description: data.error || data.availabilityMessage || "Could not apply changes.",
                    variant: "destructive",
                });
            }
        } catch {
            toast({ title: "Error", description: "Failed to submit modification.", variant: "destructive" });
        } finally {
            setIsSubmittingModify(false);
        }
    };

    const handleCancel = async () => {
        if (!session) return;
        setIsCancelling(true);
        try {
            const res = await fetch(`/api/bookings/${session.booking.id}/cancel`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ type: "email", value: email }),
            });

            if (res.ok) {
                toast({ title: "Booking Cancelled", description: "Your booking has been cancelled." });
                setCancelDialogOpen(false);
                await refreshBooking();
            } else {
                const err = await res.json();
                toast({ title: "Error", description: err.error || "Could not cancel.", variant: "destructive" });
            }
        } catch {
            toast({ title: "Error", description: "Failed to cancel booking.", variant: "destructive" });
        } finally {
            setIsCancelling(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
            pending: { variant: "secondary", icon: <AlertCircle className="h-3 w-3" /> },
            confirmed: { variant: "default", icon: <CheckCircle className="h-3 w-3" /> },
            completed: { variant: "outline", icon: <CheckCircle className="h-3 w-3" /> },
            cancelled: { variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
        };
        const c = config[status] || config.pending;
        return <Badge variant={c.variant} className="gap-1 capitalize">{c.icon} {status}</Badge>;
    };

    // ─── Lookup Form (before verification) ─────────────────────────────
    if (!session) {
        return (
            <Layout>
                <div className="bg-muted/30 min-h-screen pt-40 md:pt-44 pb-20">
                    <div className="container mx-auto px-4 flex justify-center">
                        <Card className="w-full max-w-md shadow-xl">
                            <CardHeader className="text-center">
                                <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Search className="h-6 w-6 text-primary" />
                                </div>
                                <CardTitle className="text-2xl font-serif">Manage Your Booking</CardTitle>
                                <CardDescription>
                                    Enter your booking reference and email to view and manage your reservation.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleVerify} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="bookingRef">Booking Reference</Label>
                                        <Input
                                            id="bookingRef"
                                            placeholder="e.g. a1b2c3d4-..."
                                            required
                                            value={bookingRef}
                                            onChange={(e) => setBookingRef(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="email">Email Address</Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="name@example.com"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                        />
                                    </div>
                                    <Button type="submit" className="w-full font-semibold" disabled={isVerifying}>
                                        {isVerifying ? (
                                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</>
                                        ) : (
                                            <><Search className="mr-2 h-4 w-4" /> Find My Booking</>
                                        )}
                                    </Button>
                                </form>
                                <div className="mt-6 text-center text-sm text-muted-foreground">
                                    <Link href="/" className="hover:underline">← Back to Home</Link>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </Layout>
        );
    }

    // ─── Booking Dashboard (after verification) ────────────────────────
    const { booking, items, payments } = session;

    return (
        <Layout>
            <div className="bg-muted/30 min-h-screen pt-40 md:pt-44 pb-20">
                <div className="container mx-auto px-4 max-w-3xl">

                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-serif font-bold">Your Booking</h1>
                            <p className="text-muted-foreground text-sm mt-1">
                                Ref: <span className="font-mono">{booking.id.slice(0, 8).toUpperCase()}</span>
                            </p>
                        </div>
                        {getStatusBadge(booking.status)}
                    </div>

                    {/* Booking Summary */}
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <CalendarDays className="h-5 w-5" /> Booking Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-muted-foreground">Tour / Service</p>
                                        <p className="font-medium">{booking.tourName}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">Date</p>
                                        <p className="font-medium">
                                            {(() => { try { return format(new Date(booking.date), "EEEE, MMMM d, yyyy"); } catch { return booking.date; } })()}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">Guests</p>
                                        <p className="font-medium">
                                            {booking.adultPaxTotal} Adult{booking.adultPaxTotal !== 1 ? "s" : ""}
                                            {booking.childPaxTotal > 0 && `, ${booking.childPaxTotal} Child${booking.childPaxTotal !== 1 ? "ren" : ""}`}
                                        </p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-muted-foreground">Customer</p>
                                        <p className="font-medium">{booking.customerName}</p>
                                        <p className="text-xs text-muted-foreground">{booking.customerEmail}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">Total Amount</p>
                                        <p className="font-medium text-lg">
                                            {(booking.totalAmountCents || 0).toLocaleString()} {booking.currency || "VUV"}
                                        </p>
                                    </div>
                                    {booking.pickupLocation && (
                                        <div>
                                            <p className="text-muted-foreground">Pickup Location</p>
                                            <p className="font-medium">{booking.pickupLocation}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Items */}
                            {items.length > 0 && (
                                <>
                                    <Separator className="my-4" />
                                    <h4 className="text-sm font-semibold mb-2">Items</h4>
                                    <div className="space-y-2">
                                        {items.map((item: any) => (
                                            <div key={item.id} className="flex justify-between text-sm">
                                                <span>{item.productName} ({item.adultPax}A + {item.childPax}C)</span>
                                                <span className="font-medium">{item.subtotalCents?.toLocaleString()} VUV</span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Payments */}
                    {payments.length > 0 && (
                        <Card className="mb-6">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <CreditCard className="h-5 w-5" /> Payments
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {payments.map((p: any) => (
                                        <div key={p.id} className="flex justify-between items-center text-sm border-b pb-2 last:border-0">
                                            <div>
                                                <p className="font-medium">{p.amount?.toLocaleString()} {p.currency}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {(() => { try { return format(new Date(p.createdAt), "MMM d, yyyy"); } catch { return ""; } })()}
                                                </p>
                                            </div>
                                            {getStatusBadge(p.status)}
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Edit Details (safe updates) */}
                    {booking.status !== "cancelled" && booking.status !== "completed" && (
                        <Card className="mb-6">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <Edit3 className="h-5 w-5" /> Contact & Details
                                    </CardTitle>
                                    {!isEditing && (
                                        <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                                            Edit
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                {isEditing ? (
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="phone"><Phone className="inline h-3 w-3 mr-1" />Phone</Label>
                                            <Input
                                                id="phone"
                                                value={editFields.customerPhone}
                                                onChange={(e) => setEditFields(f => ({ ...f, customerPhone: e.target.value }))}
                                                placeholder="+678 ..."
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="pickup"><MapPin className="inline h-3 w-3 mr-1" />Pickup Location</Label>
                                            <Input
                                                id="pickup"
                                                value={editFields.pickupLocation}
                                                onChange={(e) => setEditFields(f => ({ ...f, pickupLocation: e.target.value }))}
                                                placeholder="Hotel name or address"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="notes"><FileText className="inline h-3 w-3 mr-1" />Special Requests / Notes</Label>
                                            <Textarea
                                                id="notes"
                                                value={editFields.notes}
                                                onChange={(e) => setEditFields(f => ({ ...f, notes: e.target.value }))}
                                                placeholder="Any special requests..."
                                                rows={3}
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <Button onClick={handleSaveDetails} disabled={isSaving}>
                                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                                Save Changes
                                            </Button>
                                            <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2 text-sm">
                                        <div className="flex items-center gap-2">
                                            <Phone className="h-4 w-4 text-muted-foreground" />
                                            <span>{booking.customerPhone || "No phone on file"}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <MapPin className="h-4 w-4 text-muted-foreground" />
                                            <span>{booking.pickupLocation || "No pickup location set"}</span>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                                            <span>{booking.notes || "No special requests"}</span>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Request Modification (date/pax) */}
                    {(booking.status === "pending" || booking.status === "confirmed") && (
                        <Card className="mb-6">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <Users className="h-5 w-5" /> Request Changes
                                    </CardTitle>
                                    {!isModifying && (
                                        <Button variant="outline" size="sm" onClick={() => {
                                            setModifyFields({
                                                date: booking.date,
                                                adultPax: booking.adultPaxTotal,
                                                childPax: booking.childPaxTotal,
                                            });
                                            setIsModifying(true);
                                        }}>
                                            Modify
                                        </Button>
                                    )}
                                </div>
                                <CardDescription>
                                    Change your travel date or number of guests. Price differences will be calculated.
                                </CardDescription>
                            </CardHeader>
                            {isModifying && (
                                <CardContent>
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="modDate">New Date</Label>
                                            <Input
                                                id="modDate"
                                                type="date"
                                                value={modifyFields.date}
                                                onChange={(e) => setModifyFields(f => ({ ...f, date: e.target.value }))}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="modAdults">Adults</Label>
                                                <Input
                                                    id="modAdults"
                                                    type="number"
                                                    min={1}
                                                    value={modifyFields.adultPax}
                                                    onChange={(e) => setModifyFields(f => ({ ...f, adultPax: parseInt(e.target.value) || 0 }))}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="modChildren">Children</Label>
                                                <Input
                                                    id="modChildren"
                                                    type="number"
                                                    min={0}
                                                    value={modifyFields.childPax}
                                                    onChange={(e) => setModifyFields(f => ({ ...f, childPax: parseInt(e.target.value) || 0 }))}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button onClick={handleModify} disabled={isSubmittingModify}>
                                                {isSubmittingModify ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                                Check & Apply Changes
                                            </Button>
                                            <Button variant="outline" onClick={() => setIsModifying(false)}>Cancel</Button>
                                        </div>
                                    </div>
                                </CardContent>
                            )}
                        </Card>
                    )}

                    {/* Cancel Booking */}
                    {booking.status === "pending" && (
                        <Card className="border-destructive/30">
                            <CardContent className="pt-6 flex items-center justify-between">
                                <div>
                                    <p className="font-medium flex items-center gap-2"><Ban className="h-4 w-4" /> Cancel Booking</p>
                                    <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
                                </div>
                                <Button variant="destructive" size="sm" onClick={() => setCancelDialogOpen(true)}>
                                    Cancel Booking
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {/* Back to lookup */}
                    <div className="mt-8 text-center">
                        <Button variant="ghost" onClick={() => { setSession(null); setBookingRef(""); setEmail(""); }}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Look Up Another Booking
                        </Button>
                    </div>
                </div>
            </div>

            {/* Cancel Confirmation Dialog */}
            <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cancel Your Booking?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to cancel booking #{booking.id.slice(0, 8).toUpperCase()}?
                            This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>Keep Booking</Button>
                        <Button variant="destructive" onClick={handleCancel} disabled={isCancelling}>
                            {isCancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Confirm Cancellation
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Layout>
    );
}
