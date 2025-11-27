
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, CreditCard, Building } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { tours, transfers } from "@/lib/data";

const formSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  service: z.string().min(1, "Please select a service"),
  date: z.date({ required_error: "Date is required" }),
  guests: z.string().min(1, "Number of guests is required"),
  notes: z.string().optional(),
});

export function BookingModal({ trigger, preselectedService }: { trigger: React.ReactNode; preselectedService?: string }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      service: preselectedService || "",
      guests: "2",
      notes: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    // Simulate API call / transition to payment
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    console.log(values);
    setIsLoading(false);
    setShowPayment(true);
  }

  const handlePayment = async () => {
     setIsLoading(true);
     await new Promise((resolve) => setTimeout(resolve, 1500));
     
     toast({
      title: "Booking Confirmed!",
      description: "Thank you for booking with Ace Tours. A confirmation email has been sent.",
    });
    
    setIsLoading(false);
    setShowPayment(false);
    setOpen(false);
    form.reset();
  }

  return (
    <Dialog open={open} onOpenChange={(val) => {
      setOpen(val);
      if (!val) setShowPayment(false);
    }}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl text-center mb-2">
            {showPayment ? "Secure Payment" : "Plan Your Adventure"}
          </DialogTitle>
        </DialogHeader>
        
        {!showPayment ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
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
                control={form.control}
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

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="service"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select service" />
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
                  control={form.control}
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
                control={form.control}
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

              <Button type="submit" className="w-full text-lg py-6" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Continue to Payment"}
              </Button>
            </form>
          </Form>
        ) : (
          <div className="space-y-6">
            <div className="bg-muted/30 p-4 rounded-lg border border-border">
              <p className="text-sm text-muted-foreground mb-2">Order Summary</p>
              <div className="flex justify-between font-bold text-lg">
                <span>Total to Pay</span>
                <span className="text-primary">VT 15,000</span>
              </div>
            </div>

            <div className="space-y-4">
               <h4 className="font-semibold text-sm uppercase text-muted-foreground tracking-wide">Select Payment Method</h4>
               
               <div className="grid grid-cols-1 gap-3">
                 <Button variant="outline" className="h-16 justify-start px-4 relative overflow-hidden border-primary/50 bg-primary/5 hover:bg-primary/10 hover:border-primary" onClick={handlePayment}>
                    <CreditCard className="mr-3 h-5 w-5 text-primary" />
                    <div className="text-left">
                      <div className="font-bold text-foreground">Credit / Debit Card</div>
                      <div className="text-xs text-muted-foreground">Secure payment via BRED Bank Gateway</div>
                    </div>
                 </Button>

                 <Button variant="outline" className="h-16 justify-start px-4 relative overflow-hidden hover:bg-muted/50" onClick={handlePayment}>
                    <Building className="mr-3 h-5 w-5 text-muted-foreground" />
                    <div className="text-left">
                      <div className="font-bold text-foreground">Bank Transfer</div>
                      <div className="text-xs text-muted-foreground">Direct deposit to NBV or ANZ</div>
                    </div>
                 </Button>
               </div>
            </div>

            <div className="flex items-center justify-center gap-4 pt-4 border-t">
               <div className="text-center">
                 <span className="text-[10px] font-bold text-muted-foreground block mb-1">POWERED BY</span>
                 <div className="flex gap-2 grayscale opacity-60">
                   <div className="text-xs font-bold">BRED</div>
                   <div className="text-xs font-bold">NBV</div>
                 </div>
               </div>
            </div>

            <Button variant="ghost" size="sm" onClick={() => setShowPayment(false)} className="w-full text-muted-foreground">
              &larr; Back to Details
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
