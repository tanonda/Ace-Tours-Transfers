import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

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

function Topbar({ title }: { title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: THEME.text }}>{title}</h2>
        <div style={{ opacity: 0.7, fontSize: 13 }}>v1.0 • Popsy</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button style={{ padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: `linear-gradient(90deg, ${THEME.accent4}, ${THEME.accent1})`, color: '#031428', fontWeight: 600 }}>Book Now</button>
        <div style={{ width: 36, height: 36, borderRadius: 999, background: THEME.accent3, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#07203b', fontWeight: 700 }}>J</div>
      </div>
    </div>
  );
}

function Table({ rows }: { rows: any[] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead style={{ textAlign: 'left', color: 'rgba(230,238,243,0.7)' }}>
        <tr>
          <th style={{ padding: 8 }}>ID</th>
          <th style={{ padding: 8 }}>Tour</th>
          <th style={{ padding: 8 }}>Date</th>
          <th style={{ padding: 8 }}>Amount</th>
          <th style={{ padding: 8 }}>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.id || i} style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
            <td style={{ padding: 8, color: 'rgba(230,238,243,0.85)' }}>#{r.id}</td>
            <td style={{ padding: 8, color: 'rgba(230,238,243,0.85)' }}>{r.route || r.tour}</td>
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
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const fallbackBookings = [
  { id: '1001', route: 'Efate Island Tour', date: '2024-12-01', amount: '15,000 VT', status: 'Paid' },
  { id: '1002', route: 'Airport Transfer', date: '2024-12-05', amount: '5,500 VT', status: 'Paid' },
  { id: '1003', route: 'Hideaway Island Snorkel', date: '2024-12-10', amount: '12,000 VT', status: 'Pending' },
  { id: '1004', route: 'Mele Cascades Tour', date: '2024-12-15', amount: '18,000 VT', status: 'Paid' },
];

const upcomingTrips = [
  { id: '1003', route: 'Hideaway Island Snorkel', date: 'Dec 10, 2024', time: '09:00 AM', amount: '12,000 VT', status: 'Confirmed' },
  { id: '1005', route: 'Blue Lagoon Day Trip', date: 'Dec 20, 2024', time: '08:30 AM', amount: '22,000 VT', status: 'Confirmed' },
];

export default function CustomerDashboard() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      background: `linear-gradient(180deg, ${THEME.bg}, ${THEME.surface})`, 
      color: THEME.text, 
      fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 18 }}>
        <Topbar title="Customer — Ace Tours" />

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16 }}>
          <aside style={{ padding: 12, borderRadius: 12, background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))' }}>
            <div style={{ fontWeight: 800, color: THEME.text, marginBottom: 8 }}>Welcome, James</div>
            <div style={{ fontSize: 13, color: 'rgba(230,238,243,0.7)' }}>Member since 2022</div>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link href="/tours">
                <button style={{ 
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
              <button style={{ 
                background: 'transparent', 
                color: 'rgba(230,238,243,0.9)', 
                border: '1px solid rgba(255,255,255,0.04)', 
                padding: '8px 12px', 
                borderRadius: 8, 
                cursor: 'pointer',
                width: '100%',
                fontSize: 13
              }}>My Bookings</button>
              <button style={{ 
                background: 'transparent', 
                color: 'rgba(230,238,243,0.9)', 
                border: '1px solid rgba(255,255,255,0.04)', 
                padding: '8px 12px', 
                borderRadius: 8, 
                cursor: 'pointer',
                width: '100%',
                fontSize: 13
              }}>Payments</button>
              <button style={{ 
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
                    <div key={b.id} style={{ padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.02)' }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{b.route}</div>
                        <div style={{ fontSize: 12, color: 'rgba(230,238,243,0.7)' }}>{b.date} • {b.time}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div style={{ fontWeight: 700 }}>{b.amount}</div>
                        <button style={{ 
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
                  )) : <div style={{ padding: 8, color: 'rgba(230,238,243,0.6)' }}>No upcoming trips. Book something fun!</div>}
                </div>
              </div>

              <div style={{ width: 280, padding: 12, borderRadius: 12, background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))' }}>
                <h4 style={{ margin: 0, color: THEME.text }}>Wallet</h4>
                <div style={{ marginTop: 8, fontWeight: 700, fontSize: 24, color: THEME.accent3 }}>{fmtVT(52300)}</div>
                <div style={{ fontSize: 12, color: 'rgba(230,238,243,0.6)', marginTop: 4 }}>Available balance</div>
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <button style={{ 
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
                  <button style={{ 
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
                <Table rows={fallbackBookings} />
              </div>
            </section>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ padding: 12, borderRadius: 12, background: `linear-gradient(135deg, ${THEME.accent4}15, ${THEME.accent3}15)`, border: `1px solid ${THEME.accent4}30` }}>
                <h4 style={{ margin: 0, color: THEME.text }}>Saved Tours</h4>
                <div style={{ marginTop: 8, fontSize: 13, color: 'rgba(230,238,243,0.7)' }}>
                  You have <strong style={{ color: THEME.accent2 }}>5 tours</strong> saved in your wishlist
                </div>
                <button style={{ 
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
                  <button style={{ 
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
