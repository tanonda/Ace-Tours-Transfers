import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchBookings, fetchBookingStats, fetchTours, updateBooking, exportBookingsCSV } from "@/lib/api";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";

const THEME = {
  accent1: '#FF6B6B',
  accent2: '#FFD93D',
  accent3: '#6BCB77',
  accent4: '#4D96FF',
  bg: '#0f1724',
  surface: '#0b1220',
  text: '#E6EEF3'
};

const fmtVT = (n?: number) => (n == null ? '-' : n.toLocaleString('en-US') + ' VT');

function Topbar({ title, showSearch = true, onLogout }: { title: string; showSearch?: boolean; onLogout: () => void }) {
  const { user } = useAuth();
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: THEME.text }}>{title}</h2>
        <div style={{ opacity: 0.7, fontSize: 13 }}>v1.0 • Popsy analytics</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {showSearch && <input data-testid="input-search" placeholder="Search bookings, users, routes..." style={{ padding: '8px 12px', borderRadius: 8, border: 'none', minWidth: 220, background: 'rgba(255,255,255,0.05)', color: THEME.text }} />}
        <button data-testid="button-logout" onClick={onLogout} style={{ padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', color: THEME.text }}>Logout</button>
        <div style={{ width: 36, height: 36, borderRadius: 999, background: THEME.accent4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#07203b', fontWeight: 700 }}>{user?.name?.[0] || 'A'}</div>
      </div>
    </div>
  );
}

function Sidebar({ onNewBooking }: { onNewBooking: () => void }) {
  const [location, setLocation] = useLocation();
  const items = [
    { label: 'Overview', href: '/admin/dashboard' },
    { label: 'Bookings', href: '/admin/bookings' },
    { label: 'Tours', href: '/admin/tours' },
    { label: 'Customers', href: '/admin/customers' },
    { label: 'Settings', href: '/admin/settings' },
  ];

  return (
    <aside style={{ width: 220, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Link href="/">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: THEME.accent1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#201114', fontWeight: 800 }}>AT</div>
          <div>
            <div style={{ color: THEME.text, fontWeight: 700 }}>Ace Tours</div>
            <div style={{ color: 'rgba(230,238,243,0.6)', fontSize: 12 }}>Admin Panel</div>
          </div>
        </div>
      </Link>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
        {items.map(it => (
          <Link key={it.label} href={it.href}>
            <button 
              data-testid={`nav-${it.label.toLowerCase()}`}
              style={{ 
                textAlign: 'left', 
                padding: '10px 12px', 
                borderRadius: 8, 
                border: 'none', 
                background: location === it.href ? 'rgba(255,255,255,0.08)' : 'transparent', 
                color: location === it.href ? THEME.text : 'rgba(230,238,243,0.7)', 
                cursor: 'pointer',
                width: '100%',
                fontWeight: location === it.href ? 600 : 400
              }}
            >
              {it.label}
            </button>
          </Link>
        ))}
      </nav>
      <div style={{ marginTop: 'auto', fontSize: 12, color: 'rgba(230,238,243,0.6)' }}>
        Quick actions
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button data-testid="button-new-booking" onClick={onNewBooking} style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: 999, cursor: 'pointer', border: 'none', color: THEME.text, fontSize: 12 }}>New Booking</button>
          <button data-testid="button-send-invoice" onClick={() => setLocation('/admin/bookings')} style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: 999, cursor: 'pointer', border: 'none', color: THEME.text, fontSize: 12 }}>Send Invoice</button>
        </div>
      </div>
    </aside>
  );
}

function KPI({ label, value, delta, iconBg }: { label: string; value: string | number; delta?: string; iconBg?: string }) {
  return (
    <div data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, '-')}`} style={{ 
      padding: 12, 
      borderRadius: 12, 
      background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))', 
      minWidth: 160,
      flex: 1
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 12, color: 'rgba(230,238,243,0.7)' }}>{label}</div>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#0f1724' }}>{label[0]}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: THEME.text }}>{value}</div>
        {delta && <div style={{ fontSize: 12, color: delta.startsWith('+') ? THEME.accent3 : THEME.accent1 }}>{delta}</div>}
      </div>
    </div>
  );
}

function BookingModal({ booking, onClose, onUpdate }: { booking: any; onClose: () => void; onUpdate: (status: string) => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: THEME.bg, padding: 24, borderRadius: 16, width: 400, maxWidth: '90%' }}>
        <h3 style={{ margin: 0, color: THEME.text, marginBottom: 16 }}>Booking Details</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, color: 'rgba(230,238,243,0.85)' }}>
          <div><strong>ID:</strong> #{booking.id?.slice(0, 8)}</div>
          <div><strong>Customer:</strong> {booking.customerName}</div>
          <div><strong>Tour:</strong> {booking.tourName}</div>
          <div><strong>Date:</strong> {booking.date}</div>
          <div><strong>Guests:</strong> {booking.guests}</div>
          <div><strong>Amount:</strong> {booking.amount}</div>
          <div><strong>Status:</strong> {booking.status}</div>
        </div>
        <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
          <button data-testid="button-confirm-booking" onClick={() => onUpdate('confirmed')} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: THEME.accent3, color: '#031428', fontWeight: 600, cursor: 'pointer' }}>Confirm</button>
          <button data-testid="button-cancel-booking" onClick={() => onUpdate('cancelled')} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: THEME.accent1, color: '#031428', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
        </div>
        <button data-testid="button-close-modal" onClick={onClose} style={{ marginTop: 12, width: '100%', padding: '10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: THEME.text, cursor: 'pointer' }}>Close</button>
      </div>
    </div>
  );
}

function Table({ rows, onOpenBooking }: { rows: any[]; onOpenBooking: (booking: any) => void }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead style={{ textAlign: 'left', color: 'rgba(230,238,243,0.7)' }}>
        <tr>
          <th style={{ padding: 8 }}>ID</th>
          <th style={{ padding: 8 }}>Customer</th>
          <th style={{ padding: 8 }}>Route</th>
          <th style={{ padding: 8 }}>Date</th>
          <th style={{ padding: 8 }}>Amount</th>
          <th style={{ padding: 8 }}>Status</th>
          <th style={{ padding: 8 }}>Action</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.id} data-testid={`row-booking-${r.id}`} style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
            <td style={{ padding: 8, color: 'rgba(230,238,243,0.85)' }}>#{r.id?.slice(0, 6) || r.id}</td>
            <td style={{ padding: 8, color: 'rgba(230,238,243,0.85)' }}>{r.customerName || r.name}</td>
            <td style={{ padding: 8, color: 'rgba(230,238,243,0.85)' }}>{r.tourName || r.route}</td>
            <td style={{ padding: 8, color: 'rgba(230,238,243,0.85)' }}>{r.date}</td>
            <td style={{ padding: 8, color: 'rgba(230,238,243,0.85)' }}>{r.amount}</td>
            <td style={{ padding: 8, color: 'rgba(230,238,243,0.85)' }}>
              <span style={{
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
                background: r.status === 'confirmed' || r.status === 'Paid' ? 'rgba(107,203,119,0.2)' : 
                           r.status === 'pending' || r.status === 'Pending' ? 'rgba(255,217,61,0.2)' : 
                           'rgba(255,107,107,0.2)',
                color: r.status === 'confirmed' || r.status === 'Paid' ? THEME.accent3 : 
                       r.status === 'pending' || r.status === 'Pending' ? THEME.accent2 : 
                       THEME.accent1
              }}>
                {r.status}
              </span>
            </td>
            <td style={{ padding: 8 }}>
              <button 
                data-testid={`button-open-${r.id}`}
                onClick={() => onOpenBooking(r)}
                style={{ 
                  background: `linear-gradient(90deg, ${THEME.accent4}, ${THEME.accent1})`,
                  color: '#031428', 
                  padding: '4px 8px', 
                  borderRadius: 6, 
                  border: 'none', 
                  fontWeight: 600, 
                  cursor: 'pointer',
                  fontSize: 11
                }}>Open</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function AdminDashboard() {
  const { logout, user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings"],
    queryFn: fetchBookings,
  });

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: fetchBookingStats,
  });

  const { data: tours = [] } = useQuery({
    queryKey: ["tours"],
    queryFn: fetchTours,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateBooking(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast({ title: "Booking updated", description: "The booking status has been updated." });
      setSelectedBooking(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update booking", variant: "destructive" });
    }
  });

  const handleExportCSV = async () => {
    try {
      await exportBookingsCSV();
      toast({ title: "Export complete", description: "Bookings CSV has been downloaded." });
    } catch {
      toast({ title: "Error", description: "Failed to export bookings", variant: "destructive" });
    }
  };

  const handleLogout = async () => {
    await logout();
    toast({ title: "Logged out", description: "You have been logged out successfully." });
  };

  const filteredBookings = statusFilter === 'all' 
    ? bookings 
    : bookings.filter(b => b.status.toLowerCase() === statusFilter.toLowerCase());

  const recentBookings = filteredBookings.slice(0, 10);
  const totalRevenue = bookings.reduce((sum, b) => {
    const amount = parseFloat(b.amount.replace('$', '').replace(',', '')) || 0;
    return sum + amount;
  }, 0);

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: `linear-gradient(180deg, ${THEME.bg}, ${THEME.surface})`, 
      color: THEME.text, 
      fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial'
    }}>
      {selectedBooking && (
        <BookingModal 
          booking={selectedBooking} 
          onClose={() => setSelectedBooking(null)}
          onUpdate={(status) => updateMutation.mutate({ id: selectedBooking.id, status })}
        />
      )}

      <div style={{ display: 'flex', gap: 16, padding: 18 }}>
        <Sidebar onNewBooking={() => setLocation('/tours')} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Topbar title="Admin — Ace Tours" showSearch={true} onLogout={handleLogout} />
            
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <section style={{ display: 'flex', gap: 12 }}>
                  <KPI label="Revenue" value={fmtVT(totalRevenue * 100)} delta="+8%" iconBg={THEME.accent2} />
                  <KPI label="Bookings" value={stats?.total || bookings.length} delta="+3%" iconBg={THEME.accent4} />
                  <KPI label="Active Tours" value={tours.length} delta="+1%" iconBg={THEME.accent3} />
                  <KPI label="Uptime" value="99.97%" delta="+0.01%" iconBg={THEME.accent1} />
                </section>

                <section style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                  <div style={{ padding: 12, borderRadius: 12, background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))' }}>
                    <h3 style={{ margin: 0, color: THEME.text }}>Recent bookings</h3>
                    <div style={{ marginTop: 12 }}>
                      {recentBookings.length > 0 ? (
                        <Table rows={recentBookings} onOpenBooking={setSelectedBooking} />
                      ) : (
                        <div style={{ padding: 20, textAlign: 'center', color: 'rgba(230,238,243,0.5)' }}>
                          No bookings yet. Create your first booking to see it here.
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ padding: 12, borderRadius: 12, background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))' }}>
                      <h4 style={{ margin: 0, color: THEME.text }}>Revenue breakdown</h4>
                      <div style={{ marginTop: 8 }}>
                        <svg width="100%" height={140} viewBox="0 0 200 120" preserveAspectRatio="none">
                          <rect x="0" y="60" width="60" height="60" rx="6" fill={THEME.accent4}></rect>
                          <rect x="70" y="30" width="40" height="90" rx="6" fill={THEME.accent1}></rect>
                          <rect x="120" y="10" width="60" height="110" rx="6" fill={THEME.accent3}></rect>
                        </svg>
                        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 8, fontSize: 11, color: 'rgba(230,238,243,0.7)' }}>
                          <span>Tours</span>
                          <span>Transfers</span>
                          <span>Bus Hire</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ padding: 12, borderRadius: 12, background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))' }}>
                      <h4 style={{ margin: 0, color: THEME.text }}>System Health</h4>
                      <div style={{ marginTop: 8, fontSize: 13, color: 'rgba(230,238,243,0.85)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 999, background: THEME.accent3 }}></span>
                          All systems nominal
                        </div>
                        <div style={{ color: 'rgba(230,238,243,0.6)', fontSize: 12 }}>
                          API latency 120ms • DB connections 12/20
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              <aside style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ padding: 12, borderRadius: 12, background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))' }}>
                  <h4 style={{ margin: 0, color: THEME.text }}>Quick filters</h4>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <select 
                      data-testid="select-status-filter"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: 'none', color: THEME.text, flex: 1 }}
                    >
                      <option value="all">All statuses</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="pending">Pending</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                    <input data-testid="input-date-filter" type="date" style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: 'none', color: THEME.text }} />
                  </div>
                </div>

                <div style={{ padding: 12, borderRadius: 12, background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))' }}>
                  <h4 style={{ margin: 0, color: THEME.text }}>Notifications</h4>
                  <ul style={{ marginTop: 8, paddingLeft: 16, color: 'rgba(230,238,243,0.85)', fontSize: 13 }}>
                    {bookings.slice(0, 3).map((b, i) => (
                      <li key={b.id} style={{ marginBottom: 6 }}>
                        <span style={{ color: b.status === 'confirmed' ? THEME.accent3 : b.status === 'pending' ? THEME.accent2 : THEME.accent1 }}>
                          {b.status === 'confirmed' ? 'Confirmed' : b.status === 'pending' ? 'New booking' : 'Cancelled'}
                        </span> #{b.id?.slice(0, 6)}
                      </li>
                    ))}
                  </ul>
                </div>

                <div style={{ padding: 12, borderRadius: 12, background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))' }}>
                  <h4 style={{ margin: 0, color: THEME.text }}>Shortcuts</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                    <button data-testid="button-export-csv" onClick={handleExportCSV} style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: 999, cursor: 'pointer', border: 'none', color: THEME.text, fontSize: 12 }}>Export CSV</button>
                    <button data-testid="button-create-promo" onClick={() => setLocation('/admin/settings')} style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: 999, cursor: 'pointer', border: 'none', color: THEME.text, fontSize: 12 }}>Create Promo</button>
                    <button data-testid="button-manage-seats" onClick={() => setLocation('/admin/tours')} style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: 999, cursor: 'pointer', border: 'none', color: THEME.text, fontSize: 12 }}>Manage Seats</button>
                  </div>
                </div>

                <div style={{ padding: 12, borderRadius: 12, background: `linear-gradient(135deg, ${THEME.accent4}20, ${THEME.accent1}20)`, border: `1px solid ${THEME.accent4}30` }}>
                  <h4 style={{ margin: 0, color: THEME.text }}>Welcome, {user?.name}</h4>
                  <p style={{ margin: '8px 0 0', fontSize: 13, color: 'rgba(230,238,243,0.7)' }}>
                    You're logged in as an administrator. Manage bookings and reservations from this dashboard.
                  </p>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
