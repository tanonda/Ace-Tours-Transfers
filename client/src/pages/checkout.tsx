import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ArrowRight, User, Phone, MapPin, MessageSquare, ShieldCheck, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatPriceDisplay } from "@/lib/product.types";
import { useCurrency } from "@/lib/currency-context";

export default function Checkout() {
    const [, setLocation] = useLocation();
    const { items, total } = useCart();
    const { user, isAuthenticated } = useAuth();
    const { toast } = useToast();
    const { currency } = useCurrency();

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        pickupLocation: "",
        notes: ""
    });

    // Pre-fill user data if logged in, or load from session storage if returning
    useEffect(() => {
        if (items.length === 0) {
            setLocation("/cart");
            return;
        }

        const savedDetails = sessionStorage.getItem("checkout_details");
        if (savedDetails) {
            try {
                setFormData(JSON.parse(savedDetails));
            } catch (e) {
                console.error("Failed to parse saved checkout details", e);
            }
        } else if (isAuthenticated && user) {
            setFormData(prev => ({
                ...prev,
                name: user.name || "",
                email: user.email || "",
                phone: user.phone || ""
            }));
        }
    }, [isAuthenticated, user, items.length, setLocation]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [id]: value
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Basic validation
        if (!formData.name.trim() || !formData.email.trim() || !formData.phone.trim()) {
            toast({
                title: "Required Fields Missing",
                description: "Please provide your name, email, and phone number.",
                variant: "destructive"
            });
            return;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            toast({
                title: "Invalid Email",
                description: "Please provide a valid email address.",
                variant: "destructive"
            });
            return;
        }

        // Save to session storage
        sessionStorage.setItem("checkout_details", JSON.stringify(formData));

        // Proceed to payment
        setLocation("/payment");
    };

    if (items.length === 0) return null; // handled by useEffect redirect

    return (
        <Layout>
            <div className="min-h-screen pt-36 md:pt-40 pb-16 relative overflow-hidden bg-muted/10">
                <div className="container mx-auto px-4 relative z-10">

                    <div className="max-w-3xl mx-auto mb-6">
                        <Button variant="ghost" onClick={() => setLocation("/cart")} className="mb-4 -ml-2 text-muted-foreground hover:text-foreground">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Cart
                        </Button>

                        {/* Ace Tours Brand Identity */}
                        <div className="flex items-center justify-center gap-3 mb-5">
                            <img src="/assets/logo.png" alt="Ace Tours & Transfers" className="h-10 w-10 rounded-full border border-[#f4a830]/30" />
                            <div className="text-center">
                                <p className="text-sm font-semibold text-[#f4a830] tracking-wide">Ace Tours & Transfers</p>
                                <p className="text-[10px] text-muted-foreground">Vanuatu</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-xl bg-primary/10">
                                <User className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold font-serif">Contact & Booking Details</h1>
                                <p className="text-sm text-muted-foreground">We need a few details to confirm your booking.</p>
                            </div>
                        </div>

                        {/* Progress indicator */}
                        <div className="flex items-center gap-2 text-xs font-medium mt-6 mb-8 px-2 max-w-sm">
                            <span className="text-primary cursor-pointer hover:underline" onClick={() => setLocation("/cart")}>Cart</span>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-foreground">Details</span>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-muted-foreground">Payment</span>
                        </div>
                    </div>

                    <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">

                        <div className="md:col-span-2 space-y-6">
                            <form id="checkout-form" onSubmit={handleSubmit}>

                                <Card className="border-border/50 shadow-sm overflow-hidden mb-6">
                                    <div className="h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/50" />
                                    <CardHeader className="pb-4">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <User className="h-4 w-4 text-primary" /> Primary Contact
                                        </CardTitle>
                                        <CardDescription>This information is used for booking confirmation and updates.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="name" className="flex items-baseline gap-1">
                                                    Full Name <span className="text-destructive">*</span>
                                                </Label>
                                                <div className="relative">
                                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                    <Input
                                                        id="name"
                                                        placeholder="John Doe"
                                                        className="pl-9"
                                                        value={formData.name}
                                                        onChange={handleChange}
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="email" className="flex items-baseline gap-1">
                                                    Email Address <span className="text-destructive">*</span>
                                                </Label>
                                                <div className="relative">
                                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                    <Input
                                                        id="email"
                                                        type="email"
                                                        placeholder="john@example.com"
                                                        className="pl-9"
                                                        value={formData.email}
                                                        onChange={handleChange}
                                                        required
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="phone" className="flex items-baseline gap-1">
                                                Phone Number <span className="text-destructive">*</span>
                                            </Label>
                                            <div className="relative">
                                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    id="phone"
                                                    type="tel"
                                                    placeholder="+678 1234567"
                                                    className="pl-9"
                                                    value={formData.phone}
                                                    onChange={handleChange}
                                                    required
                                                />
                                            </div>
                                            <p className="text-[0.7rem] text-muted-foreground">Required for coordinate pickups or last-minute changes (WhatsApp preferred).</p>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="border-border/50 shadow-sm overflow-hidden mb-6">
                                    <CardHeader className="pb-4">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <MapPin className="h-4 w-4 text-primary" /> Trip Logistics
                                        </CardTitle>
                                        <CardDescription>Tell us where to meet you and any special requirements.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="pickupLocation">Pickup Location / Hotel / Flight Info</Label>
                                            <div className="relative">
                                                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                <Textarea
                                                    id="pickupLocation"
                                                    placeholder="e.g. Holiday Inn Resort, Room 104 OR Flight NF10 arriving at 2:30 PM"
                                                    className="pl-9 min-h-[80px]"
                                                    value={formData.pickupLocation}
                                                    onChange={handleChange}
                                                />
                                            </div>
                                            <p className="text-[0.7rem] text-muted-foreground">Even if you don't know yet, you can let us know later.</p>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="notes">Special Requests / Notes</Label>
                                            <div className="relative">
                                                <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                <Textarea
                                                    id="notes"
                                                    placeholder="Dietary requirements, accessibility needs, celebrating a special occasion, etc."
                                                    className="pl-9 min-h-[80px]"
                                                    value={formData.notes}
                                                    onChange={handleChange}
                                                />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Mobile submit button (shown early on mobile screens) */}
                                <div className="md:hidden mb-8">
                                    <Button type="submit" size="lg" className="w-full text-base font-bold shadow-lg">
                                        Continue to Payment <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </div>

                            </form>
                        </div>

                        {/* Sidebar Summary */}
                        <div className="md:col-span-1">
                            <div className="sticky top-24">
                                <Card className="border-border/50 shadow-sm bg-card/80 backdrop-blur-sm">
                                    <CardHeader className="pb-3 bg-muted/30">
                                        <CardTitle className="text-base font-bold">Order Summary</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-4 space-y-3">
                                        <div className="flex justify-between items-baseline mb-2">
                                            <span className="text-sm text-muted-foreground">{items.length} item{items.length !== 1 ? 's' : ''}</span>
                                            <span className="text-xl font-bold">{formatPriceDisplay(total, currency)}</span>
                                        </div>

                                        <ul className="space-y-2 text-sm">
                                            {items.map(item => (
                                                <li key={item.cartItemId} className="flex justify-between gap-2 border-t border-border/30 pt-2">
                                                    <span className="truncate text-muted-foreground text-xs">{item.title}</span>
                                                    <span className="font-semibold text-xs whitespace-nowrap">
                                                        {formatPriceDisplay((item.price * item.adultPax) + (item.childPrice * item.childPax) + (item.addonTotal || 0), currency)}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                    <CardFooter className="flex-col gap-3 pt-4 border-t border-border/50 bg-muted/10">
                                        {/* Desktop submit button */}
                                        <Button
                                            form="checkout-form"
                                            type="submit"
                                            className="w-full py-6 text-base font-bold hidden md:flex shadow-md hover:shadow-lg transition-all"
                                        >
                                            Step 2: Payment <ArrowRight className="ml-2 h-4 w-4" />
                                        </Button>

                                        <div className="flex items-center justify-center gap-1.5 text-[0.65rem] text-muted-foreground w-full">
                                            <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                                            <span>Your personal information is secure</span>
                                        </div>
                                    </CardFooter>
                                </Card>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </Layout>
    );
}
