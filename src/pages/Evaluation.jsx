import { useState, useEffect, useMemo } from 'react';
import { CheckCircle, XCircle, AlertTriangle, FileText, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, Download, Loader, Cpu, Database } from 'lucide-react';
import { api } from '../utils/api';
import { downloadBlob, generateEvaluationReport } from '../utils/downloadUtils';

export default function Evaluation({ search, preSelectedBidderId }) {
  const [bidders, setBidders] = useState([]);
  const [selectedBidder, setSelectedBidder] = useState(preSelectedBidderId || '');
  const [evaluations, setEvaluations] = useState([]);
  const [criteria, setCriteria] = useState([]);
  const [loading, setLoading] = useState(true);
  const [evalLoading, setEvalLoading] = useState(false);
  const [expandedCard, setExpandedCard] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [reEvaluateLoading, setReEvaluateLoading] = useState(false);

  // Load bidders on mount
  useEffect(() => {
    const fetchBidders = async () => {
      try {
        const data = await api.getBidders();
        const parsedBidders = data.filter(b => b.status === 'parsed' || b.status === 'needs_review');
        setBidders(parsedBidders);
        if (preSelectedBidderId) {
          setSelectedBidder(preSelectedBidderId);
        } else if (parsedBidders.length > 0 && !selectedBidder) {
          setSelectedBidder(parsedBidders[0].id);
        }
      } catch (error) {
        console.error('Error fetching bidders:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchBidders();
  }, [preSelectedBidderId]);

  // Load evaluations + criteria when bidder changes
  useEffect(() => {
    if (!selectedBidder) return;
    const fetchData = async () => {
      setEvalLoading(true);
      setOverrides({});
      try {
        const bidder = bidders.find(b => b.id === selectedBidder);
        const tenderId = bidder?.tender_id;

        const [evalData, criteriaData] = await Promise.all([
          api.getEvaluations(selectedBidder),
          tenderId ? api.getCriteria(tenderId) : Promise.resolve([])
        ]);

        setEvaluations(evalData);
        setCriteria(criteriaData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setEvalLoading(false);
      }
    };
    fetchData();
  }, [selectedBidder, bidders]);

  // Merge evaluations with criteria for full picture
  const mergedRows = useMemo(() => {
    return criteria.map(crit => {
      const evalItem = evaluations.find(e => e.criterion_id === crit.id);
      const verdict = overrides[evalItem?.id] || evalItem?.verdict || 'missing';
      return { crit, evalItem, verdict };
    });
  }, [criteria, evaluations, overrides]);

  const stats = useMemo(() => {
    const counts = { eligible: 0, review: 0, ineligible: 0, missing: 0 };
    mergedRows.forEach(({ verdict }) => {
      if (counts[verdict] !== undefined) counts[verdict]++;
    });
    return counts;
  }, [mergedRows]);

  const handleOverride = async (critId, evalId, newVerdict) => {
    try {
      // Optimistic update
      setOverrides(prev => ({ ...prev, [evalId || `new-${critId}`]: newVerdict }));
      
      let result;
      if (evalId) {
        result = await api.updateEvaluation(evalId, newVerdict);
      } else {
        result = await api.upsertEvaluation(selectedBidder, critId, newVerdict);
      }
      
      // Refresh evaluations to get the real IDs and data
      const evalData = await api.getEvaluations(selectedBidder);
      setEvaluations(evalData);
    } catch (error) {
      console.error('Failed to save override:', error);
      alert('Failed to save manual override.');
    }
  };

  const handleDownloadReport = () => {
    const bidder = bidders.find(b => b.id === selectedBidder);
    if (!bidder) return;
    const report = generateEvaluationReport(bidder, evaluations);
    downloadBlob(report, `CRPF_Evaluation_${bidder.id}.txt`, 'text/plain');
  };

  const handleReEvaluate = async (engine = null) => {
    if (!selectedBidder) return;
    setReEvaluateLoading(true);
    try {
      await api.reEvaluateBidder(selectedBidder, engine);
      // Poll for status update or just alert user
      alert("Re-evaluation started. Please wait a few moments and refresh.");
      
      // Basic polling logic could go here, but for now we just refresh after a delay
      setTimeout(async () => {
        const data = await api.getBidders();
        setBidders(data);
        setReEvaluateLoading(false);
      }, 5000);
    } catch (err) {
      console.error("Re-evaluation failed", err);
      alert("Failed to start re-evaluation.");
      setReEvaluateLoading(false);
    }
  };

  const verdictIcon = (v) => {
    if (v === 'eligible') return <CheckCircle size={18} style={{ color: '#10b981' }} />;
    if (v === 'review')   return <AlertTriangle size={18} style={{ color: '#f59e0b' }} />;
    return <XCircle size={18} style={{ color: '#ef4444' }} />;
  };

  const verdictBadge = (v) => {
    if (v === 'eligible') return <span className="badge badge-green"><CheckCircle size={10}/> Matched</span>;
    if (v === 'review')   return <span className="badge badge-yellow"><AlertTriangle size={10}/> Review</span>;
    if (v === 'missing')  return <span className="badge badge-gray">No Evaluation</span>;
    return <span className="badge badge-red"><XCircle size={10}/> Not Matched</span>;
  };

  if (loading) return <div className="fade-in" style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>Loading Bidders...</div>;

  const selectedBidderObj = bidders.find(b => b.id === selectedBidder);

  return (
    <div className="fade-in">

      {/* Header */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <select className="filter-select" value={selectedBidder} onChange={e => setSelectedBidder(e.target.value)} style={{ fontSize: '0.9rem', fontWeight: 600 }}>
              {bidders.map(b => <option key={b.id} value={b.id}>{b.name} ({b.id})</option>)}
            </select>
            {selectedBidderObj?.tender_id && (
              <span className="badge badge-purple">vs {selectedBidderObj.tender_id}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div className="re-evaluate-group" style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => handleReEvaluate()} 
                disabled={reEvaluateLoading || evalLoading}
                style={{ borderRadius: '8px 0 0 8px', border: 'none', borderRight: '1px solid var(--border)' }}
                title="Re-run AI analysis with current settings"
              >
                {reEvaluateLoading ? <Loader size={16} className="spin" /> : <Database size={16}/>}
                Re-evaluate
              </button>
              <select 
                className="filter-select"
                style={{ borderRadius: '0 8px 8px 0', border: 'none', height: '100%', fontSize: '0.75rem', padding: '0 25px 0 10px', backgroundPosition: 'right 8px center' }}
                onChange={(e) => handleReEvaluate(e.target.value)}
                disabled={reEvaluateLoading || evalLoading}
                value=""
              >
                <option value="" disabled>Force Engine...</option>
                <option value="auto">Auto (Default)</option>
                <option value="gemini">Gemini (Cloud)</option>
                <option value="ollama">Ollama (Local)</option>
              </select>
            </div>
            <button className="btn btn-primary" onClick={handleDownloadReport}>
              <Download size={16}/> Export Report
            </button>
            <div className="summary-box eligible"><div className="count">{stats.eligible}</div><div className="label">Matched</div></div>
            <div className="summary-box review"><div className="count">{stats.review}</div><div className="label">Review</div></div>
            <div className="summary-box ineligible"><div className="count">{stats.ineligible}</div><div className="label">Not Matched</div></div>
          </div>
        </div>
      </div>

      {/* Disqualification Banner */}
      {selectedBidderObj?.is_disqualified && (
        <div className="card fade-in" style={{ marginBottom: 24, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className="stat-icon red" style={{ width: 48, height: 48 }}><AlertTriangle size={24}/></div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#ef4444' }}>AUTOMATIC REJECTION TRIGGERED</div>
              <div style={{ fontSize: '0.85rem', color: '#f87171' }}>Reason: {selectedBidderObj.disqualification_reason}</div>
            </div>
          </div>
        </div>
      )}

      {evalLoading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
          Comparing bidder documents against tender criteria...
        </div>
      ) : criteria.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
          No tender criteria found. Upload a tender document first so criteria can be extracted.
        </div>
      ) : (
        <>
          {/* Match Summary Table */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="section-header" style={{ marginBottom: 16 }}>
              <div className="section-title">Criteria Match Report</div>
              <div className="section-subtitle">
                Tender criteria extracted from document vs. evidence in {selectedBidderObj?.name}'s submission
              </div>
            </div>

            {/* Table Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.8fr 1fr 1fr 120px 340px',
              gap: 12,
              padding: '10px 16px',
              background: 'rgba(99,102,241,0.08)',
              borderRadius: 8,
              marginBottom: 8,
              fontSize: '0.72rem',
              fontWeight: 700,
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.06em'
            }}>
              <span>Criterion</span>
              <span>Required Threshold</span>
              <span>Bidder's Extracted Value</span>
              <span>Category</span>
              <span style={{ textAlign: 'center' }}>Result / Action</span>
            </div>

            {/* Table Rows */}
            {mergedRows.map(({ crit, evalItem, verdict }, idx) => (
              <div key={crit.id}>
                <div
                  onClick={() => setExpandedCard(expandedCard === crit.id ? null : crit.id)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.8fr 1fr 1fr 120px 340px',
                    gap: 12,
                    padding: '14px 16px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: expandedCard === crit.id ? 'rgba(255,255,255,0.04)' : idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                    border: '1px solid',
                    borderColor: verdict === 'eligible' ? 'rgba(16,185,129,0.15)' : verdict === 'review' ? 'rgba(245,158,11,0.15)' : verdict === 'ineligible' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
                    marginBottom: 6,
                    alignItems: 'center',
                    transition: 'background 0.2s'
                  }}
                >
                  {/* Criterion Name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {verdictIcon(verdict)}
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f1f5f9' }}>{crit.name}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'JetBrains Mono' }}>{crit.id} {crit.mandatory ? '· Mandatory' : '· Optional'}</div>
                    </div>
                  </div>

                  {/* Required Threshold */}
                  <div style={{ fontSize: '0.82rem', color: '#818cf8', fontWeight: 600 }}>
                    {crit.threshold || '—'}
                  </div>

                  {/* Bidder Extracted Value */}
                  <div style={{ fontSize: '0.82rem', color: evalItem ? '#f1f5f9' : '#475569', fontStyle: evalItem ? 'normal' : 'italic' }}>
                    {evalItem?.extracted_value || 'Not evaluated'}
                  </div>

                  {/* Category */}
                  <div>
                    <span className={`badge ${crit.category === 'Financial' ? 'badge-cyan' : crit.category === 'Technical' ? 'badge-purple' : 'badge-yellow'}`} style={{ fontSize: '0.68rem' }}>
                      {crit.category}
                    </span>
                  </div>

                  {/* Verdict / Action */}
                  <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                    {verdictBadge(verdict)}
                    <div className="quick-actions" style={{ display: 'flex', gap: 6 }}>
                      <button 
                        className={`btn btn-sm ${verdict === 'eligible' ? 'btn-success' : 'btn-secondary'}`} 
                        onClick={(e) => { e.stopPropagation(); handleOverride(crit.id, evalItem?.id, 'eligible'); }}
                        style={{ padding: '6px 12px', minWidth: '80px', fontSize: '0.75rem' }}
                        title="Accept this criterion"
                      >
                        <ThumbsUp size={14} style={{ marginRight: 6 }}/> Accept
                      </button>
                      <button 
                        className={`btn btn-sm ${verdict === 'ineligible' ? 'btn-danger' : 'btn-secondary'}`} 
                        onClick={(e) => { e.stopPropagation(); handleOverride(crit.id, evalItem?.id, 'ineligible'); }}
                        style={{ padding: '6px 12px', minWidth: '80px', fontSize: '0.75rem' }}
                        title="Reject this criterion"
                      >
                        <ThumbsDown size={14} style={{ marginRight: 6 }}/> Reject
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Detail */}
                {expandedCard === crit.id && (
                  <div className="slide-up" style={{
                    margin: '-2px 0 8px 0',
                    padding: '20px',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '0 0 10px 10px',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderTop: 'none'
                  }}>
                    {!evalItem ? (
                      <div style={{ 
                        textAlign: 'center', 
                        padding: '30px', 
                        background: 'rgba(255,255,255,0.02)', 
                        borderRadius: 12, 
                        border: '1px dashed rgba(255,255,255,0.1)' 
                      }}>
                        <div style={{ marginBottom: 20, color: '#94a3b8', fontSize: '0.9rem' }}>
                          <AlertTriangle size={20} style={{ color: '#f59e0b', marginBottom: 8 }} /><br/>
                          No AI evaluation available for this criterion. Manual verdict required.
                        </div>
                        <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
                          <button className="btn btn-success" onClick={() => handleOverride(crit.id, null, 'eligible')} style={{ padding: '10px 24px' }}>
                            <ThumbsUp size={16} style={{ marginRight: 8 }}/> Manual Accept
                          </button>
                          <button className="btn btn-danger" onClick={() => handleOverride(crit.id, null, 'ineligible')} style={{ padding: '10px 24px' }}>
                            <ThumbsDown size={16} style={{ marginRight: 8 }}/> Manual Reject
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Tender Source */}
                        {crit.source_text && (
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
                              📄 Tender Source Text (Page {crit.source_page})
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', background: 'rgba(99,102,241,0.06)', padding: '10px 14px', borderLeft: '3px solid #6366f1', borderRadius: '0 6px 6px 0' }}>
                              "{crit.source_text}"
                            </div>
                          </div>
                        )}

                        {/* AI Reasoning */}
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
                            🤖 AI Evaluation Reasoning
                          </div>
                          <p style={{ fontSize: '0.84rem', color: '#cbd5e1', lineHeight: '1.7', background: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 6, border: '1px solid rgba(255,255,255,0.05)', margin: 0 }}>
                            {evalItem.reasoning}
                          </p>
                          {evalItem.ai_engine && (
                            <div className="engine-tag">
                              <Cpu size={10} /> Verified by {evalItem.ai_engine.toUpperCase()}
                            </div>
                          )}
                        </div>

                        {/* Evidence Snippet */}
                        {evalItem.evidence_snippet && evalItem.evidence_snippet !== 'No evidence found' && evalItem.evidence_snippet !== 'N/A — irrelevant document' && (
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
                              🔍 Evidence Found in Bidder Document
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#a5f3fc', fontStyle: 'italic', background: 'rgba(16,185,129,0.05)', padding: '10px 14px', borderLeft: '3px solid #10b981', borderRadius: '0 6px 6px 0' }}>
                              "{evalItem.evidence_snippet}"
                              <span style={{ marginLeft: 12, fontSize: '0.72rem', color: '#64748b' }}>
                                — {evalItem.source_document}, Page {evalItem.source_page}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Action Required */}
                        {(verdict === 'review' || verdict === 'ineligible') && evalItem.action_required && (
                          <div style={{ marginBottom: 16, background: verdict === 'review' ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)', border: `1px dashed ${verdict === 'review' ? '#f59e0b' : '#ef4444'}`, padding: '10px 14px', borderRadius: 6, color: verdict === 'review' ? '#f59e0b' : '#f87171', fontSize: '0.8rem', fontWeight: 600 }}>
                            <AlertTriangle size={14} style={{ marginRight: 6, display: 'inline' }}/>
                            ACTION REQUIRED: {evalItem.action_required}
                          </div>
                        )}

                        {/* Human Override */}
                        <div style={{ 
                          marginTop: 24, 
                          paddingTop: 20, 
                          borderTop: '1px solid rgba(255,255,255,0.05)' 
                        }}>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', marginBottom: 16, letterSpacing: '0.05em' }}>
                            Administrative Override
                          </div>
                          <div style={{ display: 'flex', gap: 12 }}>
                            <button className={`btn ${verdict === 'eligible' ? 'btn-success' : 'btn-secondary'}`} onClick={() => handleOverride(crit.id, evalItem.id, 'eligible')} style={{ flex: 1, justifyContent: 'center' }}>
                              <ThumbsUp size={16} style={{ marginRight: 8 }}/> Accept Verdict
                            </button>
                            <button className={`btn ${verdict === 'review' ? 'btn-warning' : 'btn-secondary'}`} onClick={() => handleOverride(crit.id, evalItem.id, 'review')} style={{ flex: 1, justifyContent: 'center' }}>
                              <AlertTriangle size={16} style={{ marginRight: 8 }}/> Flag for Review
                            </button>
                            <button className={`btn ${verdict === 'ineligible' ? 'btn-danger' : 'btn-secondary'}`} onClick={() => handleOverride(crit.id, evalItem.id, 'ineligible')} style={{ flex: 1, justifyContent: 'center' }}>
                              <ThumbsDown size={16} style={{ marginRight: 8 }}/> Reject Verdict
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Document Checklist */}
          {selectedBidderObj?.checklist_status && Object.keys(selectedBidderObj.checklist_status).length > 0 && (
            <div className="card">
              <div className="section-header" style={{ marginBottom: 16 }}>
                <div className="section-title" style={{ fontSize: '1rem' }}>Required Document Checklist</div>
                <div className="section-subtitle">Mandatory documents from tender vs. bidder submission</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {Object.entries(selectedBidderObj.checklist_status).map(([doc, status], idx) => (
                  <div key={idx} style={{
                    padding: '12px 14px',
                    borderRadius: 8,
                    background: status === 'found' ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)',
                    border: `1px solid ${status === 'found' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FileText size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>{doc}</span>
                    </div>
                    {status === 'found'
                      ? <CheckCircle size={16} style={{ color: '#10b981', flexShrink: 0 }} />
                      : <XCircle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
                    }
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
