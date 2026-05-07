import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import TenderUpload from './pages/TenderUpload';
import BidderManagement from './pages/BidderManagement';
import Evaluation from './pages/Evaluation';
import AuditTrail from './pages/AuditTrail';
import ConsolidatedReport from './pages/ConsolidatedReport';

function MainApp() {
  const [activePage, setActivePage] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBidderId, setSelectedBidderId] = useState(null);

  const viewEvidence = (bidderId) => {
    setSelectedBidderId(bidderId);
    setActivePage('evaluation');
  };

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <Dashboard onNavigate={setActivePage} search={searchQuery} />;
      case 'tenders': return <TenderUpload search={searchQuery} />;
      case 'bidders': return <BidderManagement search={searchQuery} onViewEvidence={viewEvidence} />;
      case 'evaluation': return <Evaluation search={searchQuery} preSelectedBidderId={selectedBidderId} />;
      case 'consolidated': return <ConsolidatedReport />;
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

export default function App() {
  const [progress, setProgress] = useState(0);
  const [landingDone, setLandingDone] = useState(false);

  const handleScroll = (e) => {
    if (landingDone) return;
    const scrollTop = e.target.scrollTop;
    const maxScroll = window.innerHeight * 0.7; // scroll 70% of screen to fully fade
    const progress = Math.min(scrollTop / maxScroll, 1);
    setProgress(progress);
    
    if (progress === 1) {
      setLandingDone(true);
    }
  };

  const opacity = 1 - Math.pow(progress, 2);
  const titleTranslateY = progress * 100;

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 1 }}>
        <MainApp />
      </div>

      {!landingDone && (
        <div 
          className="landing-scroll-wrapper" 
          onScroll={handleScroll}
          style={{ 
            position: 'fixed', inset: 0, zIndex: 1000, 
            overflowY: 'auto',
            background: 'transparent',
            pointerEvents: progress >= 1 ? 'none' : 'auto'
          }}
        >
          <div style={{ height: '200vh' }}>
            <div 
              style={{ 
                position: 'sticky', top: 0, height: '100vh', 
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: `rgba(10, 14, 26, ${1 - progress})`,
                opacity: 1 - progress,
                overflow: 'hidden'
              }}
            >
                <h1 className="hero-title">CRPF TenderIQ</h1>
                <p 
                  style={{ 
                    color: 'var(--text-secondary)', 
                    fontSize: '1.2rem', 
                    marginTop: '16px',
                    fontWeight: 500,
                    maxWidth: '600px',
                    opacity: Math.max(0, 1 - progress * 2)
                  }}
                >
                  Explainable AI-Powered Procurement Assistant
                </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
