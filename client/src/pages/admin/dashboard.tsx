import { DashboardLayout } from "@/components/dashboard-layout";
import { useQuery } from "@tanstack/react-query";
import { fetchBookings, fetchBookingStats, fetchRevenue, fetchTours } from "@/lib/api";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut, Pie } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

const THEME = {
  accent1: '#FF6B6B',
  accent2: '#FFD93D',
  accent3: '#6BCB77',
  accent4: '#4D96FF',
  bg: '#0f1724',
  surface: '#0b1220',
  text: '#E6EEF3'
};

const fmtVT = (n?: number) => (n == null ? '-' : '$' + n.toLocaleString('en-US'));

function KPI({ label, value, delta, iconBg }: { label: string; value: string | number; delta?: string; iconBg?: string }) {
  return (
    <div data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, '-')}`} style={{ 
      padding: 16, 
      borderRadius: 12, 
      background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
      border: '1px solid rgba(255,255,255,0.06)',
      minWidth: 180,
      flex: 1
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 13, color: 'rgba(230,238,243,0.7)', fontWeight: 500 }}>{label}</div>
        <div style={{ 
          width: 38, 
          height: 38, 
          borderRadius: 10, 
          background: iconBg, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          fontWeight: 700,
          fontSize: 14,
          color: '#0f1724'
        }}>{label[0]}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <div style={{ fontSize: 26, fontWeight: 700, color: THEME.text }}>{value}</div>
        {delta && <div style={{ fontSize: 13, fontWeight: 600, color: delta.startsWith('+') ? THEME.accent3 : THEME.accent1 }}>{delta}</div>}
      </div>
    </div>
  );
}

function BookingsTable({ rows }: { rows: any[] }) {
  const getStatusColor = (status: string) => {
    switch(status.toLowerCase()) {
      case 'confirmed': return { bg: 'rgba(107,203,119,0.15)', text: THEME.accent3 };
      case 'pending': return { bg: 'rgba(255,217,61,0.15)', text: THEME.accent2 };
      case 'completed': return { bg: 'rgba(77,150,255,0.15)', text: THEME.accent4 };
      case 'cancelled': return { bg: 'rgba(255,107,107,0.15)', text: THEME.accent1 };
      default: return { bg: 'rgba(255,255,255,0.1)', text: THEME.text };
    }
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'rgba(230,238,243,0.6)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <th style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>ID</th>
            <th style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Customer</th>
            <th style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Route</th>
            <th style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Date</th>
            <th style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Amount</th>
            <th style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Status</th>
            <th style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const statusColors = getStatusColor(r.status);
            return (
              <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <td style={{ padding: '14px 16px', color: THEME.text, fontSize: 13 }}>#{r.id.slice(0, 6)}</td>
                <td style={{ padding: '14px 16px', color: THEME.text, fontWeight: 500 }}>{r.customerName}</td>
                <td style={{ padding: '14px 16px', color: 'rgba(230,238,243,0.8)' }}>{r.tourName}</td>
                <td style={{ padding: '14px 16px', color: 'rgba(230,238,243,0.7)' }}>{new Date(r.date).toLocaleDateString()}</td>
                <td style={{ padding: '14px 16px', color: THEME.text, fontWeight: 600 }}>{r.amount}</td>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{ 
                    padding: '4px 10px', 
                    borderRadius: 6, 
                    fontSize: 12, 
                    fontWeight: 600,
                    background: statusColors.bg,
                    color: statusColors.text
                  }}>
                    {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                  </span>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <button style={{ 
                    padding: '6px 12px', 
                    borderRadius: 6, 
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'transparent',
                    color: THEME.text,
                    fontSize: 12,
                    cursor: 'pointer'
                  }}>View</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const chartPalette = [THEME.accent4, THEME.accent1, THEME.accent3, THEME.accent2];

const commonOptions = {
  plugins: {
    legend: { position: 'bottom' as const, labels: { color: THEME.text, padding: 16, font: { size: 12 } } },
    tooltip: { mode: 'index' as const }
  },
  maintainAspectRatio: false,
  scales: {
    x: { 
      grid: { color: 'rgba(255,255,255,0.03)' },
      ticks: { color: 'rgba(230,238,243,0.5)', font: { size: 11 } }
    },
    y: { 
      grid: { color: 'rgba(255,255,255,0.03)' },
      ticks: { color: 'rgba(230,238,243,0.5)', font: { size: 11 } }
    }
  }
};

const pieOptions = {
  plugins: {
    legend: { position: 'right' as const, labels: { color: THEME.text, padding: 12, font: { size: 12 } } }
  },
  maintainAspectRatio: false
};

export default function AdminDashboard() {
  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings"],
    queryFn: fetchBookings,
  });

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: fetchBookingStats,
  });

  const { data: revenue = [] } = useQuery({
    queryKey: ["revenue"],
    queryFn: fetchRevenue,
  });

  const { data: tours = [] } = useQuery({
    queryKey: ["tours"],
    queryFn: fetchTours,
  });

  const recentBookings = bookings.slice(0, 8);
  const totalRevenue = revenue.reduce((sum, month) => sum + month.total, 0);

  const revenueChartData = {
    labels: revenue.map(r => r.month),
    datasets: [
      {
        label: 'Revenue',
        data: revenue.map(r => r.total),
        fill: true,
        tension: 0.4,
        backgroundColor: 'rgba(77,150,255,0.15)',
        borderColor: THEME.accent4,
        pointRadius: 3,
        pointBackgroundColor: THEME.accent4
      }
    ]
  };

  const bookingsChartData = {
    labels: ['Confirmed', 'Pending', 'Completed'],
    datasets: [
      {
        data: [stats?.confirmed || 0, stats?.pending || 0, stats?.completed || 0],
        backgroundColor: [THEME.accent3, THEME.accent2, THEME.accent4],
        hoverOffset: 8,
        borderWidth: 0
      }
    ]
  };

  const tourCategoryData = {
    labels: tours.map(t => t.title.split(' ')[0]),
    datasets: [
      {
        label: 'Tours',
        data: tours.map(() => Math.floor(Math.random() * 50) + 10),
        backgroundColor: THEME.accent2,
        borderRadius: 8
      }
    ]
  };

  return (
    <DashboardLayout type="admin">
      <div style={{ 
        background: THEME.bg, 
        minHeight: '100vh', 
        padding: '24px',
        color: THEME.text
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: THEME.text }}>Admin Dashboard</h1>
            <p style={{ margin: '4px 0 0', color: 'rgba(230,238,243,0.6)', fontSize: 14 }}>Welcome back! Here's your business overview.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input 
              placeholder="Search bookings, users..." 
              style={{ 
                padding: '10px 16px', 
                borderRadius: 8, 
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.03)',
                color: THEME.text,
                minWidth: 240,
                fontSize: 13
              }} 
            />
            <div style={{ 
              width: 40, 
              height: 40, 
              borderRadius: 10, 
              background: THEME.accent4, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: '#0f1724', 
              fontWeight: 700,
              fontSize: 14
            }}>AT</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <KPI label="Revenue" value={fmtVT(totalRevenue)} delta="+12%" iconBg={THEME.accent1} />
          <KPI label="Bookings" value={stats?.total || 0} delta="+8%" iconBg={THEME.accent4} />
          <KPI label="Active Tours" value={tours.length} delta="+2" iconBg={THEME.accent3} />
          <KPI label="Pending" value={stats?.pending || 0} iconBg={THEME.accent2} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
          <div style={{ 
            padding: 20, 
            borderRadius: 12, 
            background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
            border: '1px solid rgba(255,255,255,0.06)'
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: THEME.text }}>Revenue Overview</h3>
            <div style={{ height: 280 }}>
              <Line data={revenueChartData} options={commonOptions} />
            </div>
          </div>

          <div style={{ 
            padding: 20, 
            borderRadius: 12, 
            background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
            border: '1px solid rgba(255,255,255,0.06)'
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: THEME.text }}>Booking Status</h3>
            <div style={{ height: 280 }}>
              <Doughnut data={bookingsChartData} options={{ ...pieOptions, cutout: '65%' }} />
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div style={{ 
            padding: 20, 
            borderRadius: 12, 
            background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
            border: '1px solid rgba(255,255,255,0.06)'
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: THEME.text }}>Tours by Popularity</h3>
            <div style={{ height: 220 }}>
              <Bar data={tourCategoryData} options={commonOptions} />
            </div>
          </div>

          <div style={{ 
            padding: 20, 
            borderRadius: 12, 
            background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
            border: '1px solid rgba(255,255,255,0.06)'
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: THEME.text }}>System Health</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, height: 220 }}>
              <div style={{ width: 160, height: 160 }}>
                <Doughnut 
                  data={{
                    labels: ['Healthy', 'Warning'],
                    datasets: [{
                      data: [95, 5],
                      backgroundColor: [THEME.accent3, THEME.accent2],
                      borderWidth: 0
                    }]
                  }} 
                  options={{ cutout: '75%', plugins: { legend: { display: false } } }} 
                />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 28, color: THEME.accent3 }}>99.9%</div>
                <div style={{ color: 'rgba(230,238,243,0.7)', fontSize: 13, marginTop: 4 }}>Uptime</div>
                <div style={{ marginTop: 16, fontSize: 13, color: 'rgba(230,238,243,0.6)' }}>
                  <div>API Response: ~120ms</div>
                  <div style={{ marginTop: 4 }}>DB Connections: Active</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ 
          padding: 20, 
          borderRadius: 12, 
          background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
          border: '1px solid rgba(255,255,255,0.06)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: THEME.text }}>Recent Bookings</h3>
            <button style={{ 
              padding: '8px 16px', 
              borderRadius: 8, 
              border: 'none',
              background: THEME.accent4,
              color: '#0f1724',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}>View All</button>
          </div>
          {recentBookings.length > 0 ? (
            <BookingsTable rows={recentBookings} />
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: 'rgba(230,238,243,0.5)' }}>
              No bookings yet. Create your first booking to see it here.
            </div>
          )}
        </div>

        <div style={{ 
          marginTop: 24, 
          padding: 16, 
          borderRadius: 12, 
          background: 'rgba(77,150,255,0.08)',
          border: '1px solid rgba(77,150,255,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontWeight: 600, color: THEME.text }}>Quick Actions</div>
            <div style={{ fontSize: 13, color: 'rgba(230,238,243,0.6)', marginTop: 4 }}>Create bookings, manage tours, and more</div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button style={{ 
              padding: '10px 20px', 
              borderRadius: 8, 
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent',
              color: THEME.text,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer'
            }}>New Booking</button>
            <button style={{ 
              padding: '10px 20px', 
              borderRadius: 8, 
              border: 'none',
              background: THEME.accent3,
              color: '#0f1724',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}>Send Invoice</button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
