import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { fetchBookings, fetchTours } from "@/lib/api";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  MapPin,
  Calendar as CalendarIcon,
  Trash2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock
} from "lucide-react";
import {
  upsertAvailability,
  deleteAvailability,
  fetchTourInstances
} from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  bookings: any[];
}

export default function AdminCalendar() {
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [tourFilter, setTourFilter] = useState('all');
  const [managingTourId, setManagingTourId] = useState<string>("");
  const [dailyInstances, setDailyInstances] = useState<any[]>([]);
  const [isUpserting, setIsUpserting] = useState(false);
  const [todayDialogOpen, setTodayDialogOpen] = useState(false); // F: View All Today
  const [upsertForm, setUpsertForm] = useState({
    timeSlot: "",
    totalCapacity: 20,
    blockedCount: 0
  });

  const loadInstances = async (tourId: string, date: Date) => {
    if (!tourId) return;
    try {
      const instances = await fetchTourInstances(tourId, format(date, "yyyy-MM-dd"));
      setDailyInstances(instances);
    } catch (error) {
      console.error("Failed to fetch instances", error);
    }
  };

  const handleUpsert = async () => {
    if (!selectedDay || !managingTourId) return;
    setIsUpserting(true);
    try {
      await upsertAvailability({
        tourId: managingTourId,
        date: format(selectedDay.date, "yyyy-MM-dd"),
        ...upsertForm
      });
      toast({ title: "Success", description: "Availability updated" });
      loadInstances(managingTourId, selectedDay.date);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsUpserting(false);
    }
  };

  const handleDelete = async (instanceId: string) => {
    if (!managingTourId || !selectedDay) return;
    if (!confirm("Are you sure you want to revert to default availability?")) return;
    try {
      await deleteAvailability(instanceId);
      toast({ title: "Success", description: "Availability reverted" });
      loadInstances(managingTourId, selectedDay.date);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings"],
    queryFn: fetchBookings,
  });

  const { data: tours = [] } = useQuery({
    queryKey: ["tours"],
    queryFn: fetchTours,
  });

  const filteredBookings = useMemo(() => {
    if (tourFilter === 'all') return bookings;
    return bookings.filter(b => b.tourId === tourFilter);
  }, [bookings, tourFilter]);

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDayOfWeek = firstDay.getDay();

    const days: CalendarDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: false,
        bookings: filteredBookings.filter(b => {
          const bookingDate = new Date(b.date);
          return bookingDate.toDateString() === date.toDateString();
        })
      });
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      days.push({
        date,
        isCurrentMonth: true,
        isToday: date.toDateString() === today.toDateString(),
        bookings: filteredBookings.filter(b => {
          const bookingDate = new Date(b.date);
          return bookingDate.toDateString() === date.toDateString();
        })
      });
    }

    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: false,
        bookings: filteredBookings.filter(b => {
          const bookingDate = new Date(b.date);
          return bookingDate.toDateString() === date.toDateString();
        })
      });
    }

    return days;
  }, [currentDate, filteredBookings]);

  const goToPrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getBookingColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-500';
      case 'pending': return 'bg-yellow-500';
      case 'completed': return 'bg-blue-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const todayBookings = bookings.filter(b => {
    const today = new Date();
    const bookingDate = new Date(b.date);
    return bookingDate.toDateString() === today.toDateString();
  });

  const upcomingBookings = bookings
    .filter(b => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const bookingDate = new Date(b.date);
      return bookingDate >= today && b.status !== 'cancelled';
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5);

  return (
    <DashboardLayout type="admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#004165]">Reservations Calendar</h1>
            <p className="text-muted-foreground">
              View and manage all bookings in a calendar view.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={tourFilter} onValueChange={setTourFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-tour-filter">
                <SelectValue placeholder="Filter by tour" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tours</SelectItem>
                {tours.map(tour => (
                  <SelectItem key={tour.id} value={tour.id}>{tour.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={goToToday} data-testid="button-today">
              Today
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={goToPrevMonth} data-testid="button-prev-month">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h2 className="text-xl font-semibold">
                      {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
                    </h2>
                    <Button variant="outline" size="icon" onClick={goToNextMonth} data-testid="button-next-month">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-xs">
                      <div className="w-3 h-3 rounded-full bg-green-500" /> Confirmed
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <div className="w-3 h-3 rounded-full bg-yellow-500" /> Pending
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <div className="w-3 h-3 rounded-full bg-blue-500" /> Completed
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
                  {DAYS.map(day => (
                    <div key={day} className="bg-gray-100 p-2 text-center text-sm font-medium text-gray-600">
                      {day}
                    </div>
                  ))}
                  {calendarDays.map((day, index) => (
                    <Dialog key={index}>
                      <DialogTrigger asChild>
                        <button
                          onClick={() => setSelectedDay(day)}
                          data-testid={`calendar-day-${day.date.getDate()}`}
                          className={`
                            min-h-[100px] p-2 bg-white text-left transition-colors hover:bg-gray-50
                            ${!day.isCurrentMonth ? 'text-gray-400' : ''}
                            ${day.isToday ? 'ring-2 ring-[#004165] ring-inset' : ''}
                          `}
                        >
                          <div className={`
                            w-7 h-7 flex items-center justify-center rounded-full text-sm mb-1
                            ${day.isToday ? 'bg-[#004165] text-white font-bold' : ''}
                          `}>
                            {day.date.getDate()}
                          </div>
                          <div className="space-y-1">
                            {day.bookings.slice(0, 3).map((booking, i) => (
                              <div
                                key={booking.id}
                                className={`
                                  text-xs px-1 py-0.5 rounded truncate text-white
                                  ${getBookingColor(booking.status)}
                                `}
                              >
                                {booking.tourName?.substring(0, 15)}...
                              </div>
                            ))}
                            {day.bookings.length > 3 && (
                              <div className="text-xs text-gray-500 pl-1">
                                +{day.bookings.length - 3} more
                              </div>
                            )}
                          </div>
                        </button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>
                            {day.date.toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </DialogTitle>
                          <DialogDescription>
                            {day.bookings.length} booking(s) on this day
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3 max-h-[400px] overflow-y-auto">
                          {day.bookings.length > 0 ? (
                            day.bookings.map(booking => (
                              <div
                                key={booking.id}
                                className="p-4 border rounded-lg space-y-2"
                              >
                                <div className="flex items-center justify-between">
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
                                <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                                  <div className="flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    {booking.customerName}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    {booking.guests} guests
                                  </div>
                                </div>
                                <div className="text-sm font-medium text-[#004165]">
                                  {booking.amount}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-8 text-muted-foreground">
                              No bookings for this day
                            </div>
                          )}
                        </div>

                        <div className="mt-6 pt-6 border-t space-y-4">
                          <h3 className="font-bold text-lg flex items-center gap-2">
                            <RefreshCw className="h-5 w-5 text-primary" />
                            Manage Availability
                          </h3>

                          <div className="space-y-3">
                            <Label>Select Product to Manage</Label>
                            <Select
                              value={managingTourId || ''}
                              onValueChange={(val) => {
                                setManagingTourId(val);
                                loadInstances(val, day.date);
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Choose a product" />
                              </SelectTrigger>
                              <SelectContent>
                                {tours.map(t => (
                                  <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {managingTourId && (
                            <div className="space-y-4">
                              <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                                <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Current Config</h4>
                                {dailyInstances.length > 0 ? (
                                  dailyInstances.map(inst => (
                                    <div key={inst.id} className="flex items-center justify-between bg-background p-2 rounded border border-border shadow-sm">
                                      <div className="text-sm">
                                        <span className="font-bold">{inst.timeSlot || "Default Slot"}</span>: {inst.totalCapacity - inst.blockedCount} available
                                        <span className="text-muted-foreground ml-2">(Cap: {inst.totalCapacity}, Blocked: {inst.blockedCount})</span>
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => handleDelete(inst.id)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-xs text-muted-foreground italic">Using default product capacity for this day.</p>
                                )}
                              </div>

                              <div className="border rounded-lg p-4 space-y-3 bg-primary/5">
                                <h4 className="text-sm font-bold">Add / Update Override</h4>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Time Slot (optional)</Label>
                                    <Input
                                      placeholder="e.g. 09:00"
                                      value={upsertForm.timeSlot}
                                      onChange={(e) => setUpsertForm(prev => ({ ...prev, timeSlot: e.target.value }))}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Total Capacity</Label>
                                    <Input
                                      type="number"
                                      value={upsertForm.totalCapacity}
                                      onChange={(e) => setUpsertForm(prev => ({ ...prev, totalCapacity: parseInt(e.target.value) || 0 }))}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Blocked Seats</Label>
                                    <Input
                                      type="number"
                                      value={upsertForm.blockedCount}
                                      onChange={(e) => setUpsertForm(prev => ({ ...prev, blockedCount: parseInt(e.target.value) || 0 }))}
                                    />
                                  </div>
                                  <div className="flex items-end">
                                    <Button
                                      className="w-full"
                                      onClick={handleUpsert}
                                      disabled={isUpserting}
                                    >
                                      {isUpserting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                                      Save
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CalendarIcon className="h-5 w-5 text-[#004165]" />
                      Today's Schedule
                    </CardTitle>
                    <CardDescription>
                      {new Date().toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </CardDescription>
                  </div>
                  {todayBookings.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => setTodayDialogOpen(true)}>
                      View All ({todayBookings.length})
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {todayBookings.length > 0 ? (
                  <div className="space-y-3">
                    {todayBookings.slice(0, 3).map(booking => (
                      <div key={booking.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className={`w-2 h-2 rounded-full ${getBookingColor(booking.status)}`} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{booking.tourName}</p>
                          <p className="text-xs text-muted-foreground">{booking.customerName}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">{booking.guests} pax</span>
                      </div>
                    ))}
                    {todayBookings.length > 3 && (
                      <button
                        className="w-full text-xs text-primary hover:underline text-center py-1"
                        onClick={() => setTodayDialogOpen(true)}
                      >
                        +{todayBookings.length - 3} more — View all
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No bookings today</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* F: Today's full booking list dialog */}
            <Dialog open={todayDialogOpen} onOpenChange={setTodayDialogOpen}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>All Bookings Today</DialogTitle>
                  <DialogDescription>
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} — {todayBookings.length} booking(s)
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {todayBookings.map(booking => (
                    <div key={booking.id} className="p-4 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm">{booking.tourName}</h4>
                        <Badge className={
                          booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                          booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          booking.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                          'bg-red-100 text-red-800'
                        }>{booking.status}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                        <span>{booking.customerName}</span>
                        <span>{booking.guests} guests</span>
                        <span>{booking.customerEmail}</span>
                        <span className="font-medium text-foreground">{booking.amount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-[#004165]" />
                  Upcoming Bookings
                </CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingBookings.length > 0 ? (
                  <div className="space-y-3">
                    {upcomingBookings.map(booking => (
                      <Dialog key={booking.id}>
                        <DialogTrigger asChild>
                          <div className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 hover:border-primary/40 transition-all group">
                            <div className="text-center bg-[#004165] text-white rounded px-2 py-1 group-hover:bg-primary transition-colors">
                              <div className="text-xs">{new Date(booking.date).toLocaleDateString('en-US', { month: 'short' })}</div>
                              <div className="text-lg font-bold">{new Date(booking.date).getDate()}</div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{booking.tourName}</p>
                              <p className="text-xs text-muted-foreground">{booking.customerName}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">{booking.guests} guests</Badge>
                                <span className="text-xs font-medium text-[#004165]">{booking.amount}</span>
                              </div>
                            </div>
                          </div>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{booking.tourName}</DialogTitle>
                            <DialogDescription>
                              {new Date(booking.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-3 text-sm">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="p-3 bg-muted/30 rounded-lg">
                                <p className="text-xs text-muted-foreground">Customer</p>
                                <p className="font-medium">{booking.customerName}</p>
                              </div>
                              <div className="p-3 bg-muted/30 rounded-lg">
                                <p className="text-xs text-muted-foreground">Guests</p>
                                <p className="font-medium">{booking.guests}</p>
                              </div>
                              <div className="p-3 bg-muted/30 rounded-lg">
                                <p className="text-xs text-muted-foreground">Amount</p>
                                <p className="font-medium text-[#004165]">{booking.amount}</p>
                              </div>
                              <div className="p-3 bg-muted/30 rounded-lg">
                                <p className="text-xs text-muted-foreground">Status</p>
                                <Badge className={
                                  booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                                  booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }>{booking.status}</Badge>
                              </div>
                            </div>
                            {booking.customerEmail && (
                              <div className="p-3 bg-muted/30 rounded-lg">
                                <p className="text-xs text-muted-foreground">Email</p>
                                <p className="font-medium">{booking.customerEmail}</p>
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No upcoming bookings</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-[#004165] text-white">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Quick Stats</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="opacity-80">This Month</span>
                    <span className="font-bold">
                      {bookings.filter(b => {
                        const d = new Date(b.date);
                        return d.getMonth() === currentDate.getMonth() &&
                          d.getFullYear() === currentDate.getFullYear();
                      }).length} bookings
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-80">Confirmed</span>
                    <span className="font-bold">
                      {bookings.filter(b => {
                        const d = new Date(b.date);
                        return d.getMonth() === currentDate.getMonth() &&
                          d.getFullYear() === currentDate.getFullYear() &&
                          b.status === 'confirmed';
                      }).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-80">Pending</span>
                    <span className="font-bold">
                      {bookings.filter(b => {
                        const d = new Date(b.date);
                        return d.getMonth() === currentDate.getMonth() &&
                          d.getFullYear() === currentDate.getFullYear() &&
                          b.status === 'pending';
                      }).length}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
