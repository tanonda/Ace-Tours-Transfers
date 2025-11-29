import { useQuery } from "@tanstack/react-query";
import { fetchBookings, fetchBookingStats, fetchTours } from "@/lib/api";
import { useState } from "react";
import { Link, useLocation } from "wouter";

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

function Topbar({ title, showSearch = true }: { title: string; showSearch?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: THEME.text }}>{title}</h2>
        <div style={{ opacity: 0.7, fontSize: 13 }}>v1.0 • Popsy analytics</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {showSearch && <input placeholder="Search bookings, users, routes..." style={{ padding: '8px 12px', borderRadius: 8, border: 'none', minWidth: 220, background: 'rgba(255,255,255,0.05)', color: THEME.text }} />}
        <button style={{ padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', color: THEME.text }}>Toggle</button>
        <div style={{ width: 36, height: 36, borderRadius: 999, background: THEME.accent4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#07203b', fontWeight: 700 }}>M</div>
      </div>
    </div>
  );
}

function Sidebar() {
  const [location] = useLocation();
  const items = [
    { label: 'Overview', href: '/admin/dashboard' },
    { label: 'Bookings', href: '/admin/bookings' },
    { label: 'Tours', href: '/admin/tours' },
    { label: 'Customers', href: '/admin/customers' },
    { label: 'Settings', href: '/admin/settings' },
  ];

  return (
    <aside style={{ width: 220, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 8, background: THEME.accent1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#201114', fontWeight: 800 }}>AT</div>
        <div>
          <div style={{ color: THEME.text, fontWeight: 700 }}>Ace Tours</div>
          <div style={{ color: 'rgba(230,238,243,0.6)', fontSize: 12 }}>Admin Panel</div>
        </div>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
        {items.map(it => (
          <Link key={it.label} href={it.href}>
            <button 
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
          <button style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: 999, cursor: 'pointer', border: 'none', color: THEME.text, fontSize: 12 }}>New Booking</button>
          <button style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: 999, cursor: 'pointer', border: 'none', color: THEME.text, fontSize: 12 }}>Send Invoice</button>
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

function Table({ rows }: { rows: any[] }) {
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
          <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
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
              <button style={{ 
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

  const recentBookings = bookings.slice(0, 10);
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
      <div style={{ display: 'flex', gap: 16, padding: 18 }}>
        <Sidebar />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Topbar title="Admin — Ace Tours" showSearch={true} />
            
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
                        <Table rows={recentBookings} />
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
                    <select style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: 'none', color: THEME.text, flex: 1 }}>
                      <option>All statuses</option>
                      <option>Confirmed</option>
                      <option>Pending</option>
                      <option>Cancelled</option>
                    </select>
                    <input type="date" style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: 'none', color: THEME.text }} />
                  </div>
                </div>

                <div style={{ padding: 12, borderRadius: 12, background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))' }}>
                  <h4 style={{ margin: 0, color: THEME.text }}>Notifications</h4>
                  <ul style={{ marginTop: 8, paddingLeft: 16, color: 'rgba(230,238,243,0.85)', fontSize: 13 }}>
                    <li style={{ marginBottom: 6 }}>
                      <span style={{ color: THEME.accent3 }}>New booking</span> #1007 — Paid
                    </li>
                    <li style={{ marginBottom: 6 }}>
                      <span style={{ color: THEME.accent1 }}>Payment failure</span> on invoice #989
                    </li>
                    <li>
                      <span style={{ color: THEME.accent4 }}>Server patch</span> available
                    </li>
                  </ul>
                </div>

                <div style={{ padding: 12, borderRadius: 12, background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))' }}>
                  <h4 style={{ margin: 0, color: THEME.text }}>Shortcuts</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                    <button style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: 999, cursor: 'pointer', border: 'none', color: THEME.text, fontSize: 12 }}>Export CSV</button>
                    <button style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: 999, cursor: 'pointer', border: 'none', color: THEME.text, fontSize: 12 }}>Create Promo</button>
                    <button style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: 999, cursor: 'pointer', border: 'none', color: THEME.text, fontSize: 12 }}>Manage Seats</button>
                  </div>
                </div>

                <div style={{ padding: 12, borderRadius: 12, background: `linear-gradient(135deg, ${THEME.accent4}20, ${THEME.accent1}20)`, border: `1px solid ${THEME.accent4}30` }}>
                  <h4 style={{ margin: 0, color: THEME.text }}>Pro Tip</h4>
                  <p style={{ margin: '8px 0 0', fontSize: 13, color: 'rgba(230,238,243,0.7)' }}>
                    Use keyboard shortcuts: <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>Ctrl+K</kbd> to search
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
