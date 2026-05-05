import { useState, useEffect } from 'react';
import { FileText, Users, CheckCircle, AlertTriangle, ArrowUpRight, ArrowDownRight, Upload, Eye } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { api } from '../utils/api';
import { dashboardStats, evaluationSummary, weeklyActivity } from '../data/mockData';

const statusColors = { evaluated: 'badge-green', in_review: 'badge-yellow', extracting: 'badge-cyan', pending: 'badge-gray' };
const statusLabels = { evaluated: 'Eligible', in_review: 'In Review', extracting: 'Extracting', pending: 'Pending' };

export default function Dashboard({ onNavigate, search }) {
  const [tenders, setTenders] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tendersData, auditData] = await Promise.all([
          api.getTenders(),
          api.getAuditLog()
        ]);
        setTenders(tendersData);
        setAuditLog(auditData);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="fade-in" style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>Loading CRPF Dashboard...</div>;

  const filteredTenders = tenders.filter(t => 
    t.title.toLowerCase().includes((search || '').toLowerCase()) || 
    t.department.toLowerCase().includes((search || '').toLowerCase())
  );

  return (
    <div className="fade-in">
      {/* Stats Grid */}
      <div className="stats-grid">
        <StatCard icon={<FileText size={20}/>} color="purple" label="Active Tenders" value={tenders.length} change="+2" trend="up" />
        <StatCard icon={<Users size={20}/>} color="cyan" label="Bidders Evaluated" value="10" change="+12%" trend="up" />
        <StatCard icon={<CheckCircle size={20}/>} color="green" label="Clearly Eligible" value="6" change="+5" trend="up" />
        <StatCard icon={<AlertTriangle size={20}/>} color="yellow" label="Review Flagged" value="1" change="-2" trend="down" />
      </div>

      {/* Charts Row */}
      <div className="grid-3">
        <div className="card">
          <div className="section-header">
            <div><div className="section-title">Weekly Activity</div><div className="section-subtitle">Uploads & Evaluations</div></div>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyActivity} barGap={4}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12, color: '#f1f5f9' }} />
                <Bar dataKey="uploads" fill="#6366f1" radius={[4,4,0,0]} name="Uploads" />
                <Bar dataKey="evaluations" fill="#06b6d4" radius={[4,4,0,0]} name="Evaluations" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="section-header">
            <div><div className="section-title">Confidence Distribution</div><div className="section-subtitle">AI Match Quality</div></div>
          </div>
          <div className="chart-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PieChart width={200} height={200}>
              <Pie data={evaluationSummary} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value">
                {evaluationSummary.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12, color: '#f1f5f9' }} />
            </PieChart>
            <div style={{ marginLeft: 16 }}>
              {evaluationSummary.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{item.name}: {item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tenders & Activity */}
      <div className="grid-2">
        <div className="card">
          <div className="section-header">
            <div><div className="section-title">Recent Tenders</div></div>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('tenders')}>View All</button>
          </div>
          <div className="table-container">
            <table>
              <thead><tr><th>Tender</th><th>Department</th><th>Status</th><th>Value</th></tr></thead>
              <tbody>
                {filteredTenders.map(t => (
                  <tr key={t.id}>
                    <td><div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.8rem' }}>{t.title}</div><div style={{ fontSize: '0.7rem', color: '#64748b' }}>{t.id}</div></td>
                    <td style={{ fontSize: '0.8rem' }}>{t.department}</td>
                    <td><span className={`badge ${statusColors[t.status]}`}>{statusLabels[t.status]}</span></td>
                    <td style={{ fontSize: '0.85rem' }}>{t.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="section-header">
            <div><div className="section-title">Recent Activity</div></div>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('audit')}>View All</button>
          </div>
          {auditLog.slice(0, 5).map(log => (
            <div className="activity-item" key={log.id}>
              <div className={`activity-icon ${log.type === 'upload' ? 'stat-icon cyan' : log.type === 'approval' ? 'stat-icon green' : log.type === 'alert' ? 'stat-icon yellow' : 'stat-icon purple'}`}>
                {log.type === 'upload' ? <Upload size={14}/> : log.type === 'approval' ? <CheckCircle size={14}/> : <Eye size={14}/>}
              </div>
              <div>
                <div className="activity-text"><strong>{log.user}</strong> — {log.action}</div>
                <div className="activity-time">{new Date(log.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, color, label, value, change, trend }) {
  return (
    <div className="stat-card">
      <div className="stat-header">
        <div className={`stat-icon ${color}`}>{icon}</div>
        <span className={`stat-change ${trend}`}>
          {trend === 'up' ? <ArrowUpRight size={12}/> : <ArrowDownRight size={12}/>} {change}
        </span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
