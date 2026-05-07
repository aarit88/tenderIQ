import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import TenderUpload from './pages/TenderUpload';
import BidderManagement from './pages/BidderManagement';
import Evaluation from './pages/Evaluation';
import AuditTrail from './pages/AuditTrail';

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <Dashboard onNavigate={setActivePage} search={searchQuery} />;
      case 'tenders': return <TenderUpload search={searchQuery} />;
      case 'bidders': return <BidderManagement search={searchQuery} />;
      case 'evaluation': return <Evaluation search={searchQuery} />;
      case 'audit': return <AuditTrail search={searchQuery} />;
      default: return <Dashboard onNavigate={setActivePage} search={searchQuery} />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <div className="main-area">
        <Header activePage={activePage} onSearch={setSearchQuery} />
        <main className="page-content">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
