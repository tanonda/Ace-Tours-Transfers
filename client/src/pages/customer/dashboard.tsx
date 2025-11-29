import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchUserBookings, updateBooking } from "@/lib/api";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

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

function Topbar({ title, onLogout }: { title: string; onLogout: () => void }) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: THEME.text }}>{title}</h2>
        <div style={{ opacity: 0.7, fontSize: 13 }}>v1.0 • Popsy</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button data-testid="button-book-now-header" onClick={() => setLocation('/tours')} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: `linear-gradient(90deg, ${THEME.accent4}, ${THEME.accent1})`, color: '#031428', fontWeight: 600 }}>Book Now</button>
        <button data-testid="button-logout" onClick={onLogout} style={{ padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', color: THEME.text }}>Logout</button>
        <div style={{ width: 36, height: 36, borderRadius: 999, background: THEME.accent3, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#07203b', fontWeight: 700 }}>{user?.name?.[0] || 'J'}</div>
      </div>
    </div>
  );
}

function TicketModal({ booking, onClose }: { booking: any; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: THEME.bg, padding: 24, borderRadius: 16, width: 400, maxWidth: '90%' }}>
        <h3 style={{ margin: 0, color: THEME.text, marginBottom: 16, textAlign: 'center' }}>E-Ticket</h3>
        <div style={{ background: 'white', color: '#333', padding: 20, borderRadius: 12 }}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#004165' }}>Ace Tours & Transfers</div>
            <div style={{ fontSize: 12, color: '#666' }}>Vanuatu</div>
          </div>
          <hr style={{ border: 'none', borderTop: '2px dashed #ddd', margin: '16px 0' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div><strong>Booking ID:</strong> {booking.id?.slice(0, 8)}</div>
            <div><strong>Tour:</strong> {booking.tourName}</div>
            <div><strong>Customer:</strong> {booking.customerName}</div>
            <div><strong>Date:</strong> {booking.date}</div>
            <div><strong>Guests:</strong> {booking.guests}</div>
            <div><strong>Amount:</strong> {booking.amount}</div>
          </div>
          <hr style={{ border: 'none', borderTop: '2px dashed #ddd', margin: '16px 0' }} />
          <div style={{ textAlign: 'center', fontSize: 12, color: '#666' }}>
            Present this ticket at check-in
          </div>
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <button data-testid="button-print-ticket" onClick={() => window.print()} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: THEME.accent4, color: '#031428', fontWeight: 600, cursor: 'pointer' }}>Print</button>
          <button data-testid="button-close-ticket" onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: THEME.text, cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    </div>
  );
}

function Table({ rows, onViewTicket }: { rows: any[]; onViewTicket: (booking: any) => void }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead style={{ textAlign: 'left', color: 'rgba(230,238,243,0.7)' }}>
        <tr>
          <th style={{ padding: 8 }}>ID</th>
          <th style={{ padding: 8 }}>Tour</th>
          <th style={{ padding: 8 }}>Date</th>
          <th style={{ padding: 8 }}>Amount</th>
          <th style={{ padding: 8 }}>Status</th>
          <th style={{ padding: 8 }}>Action</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.id || i} data-testid={`row-booking-${r.id || i}`} style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
            <td style={{ padding: 8, color: 'rgba(230,238,243,0.85)' }}>#{(r.id || '').slice(0, 6) || i}</td>
            <td style={{ padding: 8, color: 'rgba(230,238,243,0.85)' }}>{r.tourName || r.route || r.tour}</td>
            <td style={{ padding: 8, color: 'rgba(230,238,243,0.85)' }}>{r.date}</td>
            <td style={{ padding: 8, color: 'rgba(230,238,243,0.85)' }}>{r.amount}</td>
            <td style={{ padding: 8, color: 'rgba(230,238,243,0.85)' }}>
              <span style={{
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
                background: r.status === 'Paid' || r.status === 'confirmed' ? 'rgba(107,203,119,0.2)' : 
                           r.status === 'Pending' || r.status === 'pending' ? 'rgba(255,217,61,0.2)' : 
                           'rgba(255,107,107,0.2)',
                color: r.status === 'Paid' || r.status === 'confirmed' ? THEME.accent3 : 
                       r.status === 'Pending' || r.status === 'pending' ? THEME.accent2 : 
                       THEME.accent1
              }}>
                {r.status}
              </span>
            </td>
            <td style={{ padding: 8 }}>
              <button 
                data-testid={`button-view-ticket-${r.id || i}`}
                onClick={() => onViewTicket(r)}
                style={{ 
                  background: `linear-gradient(90deg, ${THEME.accent4}, ${THEME.accent1})`,
                  color: '#031428', 
                  padding: '4px 8px', 
                  borderRadius: 6, 
                  border: 'none', 
                  fontWeight: 600, 
                  cursor: 'pointer',
                  fontSize: 11
                }}>View Ticket</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function CustomerDashboard() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedBooking, setSelectedBooking] = useState<any>(null);

  const { data: bookings = [] } = useQuery({
    queryKey: ["user-bookings", user?.id],
    queryFn: () => user?.id ? fetchUserBookings(user.id) : Promise.resolve([]),
    enabled: !!user?.id,
  });

  const upcomingTrips = bookings.filter(b => b.status === 'confirmed' || b.status === 'pending');
  const walletBalance = 52300;

  const handleLogout = async () => {
    await logout();
    toast({ title: "Logged out", description: "You have been logged out successfully." });
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: `linear-gradient(180deg, ${THEME.bg}, ${THEME.surface})`, 
      color: THEME.text, 
      fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial'
    }}>
      {selectedBooking && (
        <TicketModal booking={selectedBooking} onClose={() => setSelectedBooking(null)} />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 18 }}>
        <Topbar title="Customer — Ace Tours" onLogout={handleLogout} />

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16 }}>
          <aside style={{ padding: 12, borderRadius: 12, background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))' }}>
            <div style={{ fontWeight: 800, color: THEME.text, marginBottom: 8 }}>Welcome, {user?.name || 'Guest'}</div>
            <div style={{ fontSize: 13, color: 'rgba(230,238,243,0.7)' }}>Member since 2022</div>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link href="/tours">
                <button 
                  data-testid="button-new-booking"
                  style={{ 
                    background: `linear-gradient(90deg, ${THEME.accent4}, ${THEME.accent1})`,
                    color: '#031428', 
                    padding: '8px 12px', 
                    borderRadius: 8, 
                    border: 'none', 
                    fontWeight: 700, 
                    cursor: 'pointer',
                    width: '100%',
                    fontSize: 13
                  }}>New Booking</button>
              </Link>
              <button 
                data-testid="button-my-bookings"
                onClick={() => setLocation('/dashboard/bookings')}
                style={{ 
                  background: 'transparent', 
                  color: 'rgba(230,238,243,0.9)', 
                  border: '1px solid rgba(255,255,255,0.04)', 
                  padding: '8px 12px', 
                  borderRadius: 8, 
                  cursor: 'pointer',
                  width: '100%',
                  fontSize: 13
                }}>My Bookings</button>
              <button 
                data-testid="button-payments"
                onClick={() => setLocation('/payment')}
                style={{ 
                  background: 'transparent', 
                  color: 'rgba(230,238,243,0.9)', 
                  border: '1px solid rgba(255,255,255,0.04)', 
                  padding: '8px 12px', 
                  borderRadius: 8, 
                  cursor: 'pointer',
                  width: '100%',
                  fontSize: 13
                }}>Payments</button>
              <button 
                data-testid="button-support"
                onClick={() => setLocation('/contact')}
                style={{ 
                  background: 'transparent', 
                  color: 'rgba(230,238,243,0.9)', 
                  border: '1px solid rgba(255,255,255,0.04)', 
                  padding: '8px 12px', 
                  borderRadius: 8, 
                  cursor: 'pointer',
                  width: '100%',
                  fontSize: 13
                }}>Support</button>
            </div>

            <div style={{ marginTop: 24, padding: 12, borderRadius: 8, background: `linear-gradient(135deg, ${THEME.accent3}20, ${THEME.accent4}20)` }}>
              <div style={{ fontSize: 12, color: 'rgba(230,238,243,0.7)', marginBottom: 4 }}>Loyalty Points</div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>2,450 pts</div>
              <div style={{ fontSize: 11, color: 'rgba(230,238,243,0.6)', marginTop: 4 }}>Bronze Member</div>
            </div>
          </aside>

          <main style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <section style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, padding: 12, borderRadius: 12, background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))' }}>
                <h3 style={{ margin: 0, color: THEME.text }}>Upcoming trips</h3>
                <div style={{ marginTop: 12 }}>
                  {upcomingTrips.length ? upcomingTrips.map(b => (
                    <div key={b.id} data-testid={`upcoming-trip-${b.id}`} style={{ padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.02)' }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{b.tourName}</div>
                        <div style={{ fontSize: 12, color: 'rgba(230,238,243,0.7)' }}>{b.date} • {b.guests} guests</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div style={{ fontWeight: 700 }}>{b.amount}</div>
                        <button 
                          data-testid={`button-download-ticket-${b.id}`}
                          onClick={() => setSelectedBooking(b)}
                          style={{ 
                            background: `linear-gradient(90deg, ${THEME.accent4}, ${THEME.accent1})`,
                            color: '#031428', 
                            padding: '6px 10px', 
                            borderRadius: 6, 
                            border: 'none', 
                            fontWeight: 600, 
                            cursor: 'pointer',
                            fontSize: 12
                          }}>Download ticket</button>
                      </div>
                    </div>
                  )) : <div style={{ padding: 8, color: 'rgba(230,238,243,0.6)' }}>No upcoming trips. <Link href="/tours" style={{ color: THEME.accent4 }}>Book something fun!</Link></div>}
                </div>
              </div>

              <div style={{ width: 280, padding: 12, borderRadius: 12, background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))' }}>
                <h4 style={{ margin: 0, color: THEME.text }}>Wallet</h4>
                <div style={{ marginTop: 8, fontWeight: 700, fontSize: 24, color: THEME.accent3 }}>{fmtVT(walletBalance)}</div>
                <div style={{ fontSize: 12, color: 'rgba(230,238,243,0.6)', marginTop: 4 }}>Available balance</div>
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <button 
                    data-testid="button-topup"
                    onClick={() => {
                      toast({ title: "Top-up", description: "Wallet top-up feature coming soon!" });
                    }}
                    style={{ 
                      background: `linear-gradient(90deg, ${THEME.accent4}, ${THEME.accent1})`,
                      color: '#031428', 
                      padding: '8px 12px', 
                      borderRadius: 8, 
                      border: 'none', 
                      fontWeight: 700, 
                      cursor: 'pointer',
                      flex: 1,
                      fontSize: 13
                    }}>Top-up</button>
                  <button 
                    data-testid="button-withdraw"
                    onClick={() => {
                      toast({ title: "Withdraw", description: "Withdrawal feature coming soon!" });
                    }}
                    style={{ 
                      background: 'transparent', 
                      color: 'rgba(230,238,243,0.9)', 
                      border: '1px solid rgba(255,255,255,0.04)', 
                      padding: '8px 12px', 
                      borderRadius: 8, 
                      cursor: 'pointer',
                      flex: 1,
                      fontSize: 13
                    }}>Withdraw</button>
                </div>
              </div>
            </section>

            <section style={{ padding: 12, borderRadius: 12, background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))' }}>
              <h4 style={{ margin: 0, color: THEME.text }}>Your recent activity</h4>
              <div style={{ marginTop: 8 }}>
                {bookings.length > 0 ? (
                  <Table rows={bookings} onViewTicket={setSelectedBooking} />
                ) : (
                  <div style={{ padding: 20, textAlign: 'center', color: 'rgba(230,238,243,0.5)' }}>
                    No booking history yet. <Link href="/tours" style={{ color: THEME.accent4 }}>Start exploring tours!</Link>
                  </div>
                )}
              </div>
            </section>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ padding: 12, borderRadius: 12, background: `linear-gradient(135deg, ${THEME.accent4}15, ${THEME.accent3}15)`, border: `1px solid ${THEME.accent4}30` }}>
                <h4 style={{ margin: 0, color: THEME.text }}>Saved Tours</h4>
                <div style={{ marginTop: 8, fontSize: 13, color: 'rgba(230,238,243,0.7)' }}>
                  You have <strong style={{ color: THEME.accent2 }}>5 tours</strong> saved in your wishlist
                </div>
                <button 
                  data-testid="button-view-wishlist"
                  onClick={() => setLocation('/dashboard/saved')}
                  style={{ 
                    marginTop: 12,
                    background: 'rgba(255,255,255,0.05)', 
                    color: THEME.text, 
                    padding: '8px 12px', 
                    borderRadius: 8, 
                    border: 'none', 
                    cursor: 'pointer',
                    fontSize: 12
                  }}>View Wishlist</button>
              </div>

              <div style={{ padding: 12, borderRadius: 12, background: `linear-gradient(135deg, ${THEME.accent1}15, ${THEME.accent2}15)`, border: `1px solid ${THEME.accent1}30` }}>
                <h4 style={{ margin: 0, color: THEME.text }}>Need Help?</h4>
                <div style={{ marginTop: 8, fontSize: 13, color: 'rgba(230,238,243,0.7)' }}>
                  Have questions about your booking or need to make changes?
                </div>
                <Link href="/contact">
                  <button 
                    data-testid="button-contact-support"
                    style={{ 
                      marginTop: 12,
                      background: 'rgba(255,255,255,0.05)', 
                      color: THEME.text, 
                      padding: '8px 12px', 
                      borderRadius: 8, 
                      border: 'none', 
                      cursor: 'pointer',
                      fontSize: 12
                    }}>Contact Support</button>
                </Link>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
