
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { CalendarIcon, ArrowRightLeft, MapPin, Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { tours } from "@/lib/data";

// Mock Vanuatu Bank Logos for the widget footer
const PaymentIcons = () => (
  <div className="flex items-center gap-3 opacity-70 grayscale hover:grayscale-0 transition-all mt-4 justify-center">
    <div className="flex flex-col items-center">
      <ShieldCheck className="h-5 w-5 text-green-600 mb-1" />
      <span className="text-[10px] font-bold text-foreground/60">SECURE PAY</span>
    </div>
    <div className="h-4 border-r border-border mx-2"></div>
    <div className="font-bold text-xs text-[#0054A6]">BRED Bank</div>
    <div className="font-bold text-xs text-[#0075BF]">NBV</div>
    <div className="font-bold text-xs text-[#004165]">ANZ</div>
  </div>
);

export function BookingWidget() {
  const [date, setDate] = useState<Date>();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleCheckRates = async () => {
    setIsLoading(true);
    // Simulate checking availability
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsLoading(false);
    
    toast({
      title: "Rates Available!",
      description: "We found some great options for your dates. (Mockup Mode)",
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-2xl overflow-hidden max-w-md w-full border border-border/50 relative z-20">
      <Tabs defaultValue="round-trip" className="w-full">
        <TabsList className="w-full grid grid-cols-3 h-14 rounded-none bg-muted/50 p-0">
          <TabsTrigger 
            value="round-trip" 
            className="rounded-none data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:border-t-2 data-[state=active]:border-primary font-medium h-full"
          >
            Round Trip
          </TabsTrigger>
          <TabsTrigger 
            value="one-way" 
            className="rounded-none data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:border-t-2 data-[state=active]:border-primary font-medium h-full"
          >
            One Way
          </TabsTrigger>
          <TabsTrigger 
            value="tours" 
            className="rounded-none data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:border-t-2 data-[state=active]:border-primary font-medium h-full"
          >
            Tours
          </TabsTrigger>
        </TabsList>

        <div className="p-6 space-y-4 bg-white">
          <TabsContent value="round-trip" className="mt-0 space-y-4">
            <div className="space-y-4 relative">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider ml-1">Start Here</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Enter pickup location" className="pl-10 h-12 bg-muted/20 border-muted focus:border-primary/50 transition-colors" />
                </div>
              </div>

              <div className="absolute top-[38px] right-4 z-10 bg-white rounded-full p-1.5 shadow-md border border-border cursor-pointer hover:bg-muted transition-colors">
                <ArrowRightLeft className="h-4 w-4 text-primary rotate-90" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider ml-1">End Here</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Enter destination" className="pl-10 h-12 bg-muted/20 border-muted focus:border-primary/50 transition-colors" />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="one-way" className="mt-0 space-y-4">
             <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider ml-1">Pickup Location</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Enter pickup location" className="pl-10 h-12 bg-muted/20 border-muted focus:border-primary/50 transition-colors" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider ml-1">Dropoff Location</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Enter destination" className="pl-10 h-12 bg-muted/20 border-muted focus:border-primary/50 transition-colors" />
                </div>
              </div>
          </TabsContent>

          <TabsContent value="tours" className="mt-0 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider ml-1">Select Experience</label>
              <Select>
                <SelectTrigger className="h-12 bg-muted/20 border-muted focus:ring-primary/20">
                  <SelectValue placeholder="Choose a tour..." />
                </SelectTrigger>
                <SelectContent>
                  {tours.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
               <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider ml-1">Guests</label>
               <Input type="number" min="1" defaultValue="2" className="h-12 bg-muted/20 border-muted" />
            </div>
          </TabsContent>

          {/* Date Selection - Common to all tabs */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider ml-1">When?</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full h-12 justify-start text-left font-normal bg-muted/20 border-muted hover:bg-muted/30 hover:text-foreground",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <Button 
            className="w-full h-14 text-lg font-bold shadow-lg mt-2 bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={handleCheckRates}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Checking Availability...
              </>
            ) : (
              "Check Rates & Availability"
            )}
          </Button>

          <div className="text-center">
             <p className="text-[10px] text-muted-foreground mb-2">Secure payments powered by local Vanuatu banks</p>
             <PaymentIcons />
          </div>
        </div>
      </Tabs>
    </div>
  );
}
