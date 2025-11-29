import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchBookings, fetchBookingStats, fetchTours, updateBooking, exportBookingsCSV } from "@/lib/api";
import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/dashboard-layout";

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

function KPI({ label, value, delta, iconBg }: { label: string; value: string | number; delta?: string; iconBg?: string }) {
  return (
    <div data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, '-')}`} style={{ 
      padding: 16, 
      borderRadius: 12, 
      background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))', 
      border: '1px solid rgba(255,255,255,0.05)',
      minWidth: 160,
      flex: 1
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: 'rgba(230,238,243,0.6)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#0f1724', fontSize: 14 }}>{label[0]}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: THEME.text }}>{value}</div>
        {delta && <div style={{ fontSize: 12, fontWeight: 500, color: delta.startsWith('+') ? THEME.accent3 : THEME.accent1 }}>{delta}</div>}
      </div>
    </div>
  );
}

function BookingModal({ booking, onClose, onUpdate }: { booking: any; onClose: () => void; onUpdate: (status: string) => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: THEME.bg, padding: 24, borderRadius: 16, width: 400, maxWidth: '90%', border: '1px solid rgba(255,255,255,0.1)' }}>
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
      <thead style={{ textAlign: 'left', color: 'rgba(230,238,243,0.5)' }}>
        <tr>
          <th style={{ padding: '12px 8px', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>ID</th>
          <th style={{ padding: '12px 8px', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Customer</th>
          <th style={{ padding: '12px 8px', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Route</th>
          <th style={{ padding: '12px 8px', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Date</th>
          <th style={{ padding: '12px 8px', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Amount</th>
          <th style={{ padding: '12px 8px', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Status</th>
          <th style={{ padding: '12px 8px', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Action</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.id} data-testid={`row-booking-${r.id}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
            <td style={{ padding: '12px 8px', color: 'rgba(230,238,243,0.85)', fontSize: 13 }}>#{r.id?.slice(0, 6) || r.id}</td>
            <td style={{ padding: '12px 8px', color: 'rgba(230,238,243,0.85)', fontSize: 13 }}>{r.customerName || r.name}</td>
            <td style={{ padding: '12px 8px', color: 'rgba(230,238,243,0.85)', fontSize: 13 }}>{r.tourName || r.route}</td>
            <td style={{ padding: '12px 8px', color: 'rgba(230,238,243,0.85)', fontSize: 13 }}>{r.date}</td>
            <td style={{ padding: '12px 8px', color: 'rgba(230,238,243,0.85)', fontSize: 13 }}>{r.amount}</td>
            <td style={{ padding: '12px 8px', color: 'rgba(230,238,243,0.85)' }}>
              <span style={{
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                background: r.status === 'confirmed' || r.status === 'Paid' ? 'rgba(107,203,119,0.15)' : 
                           r.status === 'pending' || r.status === 'Pending' ? 'rgba(255,217,61,0.15)' : 
                           'rgba(255,107,107,0.15)',
                color: r.status === 'confirmed' || r.status === 'Paid' ? THEME.accent3 : 
                       r.status === 'pending' || r.status === 'Pending' ? THEME.accent2 : 
                       THEME.accent1
              }}>
                {r.status}
              </span>
            </td>
            <td style={{ padding: '12px 8px' }}>
              <button 
                data-testid={`button-open-${r.id}`}
                onClick={() => onOpenBooking(r)}
                style={{ 
                  background: THEME.accent4,
                  color: '#07203b', 
                  padding: '6px 12px', 
                  borderRadius: 6, 
                  border: 'none', 
                  fontWeight: 600, 
                  cursor: 'pointer',
                  fontSize: 11,
                  transition: 'all 0.15s ease'
                }}>View</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
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

  const filteredBookings = statusFilter === 'all' 
    ? bookings 
    : bookings.filter(b => b.status.toLowerCase() === statusFilter.toLowerCase());

  const recentBookings = filteredBookings.slice(0, 10);
  const totalRevenue = bookings.reduce((sum, b) => {
    const amount = parseFloat(b.amount.replace('$', '').replace(',', '')) || 0;
    return sum + amount;
  }, 0);

  return (
    <DashboardLayout type="admin">
      {selectedBooking && (
        <BookingModal 
          booking={selectedBooking} 
          onClose={() => setSelectedBooking(null)}
          onUpdate={(status) => updateMutation.mutate({ id: selectedBooking.id, status })}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: THEME.text }}>
              Welcome back, {user?.name || 'Admin'}
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: 'rgba(230,238,243,0.6)' }}>
              Here's what's happening with your tours today
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input 
              data-testid="input-search" 
              placeholder="Search bookings..." 
              style={{ 
                padding: '10px 14px', 
                borderRadius: 8, 
                border: '1px solid rgba(255,255,255,0.1)', 
                minWidth: 200, 
                background: 'rgba(255,255,255,0.03)', 
                color: THEME.text,
                fontSize: 13
              }} 
            />
            <button 
              data-testid="button-export-csv" 
              onClick={handleExportCSV} 
              style={{ 
                background: THEME.accent4, 
                padding: '10px 16px', 
                borderRadius: 8, 
                cursor: 'pointer', 
                border: 'none', 
                color: '#07203b', 
                fontSize: 13,
                fontWeight: 600
              }}
            >
              Export CSV
            </button>
          </div>
        </div>
        
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <KPI label="Revenue" value={fmtVT(totalRevenue * 100)} delta="+8%" iconBg={THEME.accent2} />
          <KPI label="Bookings" value={stats?.total || bookings.length} delta="+3%" iconBg={THEME.accent4} />
          <KPI label="Active Tours" value={tours.length} delta="+1%" iconBg={THEME.accent3} />
          <KPI label="Uptime" value="99.97%" delta="+0.01%" iconBg={THEME.accent1} />
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
          <div style={{ 
            padding: 20, 
            borderRadius: 12, 
            background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
            border: '1px solid rgba(255,255,255,0.05)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: THEME.text, fontSize: 16, fontWeight: 600 }}>Recent Bookings</h3>
              <select 
                data-testid="select-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ 
                  padding: '6px 12px', 
                  borderRadius: 6, 
                  background: 'rgba(255,255,255,0.05)', 
                  border: '1px solid rgba(255,255,255,0.1)', 
                  color: THEME.text,
                  fontSize: 12
                }}
              >
                <option value="all">All statuses</option>
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            {recentBookings.length > 0 ? (
              <Table rows={recentBookings} onOpenBooking={setSelectedBooking} />
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: 'rgba(230,238,243,0.4)' }}>
                No bookings yet. Create your first booking to see it here.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ 
              padding: 20, 
              borderRadius: 12, 
              background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              <h4 style={{ margin: '0 0 12px', color: THEME.text, fontSize: 14, fontWeight: 600 }}>Revenue Breakdown</h4>
              <svg width="100%" height={120} viewBox="0 0 200 100" preserveAspectRatio="none">
                <rect x="10" y="50" width="50" height="50" rx="6" fill={THEME.accent4}></rect>
                <rect x="75" y="25" width="50" height="75" rx="6" fill={THEME.accent1}></rect>
                <rect x="140" y="10" width="50" height="90" rx="6" fill={THEME.accent3}></rect>
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 12, fontSize: 11, color: 'rgba(230,238,243,0.6)' }}>
                <span>Tours</span>
                <span>Transfers</span>
                <span>Bus Hire</span>
              </div>
            </div>

            <div style={{ 
              padding: 20, 
              borderRadius: 12, 
              background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              <h4 style={{ margin: '0 0 12px', color: THEME.text, fontSize: 14, fontWeight: 600 }}>System Health</h4>
              <div style={{ fontSize: 13, color: 'rgba(230,238,243,0.85)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: THEME.accent3 }}></span>
                  All systems nominal
                </div>
                <div style={{ color: 'rgba(230,238,243,0.5)', fontSize: 12 }}>
                  API latency 120ms • DB connections 12/20
                </div>
              </div>
            </div>

            <div style={{ 
              padding: 20, 
              borderRadius: 12, 
              background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              <h4 style={{ margin: '0 0 12px', color: THEME.text, fontSize: 14, fontWeight: 600 }}>Quick Actions</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button 
                  data-testid="button-new-booking" 
                  onClick={() => setLocation('/tours')} 
                  style={{ 
                    background: 'rgba(255,255,255,0.05)', 
                    padding: '8px 12px', 
                    borderRadius: 8, 
                    cursor: 'pointer', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    color: THEME.text, 
                    fontSize: 12 
                  }}
                >
                  New Booking
                </button>
                <button 
                  data-testid="button-create-promo" 
                  onClick={() => setLocation('/admin/promotions')} 
                  style={{ 
                    background: 'rgba(255,255,255,0.05)', 
                    padding: '8px 12px', 
                    borderRadius: 8, 
                    cursor: 'pointer', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    color: THEME.text, 
                    fontSize: 12 
                  }}
                >
                  Create Promo
                </button>
                <button 
                  data-testid="button-view-reports" 
                  onClick={() => setLocation('/admin/reports')} 
                  style={{ 
                    background: 'rgba(255,255,255,0.05)', 
                    padding: '8px 12px', 
                    borderRadius: 8, 
                    cursor: 'pointer', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    color: THEME.text, 
                    fontSize: 12 
                  }}
                >
                  View Reports
                </button>
              </div>
            </div>

            <div style={{ 
              padding: 20, 
              borderRadius: 12, 
              background: `linear-gradient(135deg, ${THEME.accent4}15, ${THEME.accent1}15)`, 
              border: `1px solid ${THEME.accent4}30` 
            }}>
              <h4 style={{ margin: 0, color: THEME.text, fontSize: 14, fontWeight: 600 }}>Notifications</h4>
              <ul style={{ margin: '12px 0 0', paddingLeft: 0, listStyle: 'none', color: 'rgba(230,238,243,0.85)', fontSize: 13 }}>
                {bookings.slice(0, 3).map((b) => (
                  <li key={b.id} style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ 
                      width: 6, 
                      height: 6, 
                      borderRadius: 999, 
                      background: b.status === 'confirmed' ? THEME.accent3 : b.status === 'pending' ? THEME.accent2 : THEME.accent1 
                    }}></span>
                    <span style={{ color: b.status === 'confirmed' ? THEME.accent3 : b.status === 'pending' ? THEME.accent2 : THEME.accent1 }}>
                      {b.status === 'confirmed' ? 'Confirmed' : b.status === 'pending' ? 'New booking' : 'Cancelled'}
                    </span>
                    <span style={{ color: 'rgba(230,238,243,0.5)' }}>#{b.id?.slice(0, 6)}</span>
                  </li>
                ))}
                {bookings.length === 0 && (
                  <li style={{ color: 'rgba(230,238,243,0.4)' }}>No recent activity</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
