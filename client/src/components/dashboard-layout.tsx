import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
  Check,
  BarChart3,
  FileText,
  Tag,
  Calendar
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DashboardLayoutProps {
  children: React.ReactNode;
  type: "admin" | "customer";
}

export function DashboardLayout({ children, type }: DashboardLayoutProps) {
  const [location] = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
    { href: "/admin/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/admin/bookings", label: "Bookings", icon: CalendarDays },
    { href: "/admin/calendar", label: "Calendar", icon: Calendar },
    { href: "/admin/tours", label: "Tours & Services", icon: Map },
    { href: "/admin/customers", label: "Customers", icon: Users },
    { href: "/admin/promotions", label: "Promotions", icon: Tag },
    { href: "/admin/reports", label: "Reports", icon: FileText },
    { href: "/admin/settings", label: "Settings", icon: Settings },
  ];

  const customerLinks = [
    { href: "/dashboard", label: "My Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/bookings", label: "My Bookings", icon: ShoppingBag },
    { href: "/dashboard/saved", label: "Saved Tours", icon: Heart },
    { href: "/dashboard/profile", label: "Profile & Settings", icon: User },
  ];

  const links = type === "admin" ? adminLinks : customerLinks;

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex">
      {/* Floating Sidebar Trigger */}
      {!isSidebarOpen && (
        <div 
          className="fixed left-0 top-1/2 -translate-y-1/2 z-50 bg-[hsl(var(--primary))] text-white p-2 rounded-r-md cursor-pointer shadow-md hover:w-12 transition-all duration-300 w-8 flex items-center justify-center"
          onMouseEnter={() => setIsSidebarOpen(true)}
        >
          <div className="h-8 w-1 bg-white/20 rounded-full"></div>
        </div>
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-[hsl(var(--foreground))] text-white transition-transform duration-300 ease-in-out shadow-xl",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
        onMouseEnter={() => setIsSidebarOpen(true)}
        onMouseLeave={() => setIsSidebarOpen(false)}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-white/10">
          <Link href="/">
            <span className="font-serif font-bold text-xl tracking-tight cursor-pointer">Ace Tours</span>
          </Link>
          <button onClick={() => setIsSidebarOpen(false)} className="text-white/70 hover:text-white">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-4">
          <div className="flex items-center gap-3 mb-8 px-2">
            <Avatar className="h-10 w-10 border-2 border-white/20">
              <AvatarImage src={type === "admin" ? "https://github.com/shadcn.png" : ""} />
              <AvatarFallback className="bg-primary-foreground text-primary font-bold">
                {type === "admin" ? "AD" : "JD"}
              </AvatarFallback>
            </Avatar>
            <div className="overflow-hidden">
              <p className="font-medium truncate">{type === "admin" ? "Admin User" : "James Doe"}</p>
              <p className="text-xs text-white/60 truncate">{type === "admin" ? "Administrator" : "Customer"}</p>
            </div>
          </div>

          <nav className="space-y-1">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = location === link.href;
              return (
                <Link key={link.href} href={link.href}>
                  <a className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                    isActive 
                      ? "bg-white/10 text-white shadow-sm" 
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  )}>
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </a>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
          <Link href="/login">
            <button className="flex items-center gap-3 px-3 py-2.5 w-full text-left rounded-md text-sm font-medium text-white/70 hover:bg-red-500/10 hover:text-red-200 transition-colors">
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b h-16 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-40">
          <div 
            className="mr-4 p-2 -ml-2 cursor-pointer text-slate-500 hover:text-slate-700"
            onMouseEnter={() => setIsSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </div>
          
          <div className="flex items-center gap-4 ml-auto">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative text-slate-500 hover:text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))/10]">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full ring-2 ring-white"></span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0 mr-4" align="end">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-[hsl(var(--muted))/30]">
                  <h4 className="font-semibold text-sm">Notifications</h4>
                  {unreadCount > 0 && (
                    <span className="bg-[hsl(var(--primary))] text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                      {unreadCount} New
                    </span>
                  )}
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {notifications.length > 0 ? (
                    <div className="divide-y">
                      {notifications.map((notification) => (
                        <div 
                          key={notification.id} 
                          className={cn(
                            "p-4 hover:bg-[hsl(var(--muted))/30] transition-colors cursor-pointer",
                            !notification.read && "bg-[hsl(var(--primary))/5]"
                          )}
                        >
                          <div className="flex justify-between items-start gap-2 mb-1">
                            <h5 className={cn("text-sm font-medium", !notification.read && "text-[hsl(var(--primary))]")}>
                              {notification.title}
                            </h5>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">{notification.time}</span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {notification.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                      No new notifications
                    </div>
                  )}
                </div>
                <div className="p-2 border-t bg-[hsl(var(--muted))/30]">
                  <Button variant="ghost" size="sm" className="w-full text-xs h-8 text-muted-foreground hover:text-[hsl(var(--primary))]">
                    Mark all as read
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          {children}
        </main>
      </div>

      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}
