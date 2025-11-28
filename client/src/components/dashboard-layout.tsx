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
  Bell
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface DashboardLayoutProps {
  children: React.ReactNode;
  type: "admin" | "customer";
}

export function DashboardLayout({ children, type }: DashboardLayoutProps) {
  const [location] = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const adminLinks = [
    { href: "/admin/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/admin/bookings", label: "Bookings", icon: CalendarDays },
    { href: "/admin/tours", label: "Tours & Services", icon: Map },
    { href: "/admin/customers", label: "Customers", icon: Users },
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
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-[#004165] text-white transition-transform duration-300 ease-in-out shadow-xl",
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
            <Button variant="ghost" size="icon" className="relative text-slate-500">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full"></span>
            </Button>
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
