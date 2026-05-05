import { useState, useEffect } from 'react';
import { Clock, Upload, CheckCircle, Eye, AlertTriangle, Download, Filter } from 'lucide-react';
import { api } from '../utils/api';
import { downloadBlob, generateAuditCSV } from '../utils/downloadUtils';

const typeConfig = {
  upload: { icon: Upload, color: 'cyan', dotClass: 'upload' },
  action: { icon: Eye, color: 'purple', dotClass: 'action' },
  approval: { icon: CheckCircle, color: 'green', dotClass: 'approval' },
  alert: { icon: AlertTriangle, color: 'yellow', dotClass: 'alert' },
};

export default function AuditTrail() {
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('all');
  const [filterUser, setFilterUser] = useState('all');

  useEffect(() => {
    const fetchAudit = async () => {
      try {
        const data = await api.getAuditLog();
        setAuditLog(data);
      } catch (error) {
        console.error("Error fetching audit log:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAudit();
  }, []);

  const handleExport = () => {
    const csv = generateAuditCSV(filtered);
    downloadBlob(csv, `CRPF_Audit_Trail_${new Date().toISOString().slice(0,10)}.csv`, 'text/csv');
  };

  const filtered = auditLog.filter(log => {
    if (filterAction !== 'all' && log.type !== filterAction) return false;
    if (filterUser !== 'all' && log.user !== filterUser) return false;
    return true;
  });

  const users = [...new Set(auditLog.map(l => l.user))];

  if (loading) return <div className="fade-in" style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>Loading Audit Trail...</div>;

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="section-title">Immutable Audit Trail</div>
            <div className="section-subtitle">Every action is timestamped and traceable — CAG/RTI compliant</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={handleExport}><Download size={14}/> Export CSV</button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <Filter size={16} style={{ color: '#64748b' }} />
        <select className="filter-select" value={filterAction} onChange={e => setFilterAction(e.target.value)}>
          <option value="all">All Actions</option>
          <option value="upload">Uploads</option>
          <option value="action">AI Actions</option>
          <option value="approval">Approvals</option>
          <option value="alert">Overrides</option>
        </select>
        <select className="filter-select" value={filterUser} onChange={e => setFilterUser(e.target.value)}>
          <option value="all">All Users</option>
          {users.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{filtered.length} entries</span>
      </div>

      {/* Timeline */}
      <div className="card">
        <div className="timeline">
          {filtered.map(log => {
            const config = typeConfig[log.type] || typeConfig.action;
            const Icon = config.icon;
            return (
              <div className="timeline-item" key={log.id}>
                <div className={`timeline-dot ${config.dotClass}`} />
                <div className="timeline-content">
                  <div className="timeline-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className={`stat-icon ${config.color}`} style={{ width: 28, height: 28 }}>
                        <Icon size={12} />
                      </div>
                      <span className="timeline-title">{log.user}</span>
                      <span className={`badge badge-${config.color}`}>{log.action}</span>
                    </div>
                    <span className="timeline-time">
                      <Clock size={10} style={{ marginRight: 4 }} />
                      {new Date(log.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="timeline-desc">{log.details}</div>
                  <div style={{ marginTop: 6, fontSize: '0.7rem', color: '#64748b' }}>
                    Entity: <span style={{ color: '#818cf8' }}>{log.entity}</span> • Log ID: <span style={{ fontFamily: 'JetBrains Mono' }}>{log.id}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-title">No matching audit entries</div>
            <div className="empty-state-desc">Try adjusting your filters.</div>
          </div>
        )}
      </div>
    </div>
  );
}
