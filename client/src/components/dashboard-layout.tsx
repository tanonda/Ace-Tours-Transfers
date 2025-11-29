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
import { useAuth } from "@/lib/auth-context";

const THEME = {
  accent1: '#FF6B6B',
  accent2: '#FFD93D',
  accent3: '#6BCB77',
  accent4: '#4D96FF',
  bg: '#0f1724',
  surface: '#0b1220',
  text: '#E6EEF3'
};

interface DashboardLayoutProps {
  children: React.ReactNode;
  type: "admin" | "customer";
}

export function DashboardLayout({ children, type }: DashboardLayoutProps) {
  const [location] = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, logout } = useAuth();

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
    <div 
      style={{ 
        minHeight: '100vh', 
        background: `linear-gradient(180deg, ${THEME.bg}, ${THEME.surface})`, 
        color: THEME.text, 
        fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
        display: 'flex'
      }}
    >
      {!isSidebarOpen && (
        <div 
          style={{
            position: 'fixed',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 50,
            background: THEME.accent4,
            padding: '8px',
            borderRadius: '0 8px 8px 0',
            cursor: 'pointer',
            boxShadow: '2px 2px 10px rgba(0,0,0,0.3)',
            transition: 'all 0.3s ease',
            width: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseEnter={() => setIsSidebarOpen(true)}
        >
          <div style={{ height: 32, width: 4, background: 'rgba(255,255,255,0.3)', borderRadius: 4 }}></div>
        </div>
      )}

      <aside 
        style={{
          position: 'fixed',
          inset: '0',
          right: 'auto',
          zIndex: 50,
          width: 240,
          background: `linear-gradient(180deg, ${THEME.bg}, ${THEME.surface})`,
          borderRight: '1px solid rgba(255,255,255,0.05)',
          transform: isSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s ease',
          boxShadow: isSidebarOpen ? '4px 0 20px rgba(0,0,0,0.3)' : 'none',
          display: 'flex',
          flexDirection: 'column'
        }}
        onMouseEnter={() => setIsSidebarOpen(true)}
        onMouseLeave={() => setIsSidebarOpen(false)}
      >
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          height: 64, 
          padding: '0 16px', 
          borderBottom: '1px solid rgba(255,255,255,0.05)' 
        }}>
          <Link href="/">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <div style={{ 
                width: 36, 
                height: 36, 
                borderRadius: 8, 
                background: THEME.accent1, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                color: '#201114', 
                fontWeight: 800,
                fontSize: 12
              }}>AT</div>
              <div>
                <div style={{ color: THEME.text, fontWeight: 700, fontSize: 14 }}>Ace Tours</div>
                <div style={{ color: 'rgba(230,238,243,0.5)', fontSize: 11 }}>
                  {type === "admin" ? "Admin Panel" : "Customer Portal"}
                </div>
              </div>
            </div>
          </Link>
          <button 
            onClick={() => setIsSidebarOpen(false)} 
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: 'rgba(230,238,243,0.5)', 
              cursor: 'pointer',
              padding: 4
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 16, flex: 1, overflowY: 'auto' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 12, 
            marginBottom: 24, 
            padding: '12px', 
            background: 'rgba(255,255,255,0.03)', 
            borderRadius: 10 
          }}>
            <div style={{ 
              width: 40, 
              height: 40, 
              borderRadius: 10, 
              background: THEME.accent4, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: '#07203b', 
              fontWeight: 700 
            }}>
              {user?.name?.[0] || (type === "admin" ? "A" : "J")}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: THEME.text }}>
                {user?.name || (type === "admin" ? "Admin User" : "Customer")}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(230,238,243,0.5)' }}>
                {type === "admin" ? "Administrator" : "Customer"}
              </p>
            </div>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {links.map((link) => {
              const isActive = location === link.href;
              return (
                <Link key={link.href} href={link.href}>
                  <div 
                    style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px', 
                      borderRadius: 8, 
                      background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent', 
                      color: isActive ? THEME.text : 'rgba(230,238,243,0.7)', 
                      cursor: 'pointer',
                      fontWeight: isActive ? 600 : 400,
                      fontSize: 13,
                      transition: 'all 0.15s ease'
                    }}
                    onMouseOver={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                        e.currentTarget.style.color = THEME.text;
                      }
                    }}
                    onMouseOut={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'rgba(230,238,243,0.7)';
                      }
                    }}
                    data-testid={`nav-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <span style={{ fontSize: 14 }}>{link.emoji}</span>
                    {link.label}
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        <div style={{ 
          padding: 16, 
          borderTop: '1px solid rgba(255,255,255,0.05)' 
        }}>
          <Link href="/login">
            <button 
              onClick={handleLogout}
              style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '10px 12px', 
                borderRadius: 8, 
                border: 'none',
                background: 'transparent', 
                color: 'rgba(230,238,243,0.6)', 
                cursor: 'pointer',
                fontSize: 13,
                textAlign: 'left',
                transition: 'all 0.15s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(255,107,107,0.1)';
                e.currentTarget.style.color = THEME.accent1;
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'rgba(230,238,243,0.6)';
              }}
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </Link>
        </div>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <header style={{ 
          background: THEME.bg, 
          borderBottom: '1px solid rgba(255,255,255,0.05)', 
          height: 64, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          padding: '0 24px',
          position: 'sticky',
          top: 0,
          zIndex: 40
        }}>
          <div 
            style={{ 
              padding: 8, 
              marginLeft: -8, 
              cursor: 'pointer', 
              color: 'rgba(230,238,243,0.6)',
              borderRadius: 8,
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              setIsSidebarOpen(true);
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
              e.currentTarget.style.color = THEME.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'rgba(230,238,243,0.6)';
            }}
          >
            <Menu size={24} />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Popover>
              <PopoverTrigger asChild>
                <button 
                  style={{ 
                    position: 'relative', 
                    background: 'transparent', 
                    border: 'none', 
                    padding: 8, 
                    cursor: 'pointer',
                    color: 'rgba(230,238,243,0.6)',
                    borderRadius: 8
                  }}
                >
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span style={{ 
                      position: 'absolute', 
                      top: 6, 
                      right: 6, 
                      width: 8, 
                      height: 8, 
                      background: THEME.accent1, 
                      borderRadius: 999,
                      border: `2px solid ${THEME.bg}`
                    }}></span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-80 p-0 mr-4" 
                align="end"
                style={{ background: THEME.bg, border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  padding: '12px 16px', 
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  background: 'rgba(255,255,255,0.02)'
                }}>
                  <h4 style={{ margin: 0, fontWeight: 600, fontSize: 14, color: THEME.text }}>Notifications</h4>
                  {unreadCount > 0 && (
                    <span style={{ 
                      background: THEME.accent4, 
                      color: '#07203b', 
                      fontSize: 10, 
                      padding: '2px 6px', 
                      borderRadius: 999, 
                      fontWeight: 700 
                    }}>
                      {unreadCount} New
                    </span>
                  )}
                </div>
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {notifications.length > 0 ? (
                    <div>
                      {notifications.map((notification) => (
                        <div 
                          key={notification.id} 
                          style={{
                            padding: 16,
                            borderBottom: '1px solid rgba(255,255,255,0.03)',
                            background: !notification.read ? 'rgba(77,150,255,0.05)' : 'transparent',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                            <h5 style={{ 
                              margin: 0, 
                              fontSize: 13, 
                              fontWeight: 500, 
                              color: !notification.read ? THEME.accent4 : THEME.text 
                            }}>
                              {notification.title}
                            </h5>
                            <span style={{ fontSize: 10, color: 'rgba(230,238,243,0.4)', whiteSpace: 'nowrap' }}>
                              {notification.time}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: 12, color: 'rgba(230,238,243,0.6)' }}>
                            {notification.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: 32, textAlign: 'center', color: 'rgba(230,238,243,0.4)', fontSize: 13 }}>
                      No new notifications
                    </div>
                  )}
                </div>
                <div style={{ padding: 8, borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
                  <button 
                    style={{ 
                      width: '100%', 
                      padding: 8, 
                      background: 'transparent', 
                      border: 'none', 
                      color: 'rgba(230,238,243,0.5)', 
                      fontSize: 12, 
                      cursor: 'pointer',
                      borderRadius: 6
                    }}
                  >
                    Mark all as read
                  </button>
                </div>
              </PopoverContent>
            </Popover>

            <div style={{ 
              width: 36, 
              height: 36, 
              borderRadius: 999, 
              background: THEME.accent4, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: '#07203b', 
              fontWeight: 700,
              fontSize: 14
            }}>
              {user?.name?.[0] || (type === "admin" ? "A" : "J")}
            </div>
          </div>
        </header>

        <main style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {children}
        </main>
      </div>

      {isSidebarOpen && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 40
          }}
          className="lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}
