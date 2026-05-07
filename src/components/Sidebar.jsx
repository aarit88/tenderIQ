import { FileText, Users, CheckSquare, Clock, LayoutDashboard, Upload, UserCheck, ClipboardCheck, Shield } from 'lucide-react';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tenders', label: 'Tender Upload', icon: Upload },
  { id: 'bidders', label: 'Bidder Docs', icon: Users },
  { id: 'evaluation', label: 'Evaluation', icon: ClipboardCheck },
  { id: 'consolidated', label: 'Summary Report', icon: FileText },
  { id: 'audit', label: 'Audit Trail', icon: Clock },
];

export default function Sidebar({ activePage, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <div className="logo-icon">
             <Shield size={28} color="#6366f1" />
          </div>
          <div className="logo-text">
            <span className="logo-name">CRPF TenderIQ</span>
            <span className="logo-tagline">AI Procurement</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-title">Main Menu</div>
        {navItems.map(item => (
          <button
            key={item.id}
            className={`nav-item ${activePage === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <item.icon size={18} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="user-avatar">CP</div>
          <div className="user-info">
            <span className="user-name">CRPF Officer</span>
            <span className="user-role">Evaluation Committee</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
