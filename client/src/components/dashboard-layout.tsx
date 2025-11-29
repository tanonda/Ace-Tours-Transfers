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
  Calendar
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { ThemeToggle } from "@/components/theme-toggle";
import logo from "@assets/thumbnail_1755110010542_1764279489018.jpg";

interface DashboardLayoutProps {
  children: React.ReactNode;
  type: "admin" | "customer";
}

export function DashboardLayout({ children, type }: DashboardLayoutProps) {
  const [location] = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const { theme } = useTheme();

  const notifications = [
    {
      id: 1,
      title: "New Booking Confirmed",
      message: "Booking #BK-7821 has been confirmed.",
      time: "2 mins ago",
      read: false
    },
    {
      id: 2,
      title: "Payment Received",
      message: "Payment for Booking #BK-7821 successful.",
      time: "5 mins ago",
      read: false
    },
    {
      id: 3,
      title: "Tour Reminder",
      message: "Your tour starts tomorrow at 8:00 AM.",
      time: "1 hour ago",
      read: true
    }
  ];

  const unreadCount = notifications.filter(n => !n.read).length;

  const adminLinks = [
    { href: "/admin/dashboard", label: "Overview", icon: LayoutDashboard, emoji: "📊" },
    { href: "/admin/analytics", label: "Analytics", icon: BarChart3, emoji: "📈" },
    { href: "/admin/bookings", label: "Bookings", icon: CalendarDays, emoji: "📅" },
    { href: "/admin/calendar", label: "Calendar", icon: Calendar, emoji: "🗓️" },
    { href: "/admin/tours", label: "Tours & Services", icon: Map, emoji: "🗺️" },
    { href: "/admin/customers", label: "Customers", icon: Users, emoji: "👥" },
    { href: "/admin/promotions", label: "Promotions", icon: Tag, emoji: "🏷️" },
    { href: "/admin/reports", label: "Reports", icon: FileText, emoji: "📋" },
    { href: "/admin/settings", label: "Settings", icon: Settings, emoji: "⚙️" },
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
      {!isSidebarOpen && (
        <div 
          className="fixed left-0 top-1/2 -translate-y-1/2 z-50 bg-primary p-2 rounded-r-lg cursor-pointer shadow-lg transition-all duration-300 w-8 flex items-center justify-center"
          onMouseEnter={() => setIsSidebarOpen(true)}
        >
          <div className="h-8 w-1 bg-primary-foreground/30 rounded" />
        </div>
      )}

      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-60 bg-background border-r border-border flex flex-col transition-transform duration-300 ${
          isSidebarOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'
        }`}
        onMouseEnter={() => setIsSidebarOpen(true)}
        onMouseLeave={() => setIsSidebarOpen(false)}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-border">
          <Link href="/">
            <div className="flex items-center gap-2.5 cursor-pointer">
              <img 
                src={logo} 
                alt="Ace Tours Logo" 
                className="h-10 w-10 object-contain rounded-lg"
              />
              <div>
                <div className="text-foreground font-bold text-sm">Ace Tours & Transfers</div>
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
            {links.map((link) => {
              const isActive = location === link.href;
              return (
                <Link key={link.href} href={link.href}>
                  <div 
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-all ${
                      isActive 
                        ? 'bg-accent text-accent-foreground font-semibold' 
                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                    }`}
                    data-testid={`nav-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <span className="text-sm">{link.emoji}</span>
                    {link.label}
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-border">
          <Link href="/login">
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg border-none bg-transparent text-muted-foreground cursor-pointer text-sm text-left transition-all hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </Link>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-background border-b border-border h-16 flex items-center justify-between px-6 sticky top-0 z-40">
          <div 
            className="p-2 -ml-2 cursor-pointer text-muted-foreground rounded-lg transition-all hover:bg-accent hover:text-foreground"
            onMouseEnter={(e) => {
              setIsSidebarOpen(true);
            }}
          >
            <Menu size={24} />
          </div>
          
          <div className="flex items-center gap-3">
            <ThemeToggle size="sm" />
            
            <Popover>
              <PopoverTrigger asChild>
                <button className="relative bg-transparent border-none p-2 cursor-pointer text-muted-foreground rounded-lg hover:bg-accent hover:text-foreground transition-colors">
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full border-2 border-background" />
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-80 p-0 mr-4 bg-card border-border" 
                align="end"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
                  <h4 className="font-semibold text-sm text-foreground">Notifications</h4>
                  {unreadCount > 0 && (
                    <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full font-bold">
                      {unreadCount} New
                    </span>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length > 0 ? (
                    <div>
                      {notifications.map((notification) => (
                        <div 
                          key={notification.id} 
                          className={`p-4 border-b border-border/50 cursor-pointer hover:bg-muted/50 transition-colors ${
                            !notification.read ? 'bg-primary/5' : ''
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2 mb-1">
                            <h5 className={`text-sm font-medium ${!notification.read ? 'text-primary' : 'text-foreground'}`}>
                              {notification.title}
                            </h5>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {notification.time}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {notification.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-muted-foreground text-sm">
                      No new notifications
                    </div>
                  )}
                </div>
                <div className="p-2 border-t border-border bg-muted/30">
                  <button className="w-full py-2 bg-transparent border-none text-muted-foreground text-xs cursor-pointer rounded-md hover:bg-accent hover:text-foreground transition-colors">
                    Mark all as read
                  </button>
                </div>
              </PopoverContent>
            </Popover>

            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
              {user?.name?.[0] || (type === "admin" ? "A" : "J")}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}
