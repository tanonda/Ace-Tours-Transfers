import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  CalendarDays,
  Map,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  ShoppingBag,
  User,
  Heart,
  Bell,
  BarChart3,
  FileText,
  Tag,
  Calendar,
  CheckCircle,
  CreditCard,
  Clock,
  AlertCircle,
  ChevronRight,
  UserCog,
  DollarSign,
  Ban,
  Gauge,
  ScrollText
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { NotificationsPopover } from "@/components/notifications-popover";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSelector } from "@/components/language-selector";

const logo = "https://res.cloudinary.com/dwro1dh5q/image/upload/v1765063924/ace-tours-assets/ace_tours_logo_official.jpg";

interface DashboardLayoutProps {
  children: React.ReactNode;
  type: "admin" | "customer";
}

export function DashboardLayout({ children, type }: DashboardLayoutProps) {
  const [location, navigate] = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, logout } = useAuth();

  const toggleSidebar = () => {
    setIsSidebarOpen(prev => !prev);
  };

  const handleNotificationClick = (link: string) => {
    navigate(link);
  };

  const adminNotifications = [
    {
      id: 1,
      type: "booking",
      title: "New Booking Confirmed",
      message: "Efate Scenic Tour booked by James Doe",
      details: {
        bookingId: "BK-7821",
        customer: "James Doe",
        tour: "Efate Scenic Tour",
        date: "Dec 15, 2024",
        guests: 2,
        amount: "$240"
      },
      time: "2 mins ago",
      read: false,
      link: "/admin/bookings"
    },
    {
      id: 2,
      type: "payment",
      title: "Payment Received",
      message: "Payment of $240 received for booking",
      details: {
        bookingId: "BK-7821",
        customer: "James Doe",
        amount: "$240",
        method: "Credit Card"
      },
      time: "5 mins ago",
      read: false,
      link: "/admin/bookings"
    },
    {
      id: 3,
      type: "reminder",
      title: "Tour Starting Tomorrow",
      message: "Roots & Routes Tour scheduled for 8:00 AM",
      details: {
        tour: "Roots & Routes Tour",
        date: "Dec 10, 2024",
        time: "8:00 AM",
        guests: 4
      },
      time: "1 hour ago",
      read: true,
      link: "/admin/calendar"
    },
    {
      id: 4,
      type: "alert",
      title: "Low Availability Alert",
      message: "Only 2 seats left for Efate Scenic Tour on Dec 20",
      details: {
        tour: "Efate Scenic Tour",
        date: "Dec 20, 2024",
        seatsLeft: 2
      },
      time: "3 hours ago",
      read: true,
      link: "/admin/tours"
    }
  ];

  const customerNotifications = [
    {
      id: 1,
      type: "booking",
      title: "Booking Confirmed",
      message: "Your Efate Scenic Tour is confirmed!",
      details: {
        bookingId: "BK-7821",
        tour: "Efate Scenic Tour",
        date: "Dec 15, 2024",
        guests: 2,
        amount: "$240"
      },
      time: "2 mins ago",
      read: false,
      link: "/dashboard/bookings"
    },
    {
      id: 2,
      type: "payment",
      title: "Payment Successful",
      message: "Your payment of $240 was processed",
      details: {
        bookingId: "BK-7821",
        amount: "$240",
        method: "Credit Card",
        reference: "PAY-9823"
      },
      time: "5 mins ago",
      read: false,
      link: "/dashboard/bookings"
    },
    {
      id: 3,
      type: "reminder",
      title: "Tour Reminder",
      message: "Your tour starts tomorrow at 8:00 AM",
      details: {
        tour: "Roots & Routes Tour",
        date: "Dec 10, 2024",
        time: "8:00 AM",
        pickup: "Hotel Warwick"
      },
      time: "1 hour ago",
      read: true,
      link: "/dashboard/bookings"
    }
  ];

  const notifications = type === "admin" ? adminNotifications : customerNotifications;
  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (notificationType: string) => {
    switch (notificationType) {
      case "booking":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "payment":
        return <CreditCard className="h-4 w-4 text-blue-500" />;
      case "reminder":
        return <Clock className="h-4 w-4 text-orange-500" />;
      case "alert":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const adminLinks = [
    { icon: LayoutDashboard, label: "Overview", href: "/admin/dashboard", show: true },
    { icon: CalendarDays, label: "Bookings", href: "/admin/bookings", show: true },
    { icon: Map, label: "Products", href: "/admin/tours", show: true },
    { icon: CalendarDays, label: "Calendar", href: "/admin/calendar", show: true },
    { icon: Gauge, label: "Capacity", href: "/admin/capacity", show: true },
    { icon: UserCog, label: "Staff", href: "/admin/staff", show: user?.role === "admin" },
    { icon: Users, label: "Customers", href: "/admin/customers", show: user?.role === "admin" },
    { icon: DollarSign, label: "Pricing", href: "/admin/pricing", show: user?.role === "admin" },
    { icon: Ban, label: "Blackout Dates", href: "/admin/blackouts", show: user?.role === "admin" },
    { icon: Tag, label: "Promotions", href: "/admin/promotions", show: user?.role === "admin" },
    { icon: FileText, label: "CMS Content", href: "/admin/cms", show: user?.role === "admin" },
    { icon: BarChart3, label: "Analytics", href: "/admin/analytics", show: user?.role === "admin" },
    { icon: FileText, label: "Reports", href: "/admin/reports", show: user?.role === "admin" },
    { icon: CreditCard, label: "Payments", href: "/admin/payments", show: user?.role === "admin" },
    { icon: ScrollText, label: "Audit Logs", href: "/admin/audit-logs", show: user?.role === "admin" },
    { icon: Settings, label: "Settings", href: "/admin/settings", show: user?.role === "admin" },
  ];

  const customerLinks = [
    { href: "/dashboard", label: "My Dashboard", icon: LayoutDashboard, emoji: "🏠" },
    { href: "/dashboard/bookings", label: "My Bookings", icon: ShoppingBag, emoji: "🎫" },
    { href: "/dashboard/saved", label: "Saved Tours", icon: Heart, emoji: "❤️" },
    { href: "/dashboard/profile", label: "Profile & Settings", icon: User, emoji: "👤" },
  ];

  const links = type === "admin" ? adminLinks : customerLinks;

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex font-sans">
      <div
        className={`fixed left-0 top-1/2 -translate-y-1/2 z-40 bg-primary p-2 rounded-r-lg cursor-pointer shadow-lg w-8 flex items-center justify-center transition-opacity duration-200 ${isSidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        onClick={toggleSidebar}
      >
        <div className="h-8 w-1 bg-primary-foreground/30 rounded" />
      </div>

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 bg-background border-r border-border flex flex-col transition-transform duration-300 ease-in-out will-change-transform ${isSidebarOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'
          }`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-border">
          <Link href="/">
            <div className="flex items-center gap-2.5 cursor-pointer">
              <img
                src={logo}
                alt="Ace Tours"
                className="w-9 h-9 rounded-full border-2 border-primary/30 shadow-sm object-cover"
              />
              <div>
                <div className="text-foreground font-bold text-sm">Ace Tours</div>
                <div className="text-muted-foreground text-xs">
                  {type === "admin" ? "Admin Panel" : "Customer Portal"}
                </div>
              </div>
            </div>
          </Link>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="text-muted-foreground hover:text-foreground p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          <div className="flex items-center gap-3 mb-6 p-3 bg-muted/50 rounded-xl">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold">
              {user?.name?.[0] || (type === "admin" ? "A" : "J")}
            </div>
            <div className="overflow-hidden">
              <p className="font-semibold text-sm text-foreground truncate">
                {user?.name || (type === "admin" ? "Admin User" : "Customer")}
              </p>
              <p className="text-xs text-muted-foreground">
                {type === "admin" ? "Administrator" : "Customer"}
              </p>
            </div>
          </div>

          <nav className="flex flex-col gap-1">
            {type === "admin" ? (
              adminLinks.filter(link => link.show !== false).map((link) => (
                <Link key={link.href} href={link.href}>
                  <div
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-colors duration-150 ${location === link.href
                      ? 'bg-accent text-accent-foreground font-semibold'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                      }`}
                  >
                    <link.icon className={`h-4 w-4 ${location === link.href ? 'text-primary' : ''}`} />
                    <span>{link.label}</span>
                  </div>
                </Link>
              ))
            ) : (
              customerLinks.map((link) => {
                const isActive = location === link.href;
                return (
                  <Link key={link.href} href={link.href}>
                    <div
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-colors duration-150 ${isActive
                        ? 'bg-accent text-accent-foreground font-semibold'
                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                        }`}
                      data-testid={`nav-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <span className="text-sm">{link.emoji}</span>
                      <span>{link.label}</span>
                    </div>
                  </Link>
                );
              })
            )}
          </nav>
        </div >

        <div className="p-4 border-t border-border">
          <Button
            variant="ghost"
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-muted-foreground cursor-pointer text-sm text-left transition-colors duration-150 hover:bg-destructive/10 hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut size={16} />
            Sign Out
          </Button>
        </div>
      </aside >

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-background border-b border-border h-16 flex items-center justify-between px-6 sticky top-0 z-40">
          <button
            className="p-2 -ml-2 cursor-pointer text-muted-foreground rounded-lg transition-colors duration-150 hover:bg-accent hover:text-foreground border-none bg-transparent"
            onClick={toggleSidebar}
          >
            <Menu size={24} />
          </button>

          <div className="flex items-center gap-3">
            <LanguageSelector />
            <ThemeToggle size="sm" />

            <NotificationsPopover />

            <Popover>
              <PopoverTrigger asChild>
                <button className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all">
                  {user?.name?.[0] || (type === "admin" ? "A" : "J")}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="end">
                <div className="px-2 py-3 border-b border-border mb-2">
                  <p className="font-semibold text-sm">{user?.name || 'User'}</p>
                  <p className="text-xs text-muted-foreground">{user?.email || ''}</p>
                </div>
                <Link href={type === 'admin' ? '/admin/settings' : '/dashboard/profile'}>
                  <div className="flex items-center gap-2 px-2 py-2 rounded-md text-sm hover:bg-accent cursor-pointer">
                    <User className="h-4 w-4" />
                    Profile & Settings
                  </div>
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-2 py-2 rounded-md text-sm w-full hover:bg-destructive/10 hover:text-destructive cursor-pointer text-left"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </PopoverContent>
            </Popover>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      <div
        className={`fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-200 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        onClick={() => setIsSidebarOpen(false)}
      />
    </div >
  );
}
