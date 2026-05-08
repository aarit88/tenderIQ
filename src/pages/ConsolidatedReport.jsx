import { useState, useEffect } from 'react';
import { FileText, CheckCircle, XCircle, AlertTriangle, Download, ShieldCheck, Users, Search } from 'lucide-react';
import { api } from '../utils/api';

export default function ConsolidatedReport() {
  const [tenders, setTenders] = useState([]);
  const [selectedTender, setSelectedTender] = useState('');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSigning, setIsSigning] = useState(false);
  const [comparingBidders, setComparingBidders] = useState([]);

  useEffect(() => {
    api.getTenders()
      .then(data => {
        setTenders(data);
        if (data.length > 0) setSelectedTender(data[0].id);
      })
      .catch(error => {
        console.error("Error fetching tenders:", error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const fetchSummary = async () => {
    if (!selectedTender) return;
    const data = await api.getTenderSummary(selectedTender);
    setSummary(data);
  };

  useEffect(() => {
    fetchSummary();
  }, [selectedTender]);

  const handleSignOff = async () => {
    const officer = prompt("Enter Officer Name for Digital Sign-off:");
    if (!officer) return;
    
    setIsSigning(true);
    try {
      await api.signTender(selectedTender, officer);
      await fetchSummary();
      alert("Evaluation Report signed and finalized.");
    } catch (error) {
      alert("Sign-off failed.");
    } finally {
      setIsSigning(false);
    }
  };

  const toggleComparison = (bidderId) => {
    setComparingBidders(prev => 
      prev.includes(bidderId) ? prev.filter(id => id !== bidderId) : [...prev, bidderId].slice(-2)
    );
  };

  if (loading) return <div className="fade-in" style={{ padding: 40 }}>Loading Tenders...</div>;

  return (
    <div className="fade-in">
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="section-title">Consolidated Procurement Report</div>
            <div className="section-subtitle">Official decision-making dashboard for CRPF committees</div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <select 
              className="filter-select" 
              value={selectedTender} 
              onChange={e => setSelectedTender(e.target.value)}
            >
              {tenders.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            {summary?.is_signed ? (
              <div className="badge badge-green" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={16}/> SIGNED BY {summary.signed_by}
              </div>
            ) : (
              <button className="btn btn-primary" onClick={handleSignOff} disabled={isSigning}>
                <ShieldCheck size={16}/> Digital Sign-off
              </button>
            )}
          </div>
        </div>
      </div>

      {summary && (
        <>
          {/* Comparison Overlay */}
          {comparingBidders.length === 2 && (
            <div className="card" style={{ marginBottom: 24, border: '2px solid #6366f1', background: 'rgba(99, 102, 241, 0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <div className="section-title" style={{ fontSize: '1rem' }}>Side-by-Side Comparison</div>
                <button className="btn btn-sm btn-secondary" onClick={() => setComparingBidders([])}>Close Comparison</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {comparingBidders.map(id => {
                  const bidder = summary.bidders.find(b => b.bidder_id === id);
                  if (!bidder) return null;
                  return (
                    <div key={id} className="card" style={{ background: 'rgba(0,0,0,0.2)' }}>
                      <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 8, color: '#f8fafc' }}>{bidder.name}</div>
                      <div style={{ fontSize: '2rem', fontWeight: 800, color: '#6366f1' }}>{Math.round(bidder.match_score)}%</div>
                      <div style={{ marginTop: 16 }}>
                        {summary.criteria.map(c => (
                          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{c.name}</span>
                            <span style={{ fontWeight: 600 }}>{bidder.verdicts[c.id] || 'pending'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="card print-optimized">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th style={{ minWidth: 200 }}>Bidder Name</th>
                    <th>Overall Score</th>
                    {summary.criteria.map(c => (
                      <th key={c.id} style={{ textAlign: 'center', fontSize: '0.75rem' }}>
                        {c.name}
                        {c.mandatory && <div style={{ color: '#ef4444', fontSize: '0.6rem' }}>MANDATORY</div>}
                      </th>
                    ))}
                    <th>Compare</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.bidders.map(bidder => (
                    <tr key={bidder.bidder_id} className={comparingBidders.includes(bidder.bidder_id) ? 'active-row' : ''}>
                      <td style={{ fontWeight: 600, color: '#f1f5f9' }}>
                        {bidder.name}
                        {bidder.is_disqualified && (
                          <div style={{ fontSize: '0.65rem', color: '#ef4444', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <XCircle size={10}/> Technically Disqualified: {bidder.disqualification_reason}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 40, fontSize: '0.75rem', fontWeight: 700 }}>{Math.round(bidder.match_score)}%</div>
                          <div className="progress-bar" style={{ width: 60, height: 6 }}>
                            <div 
                              className="progress-fill" 
                              style={{ 
                                width: `${bidder.match_score}%`,
                                background: bidder.match_score >= 80 ? '#10b981' : bidder.match_score >= 60 ? '#f59e0b' : '#ef4444' 
                              }} 
                            />
                          </div>
                        </div>
                      </td>
                      {summary.criteria.map(c => {
                        const verdict = bidder.verdicts[c.id];
                        return (
                          <td key={c.id} style={{ textAlign: 'center' }}>
                            {verdict === 'eligible' ? (
                              <CheckCircle size={18} style={{ color: '#10b981' }} />
                            ) : verdict === 'ineligible' ? (
                              <XCircle size={18} style={{ color: '#ef4444' }} />
                            ) : (
                              <AlertTriangle size={18} style={{ color: '#f59e0b' }} />
                            )}
                          </td>
                        );
                      })}
                      <td>
                        <button 
                          className={`btn btn-icon ${comparingBidders.includes(bidder.bidder_id) ? 'active' : ''}`}
                          onClick={() => toggleComparison(bidder.bidder_id)}
                          title="Select for Comparison"
                        >
                          <Search size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
               <div style={{ marginRight: 'auto', fontSize: '0.8rem', color: '#64748b' }}>
                  {summary.is_signed && (
                    <span>This report was digitally signed and sealed by <b>{summary.signed_by}</b> on {new Date().toLocaleDateString()}.</span>
                  )}
               </div>
              <button className="btn btn-primary" onClick={() => window.print()}>
                <Download size={16}/> Export Official Report (PDF)
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
