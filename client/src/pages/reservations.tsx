import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useCart } from "@/lib/cart-context";
import { Car, PlusCircle, LogIn, UserPlus, Globe, ShoppingCart, Search, Eraser, ArrowLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { BookingModal } from "@/components/booking-modal";

export default function Reservations() {
  const { itemCount } = useCart();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [confirmationNumber, setConfirmationNumber] = useState("");
  const [verificationValue, setVerificationValue] = useState("");
  const [verificationType, setVerificationType] = useState("");

  const handleSearch = () => {
    if (!confirmationNumber || !verificationValue || !verificationType) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields to search for your reservation.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Search Initiated",
      description: `Searching for reservation #${confirmationNumber}...`,
    });
    // In a real app, this would call an API
  };

  const handleClear = () => {
    setConfirmationNumber("");
    setVerificationValue("");
    setVerificationType("");
    toast({
      description: "Search fields cleared.",
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans text-foreground">
      {/* Reservation Header / Sub-Nav */}
      <header className="bg-primary text-white shadow-md">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
             <div className="flex items-center gap-2">
               <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white" onClick={() => setLocation("/")}>
                 GO
               </Button>
               
               <div className="flex items-center bg-white/10 rounded-md p-1">
                  <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 hover:text-white bg-white/20 gap-2 font-medium">
                    <Car className="h-4 w-4" /> My reservations
                  </Button>
               </div>
             </div>

             <div className="flex items-center gap-4 text-sm">
               <Link href="/login">
                 <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 hover:text-white gap-2">
                   <LogIn className="h-4 w-4" /> Login
                 </Button>
               </Link>
               <Link href="/register">
                 <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 hover:text-white gap-2">
                   <UserPlus className="h-4 w-4" /> Register
                 </Button>
               </Link>
               
               <div className="h-4 w-px bg-white/30 mx-2"></div>
               
               <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 hover:text-white gap-2">
                 <img src="https://flagcdn.com/w20/us.png" alt="US Flag" className="h-3 w-auto" /> English
               </Button>
               
               <Link href="/cart">
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 hover:text-white gap-2 relative">
                  <ShoppingCart className="h-4 w-4" /> Cart {itemCount}
                </Button>
               </Link>
             </div>
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-[#004165] mb-2">Manage Reservations</h1>
          <div className="h-1 w-16 bg-primary mx-auto rounded-full"></div>
        </div>

        <Card className="max-w-5xl mx-auto border-none shadow-lg overflow-hidden">
          <div className="bg-primary p-4 flex justify-between items-center">
            <BookingModal trigger={
              <Button variant="ghost" className="text-white hover:bg-white/20 hover:text-white gap-2">
                <PlusCircle className="h-4 w-4" /> Book a New Reservation
              </Button>
            } />
            <Link href="/tours">
              <Button className="bg-[#22c55e] hover:bg-[#16a34a] text-white font-semibold shadow-sm gap-2">
                <ArrowLeft className="h-4 w-4" /> Continue booking
              </Button>
            </Link>
          </div>
          
          <CardContent className="p-8">
             <h2 className="font-bold text-lg mb-6">
               Enter your reservation confirmation. In order to verify your reservation, please select a verification type and enter the corresponding information.
             </h2>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
               <div className="space-y-2">
                 <label className="text-sm font-bold">Confirmation number</label>
                 <Input 
                   placeholder="Confirmation number" 
                   className="h-12" 
                   value={confirmationNumber}
                   onChange={(e) => setConfirmationNumber(e.target.value)}
                 />
               </div>
               
               <div className="space-y-2">
                 <label className="text-sm font-bold">Verification type</label>
                 <Select value={verificationType} onValueChange={setVerificationType}>
                   <SelectTrigger className="h-12">
                     <SelectValue placeholder="Verification type" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="email">Email Address</SelectItem>
                     <SelectItem value="phone">Phone Number</SelectItem>
                     <SelectItem value="lastname">Last Name</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
               
               <div className="space-y-2">
                 <label className="text-sm font-bold">Verification</label>
                 <Input 
                   placeholder="Verification" 
                   className="h-12" 
                   value={verificationValue}
                   onChange={(e) => setVerificationValue(e.target.value)}
                 />
               </div>
             </div>

             <div className="flex gap-4">
               <Button 
                 className="h-12 px-8 text-base bg-white border-2 border-[#004165] text-[#004165] hover:bg-[#004165] hover:text-white transition-colors gap-2"
                 onClick={handleSearch}
               >
                 <Search className="h-4 w-4" /> Search
               </Button>
               <Button 
                 variant="outline" 
                 className="h-12 px-8 text-base border-destructive text-destructive hover:bg-destructive hover:text-white transition-colors gap-2"
                 onClick={handleClear}
               >
                 <Eraser className="h-4 w-4" /> Clear Search
               </Button>
             </div>
          </CardContent>
        </Card>
      </main>
      
      {/* Simple Footer for this page */}
      <footer className="bg-[#291B12] text-white py-6 text-center text-sm opacity-90">
         <p>&copy; {new Date().getFullYear()} Ace Tours & Transfers Vanuatu. All rights reserved.</p>
      </footer>
    </div>
  );
}
