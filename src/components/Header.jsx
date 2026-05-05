import { useState, useEffect } from 'react';
import { Search, Bell, Clock, AlertTriangle, FileText, CheckCircle } from 'lucide-react';
import { api } from '../utils/api';

const pageTitles = {
  dashboard: 'Dashboard',
  tenders: 'Tender Upload',
  bidders: 'Bidder Documents',
  evaluation: 'Eligibility Analysis',
  audit: 'Audit Trail',
};

export default function Header({ activePage, onSearch }) {
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const fetchNotifs = async () => {
      try {
        const logs = await api.getAuditLog();
        setNotifications(logs.slice(0, 5));
      } catch (err) {
        console.error(err);
      }
    };
    fetchNotifs();
  }, []);

  return (
    <header className="header">
      <div className="header-left">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 className="page-title">{pageTitles[activePage] || 'Dashboard'}</h1>
          <span className="badge badge-red" style={{ fontSize: '0.6rem', letterSpacing: '0.05em' }}>OFFICIAL USE ONLY</span>
        </div>
      </div>
      <div className="header-right">
        <div className="security-badge">
          <div className="security-status">
            <div className="status-dot pulse-red"></div>
            <span>RESTRICTED ACCESS</span>
          </div>
          <div className="security-label">CRPF CLASSIFIED // LEVEL 3</div>
        </div>
        <div className="search-box">
          <Search size={16} />
          <input 
            type="text" 
            placeholder="Search..." 
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
        <div style={{ position: 'relative' }}>
          <button className="icon-btn" onClick={() => setShowNotifs(!showNotifs)}>
            <Bell size={18} />
            <span className="notif-badge">{notifications.length}</span>
          </button>
          
          {showNotifs && (
            <div className="notif-dropdown card fade-in">
              <div className="notif-header">Notifications</div>
              <div className="notif-list">
                {notifications.map((n, i) => (
                  <div key={i} className="notif-item">
                    <div className="notif-icon-box">
                      {n.type === 'upload' ? <FileText size={12}/> : n.type === 'approval' ? <CheckCircle size={12}/> : <Clock size={12}/>}
                    </div>
                    <div className="notif-content">
                      <div className="notif-text">{n.details}</div>
                      <div className="notif-time">{new Date(n.timestamp).toLocaleTimeString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
