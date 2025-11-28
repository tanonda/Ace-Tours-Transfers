import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useCart } from "@/lib/cart-context";
import { Car, PlusCircle, LogIn, UserPlus, Globe, ShoppingCart, Search, Eraser, ArrowLeft, CalendarIcon, Loader2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { tours, transfers } from "@/lib/data";

const bookingFormSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  service: z.string().min(1, "Please select a service"),
  date: z.date({ required_error: "Date is required" }),
  guests: z.string().min(1, "Number of guests is required"),
  notes: z.string().optional(),
});

export default function Reservations() {
  const { itemCount } = useCart();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"my-reservations" | "book-new">("my-reservations");
  
  // State for My Reservations search
  const [confirmationNumber, setConfirmationNumber] = useState("");
  const [verificationValue, setVerificationValue] = useState("");
  const [verificationType, setVerificationType] = useState("");

  // State for Booking Form
  const [isBookingLoading, setIsBookingLoading] = useState(false);

  const bookingForm = useForm<z.infer<typeof bookingFormSchema>>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      name: "",
      email: "",
      service: "",
      guests: "2",
      notes: "",
    },
  });

  async function onBookingSubmit(values: z.infer<typeof bookingFormSchema>) {
    setIsBookingLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    console.log(values);
    setIsBookingLoading(false);
    bookingForm.reset();
    
    // Redirect to ANZ eGate payment page
    setLocation("/payment");
  }

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
      <main className="flex-grow container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-[#004165] mb-2">Manage Reservations</h1>
          <div className="h-1 w-16 bg-primary mx-auto rounded-full"></div>
        </div>

        <Card className="max-w-5xl mx-auto border-none shadow-lg overflow-hidden">
          <div className="bg-primary p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                 <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white" onClick={() => setLocation("/")}>
                   GO
                 </Button>
                 
                 <div className="flex items-center bg-white/10 rounded-md p-1">
                    <Button 
                      variant={activeTab === "my-reservations" ? "secondary" : "ghost"} 
                      size="sm" 
                      className={activeTab === "my-reservations" ? "text-primary bg-white hover:bg-white/90 gap-2 font-medium" : "text-white hover:bg-white/20 hover:text-white gap-2 font-medium"}
                      onClick={() => setActiveTab("my-reservations")}
                    >
                      <Car className="h-4 w-4" /> My reservations
                    </Button>
                    <Button 
                      variant={activeTab === "book-new" ? "secondary" : "ghost"} 
                      size="sm" 
                      className={activeTab === "book-new" ? "text-primary bg-white hover:bg-white/90 gap-2" : "text-white hover:bg-white/20 hover:text-white gap-2"}
                      onClick={() => setActiveTab("book-new")}
                    >
                      <PlusCircle className="h-4 w-4" /> Book a New Reservation
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
                 
                 <div className="h-4 w-px bg-white/30 mx-2"></div>

                 <Link href="/tours">
                  <Button className="bg-[#22c55e] hover:bg-[#16a34a] text-white font-semibold shadow-sm gap-2">
                    <ArrowLeft className="h-4 w-4" /> Continue booking
                  </Button>
                 </Link>
              </div>
            </div>
          </div>
          
          <CardContent className="p-8">
             {activeTab === "my-reservations" ? (
               <>
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
               </>
             ) : (
               <div className="max-w-2xl mx-auto">
                  <h2 className="font-serif text-2xl text-center mb-6 font-bold text-[#004165]">Plan Your Adventure</h2>
                  <Form {...bookingForm}>
                    <form onSubmit={bookingForm.handleSubmit(onBookingSubmit)} className="space-y-4">
                      <FormField
                        control={bookingForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name</FormLabel>
                            <FormControl>
                              <Input placeholder="John Doe" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={bookingForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input placeholder="john@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={bookingForm.control}
                          name="service"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Service</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select tour/transfer" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="select" disabled>Select an option</SelectItem>
                                  {tours.map((t: any) => (
                                    <SelectItem key={t.id} value={t.title}>{t.title}</SelectItem>
                                  ))}
                                  {transfers.map((t: any) => (
                                    <SelectItem key={t.id} value={t.title}>{t.title}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={bookingForm.control}
                          name="guests"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Guests</FormLabel>
                              <FormControl>
                                <Input type="number" min="1" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={bookingForm.control}
                        name="date"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Preferred Date</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={"outline"}
                                    className={cn(
                                      "w-full pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    {field.value ? (
                                      format(field.value, "PPP")
                                    ) : (
                                      <span>Pick a date</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled={(date) =>
                                    date < new Date() || date < new Date("1900-01-01")
                                  }
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button type="submit" className="w-full text-lg py-6 bg-[#004165] hover:bg-[#003150]" disabled={isBookingLoading}>
                        {isBookingLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Submit Request"}
                      </Button>
                    </form>
                  </Form>
               </div>
             )}
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