import { useState, useTransition, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { LayoutContext, useLayoutContext } from "@/lib/layout-context";
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
  BarChart3,
  FileText,
  Tag,
  CreditCard,
  UserCog,
  DollarSign,
  Ban,
  Gauge,
  ScrollText,
  ChevronRight,
  Star,
  ShieldAlert,
  Mail,
  RotateCcw,
  Landmark
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
  const { insideShell } = useLayoutContext();
  const [location, setLocation] = useLocation();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const [isPending, startTransition] = useTransition();

  // Smooth progress bar that animates while a lazy page is loading
  const progressRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!progressRef.current) return;
    if (isPending) {
      progressRef.current.style.width = "0%";
      progressRef.current.style.opacity = "1";
      // animate to 80% quickly, then slow down (will jump to 100% on done)
      requestAnimationFrame(() => {
        if (progressRef.current) progressRef.current.style.width = "70%";
      });
    } else {
      progressRef.current.style.width = "100%";
      const t = setTimeout(() => {
        if (progressRef.current) progressRef.current.style.opacity = "0";
      }, 250);
      return () => clearTimeout(t);
    }
  }, [isPending]);

  // Navigate with startTransition so current content stays visible while new page loads
  const navigate = useCallback((href: string) => {
    startTransition(() => setLocation(href));
    setIsMobileSidebarOpen(false);
  }, [setLocation]);

  // When AdminLayoutShell or CustomerLayoutShell already provides the layout,
  // DashboardLayout becomes a transparent pass-through. This avoids double-sidebar.
  if (insideShell) {
    return <>{children}</>;
  }

  const adminLinks = [
    { icon: LayoutDashboard, label: "Overview", href: "/admin/dashboard", show: true, group: "main" },
    { icon: CalendarDays, label: "Bookings", href: "/admin/bookings", show: true, group: "main" },
    { icon: Map, label: "Products", href: "/admin/products", show: true, group: "main" },
    { icon: CalendarDays, label: "Calendar", href: "/admin/calendar", show: true, group: "main" },
    { icon: Gauge, label: "Capacity", href: "/admin/capacity", show: true, group: "main" },
    { icon: Star, label: "Reviews", href: "/admin/reviews", show: user?.role === "admin", group: "manage" },
    { icon: UserCog, label: "Staff", href: "/admin/staff", show: user?.role === "admin", group: "manage" },
    { icon: Users, label: "Customers", href: "/admin/customers", show: user?.role === "admin", group: "manage" },
    { icon: DollarSign, label: "Pricing", href: "/admin/pricing", show: user?.role === "admin", group: "manage" },
    { icon: Ban, label: "Blackout Dates", href: "/admin/blackouts", show: user?.role === "admin", group: "manage" },
    { icon: Tag, label: "Promotions", href: "/admin/promotions", show: user?.role === "admin", group: "manage" },
    { icon: FileText, label: "CMS Content", href: "/admin/cms", show: user?.role === "admin", group: "system" },
    { icon: BarChart3, label: "Analytics", href: "/admin/analytics", show: user?.role === "admin", group: "system" },
    { icon: FileText, label: "Reports", href: "/admin/reports", show: user?.role === "admin", group: "system" },
    { icon: CreditCard, label: "Payments", href: "/admin/payments", show: user?.role === "admin", group: "system" },
    { icon: Landmark, label: "Reconciliation", href: "/admin/reconciliation", show: user?.role === "admin", group: "system" },
    { icon: Mail, label: "Newsletter", href: "/admin/newsletter", show: user?.role === "admin", group: "system" },
    { icon: ScrollText, label: "Audit Logs", href: "/admin/audit-logs", show: user?.role === "admin", group: "system" },
    { icon: ShieldAlert, label: "Fraud Review", href: "/admin/fraud", show: user?.role === "admin", group: "system" },
    { icon: RotateCcw, label: "Recovery", href: "/admin/recovery", show: user?.role === "admin", group: "system" },
    { icon: Settings, label: "Settings", href: "/admin/settings", show: user?.role === "admin", group: "system" },
  ];

  const customerLinks = [
    { href: "/dashboard", label: "My Dashboard", icon: LayoutDashboard, emoji: "🏠", group: "main" },
    { href: "/dashboard/bookings", label: "My Bookings", icon: ShoppingBag, emoji: "🎫", group: "main" },
    { href: "/dashboard/saved", label: "Saved Tours", icon: Heart, emoji: "❤️", group: "main" },
    { href: "/dashboard/profile", label: "Profile & Settings", icon: User, emoji: "👤", group: "main" },
  ];

  const links = type === "admin" ? adminLinks : customerLinks;

  const handleLogout = async () => {
    await logout();
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-5 border-b border-border/60 shrink-0">
        <button onClick={() => navigate("/")} className="border-none bg-transparent p-0">
          <div className="flex items-center gap-3 cursor-pointer group">
            <img
              src={logo}
              alt="Ace Tours"
              className="w-8 h-8 rounded-lg border border-border/40 object-cover shadow-sm group-hover:ring-2 group-hover:ring-primary/40 transition-all"
            />
            <div>
              <div className="text-foreground font-bold text-sm leading-tight">Ace Tours</div>
              <div className="text-muted-foreground text-[10px] uppercase tracking-wide">
                {type === "admin" ? "Admin Panel" : "My Account"}
              </div>
            </div>
          </div>
        </button>
        <button
          onClick={() => setIsMobileSidebarOpen(false)}
          className="lg:hidden text-muted-foreground hover:text-foreground p-1 transition-colors rounded-md hover:bg-muted"
        >
          <X size={18} />
        </button>
      </div>

      {/* User pill */}
      <div className="px-3 py-3 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-3 px-3 py-2.5 bg-muted/40 rounded-xl border border-border/30">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
            {user?.name?.[0]?.toUpperCase() || (type === "admin" ? "A" : "U")}
          </div>
          <div className="overflow-hidden min-w-0">
            <p className="font-semibold text-xs text-foreground truncate">
              {user?.name || (type === "admin" ? "Admin User" : "Customer")}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {user?.email || (type === "admin" ? "Administrator" : "Customer")}
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {type === "admin" ? (
          <>
            {/* Group: Main */}
            <div className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest px-2 pt-1 pb-1.5">Main</div>
            {adminLinks.filter(l => l.show && l.group === "main").map((link) => (
              <button key={link.href} onClick={() => navigate(link.href)} className="w-full text-left">
                <div
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-sm transition-all duration-150 ${location === link.href
                      ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                >
                  <link.icon className="h-4 w-4 shrink-0" />
                  <span>{link.label}</span>
                  {location === link.href && <ChevronRight className="h-3 w-3 ml-auto opacity-60" />}
                </div>
              </button>
            ))}

            {/* Group: Manage */}
            <div className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest px-2 pt-3 pb-1.5">Manage</div>
            {adminLinks.filter(l => l.show && l.group === "manage").map((link) => (
              <button key={link.href} onClick={() => navigate(link.href)} className="w-full text-left">
                <div
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-sm transition-all duration-150 ${location === link.href
                      ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                >
                  <link.icon className="h-4 w-4 shrink-0" />
                  <span>{link.label}</span>
                  {location === link.href && <ChevronRight className="h-3 w-3 ml-auto opacity-60" />}
                </div>
              </button>
            ))}

            {/* Group: System */}
            <div className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest px-2 pt-3 pb-1.5">System</div>
            {adminLinks.filter(l => l.show && l.group === "system").map((link) => (
              <button key={link.href} onClick={() => navigate(link.href)} className="w-full text-left">
                <div
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-sm transition-all duration-150 ${location === link.href
                      ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                >
                  <link.icon className="h-4 w-4 shrink-0" />
                  <span>{link.label}</span>
                  {location === link.href && <ChevronRight className="h-3 w-3 ml-auto opacity-60" />}
                </div>
              </button>
            ))}
          </>
        ) : (
          customerLinks.map((link) => {
            const isActive = location === link.href;
            return (
              <button key={link.href} onClick={() => navigate(link.href)} className="w-full text-left">
                <div
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-sm transition-all duration-150 ${isActive
                      ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  data-testid={`nav-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <span className="text-base">{link.emoji}</span>
                  <span>{link.label}</span>
                  {isActive && <ChevronRight className="h-3 w-3 ml-auto opacity-60" />}
                </div>
              </button>
            );
          })
        )}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-border/60 shrink-0">
        <Button
          variant="ghost"
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-muted-foreground cursor-pointer text-sm text-left transition-all hover:bg-destructive/10 hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut size={15} />
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex font-sans">
      {/* Desktop Sidebar - always visible */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 bg-background border-r border-border sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar - slide in */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 bg-background border-r border-border flex flex-col lg:hidden transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'
          }`}
      >
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-200 ${isMobileSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        onClick={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-background/95 backdrop-blur border-b border-border h-14 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-40">
          {/* Progress bar — shown during lazy page transitions */}
          <div
            ref={progressRef}
            className="absolute top-0 left-0 h-0.5 bg-primary transition-all duration-500 ease-out"
            style={{ width: "0%", opacity: 0 }}
          />
          <button
            className="lg:hidden p-2 -ml-1 cursor-pointer text-muted-foreground rounded-lg transition-colors hover:bg-muted hover:text-foreground border-none bg-transparent"
            onClick={() => setIsMobileSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          {/* Breadcrumb / page context on desktop */}
          <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
            <button onClick={() => navigate(type === "admin" ? "/admin/dashboard" : "/dashboard")}>
              <span className="font-medium text-foreground hover:text-primary cursor-pointer transition-colors">
                {type === "admin" ? "Admin Panel" : "My Account"}
              </span>
            </button>
            {location !== "/admin/dashboard" && location !== "/dashboard" && (
              <>
                <ChevronRight size={14} />
                <span className="capitalize text-foreground">
                  {location.split("/").filter(Boolean).at(-1)?.replace(/-/g, " ")}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <LanguageSelector />
            <ThemeToggle size="sm" />
            <NotificationsPopover />

            <Popover>
              <PopoverTrigger asChild>
                <button className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all">
                  {user?.name?.[0]?.toUpperCase() || (type === "admin" ? "A" : "U")}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-2" align="end">
                <div className="px-2 py-2.5 border-b border-border mb-1.5">
                  <p className="font-semibold text-sm">{user?.name || 'User'}</p>
                  <p className="text-xs text-muted-foreground">{user?.email || ''}</p>
                </div>
                <button
                  onClick={() => navigate(type === 'admin' ? '/admin/settings' : '/dashboard/profile')}
                  className="flex items-center gap-2 px-2 py-2 rounded-md text-sm hover:bg-muted cursor-pointer w-full text-left"
                >
                  <User className="h-4 w-4" />
                  Profile & Settings
                </button>
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

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 animate-in fade-in duration-200">
          {children}
        </main>
      </div>
    </div>
  );
}
