import { useState, useEffect, useMemo } from 'react';
import { CheckCircle, XCircle, AlertTriangle, FileText, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, Edit3, Download } from 'lucide-react';
import { api } from '../utils/api';
import { downloadBlob, generateEvaluationReport } from '../utils/downloadUtils';

export default function Evaluation({ search, preSelectedBidderId }) {
  const [bidders, setBidders] = useState([]);
  const [selectedBidder, setSelectedBidder] = useState(preSelectedBidderId || '');
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [evalLoading, setEvalLoading] = useState(false);
  const [expandedCard, setExpandedCard] = useState(null);
  const [overrides, setOverrides] = useState({});

  useEffect(() => {
    const fetchBidders = async () => {
      try {
        const data = await api.getBidders();
        const parsedBidders = data.filter(b => b.status === 'parsed');
        setBidders(parsedBidders);
        if (preSelectedBidderId) {
          setSelectedBidder(preSelectedBidderId);
        } else if (parsedBidders.length > 0 && !selectedBidder) {
          setSelectedBidder(parsedBidders[0].id);
        }
      } catch (error) {
        console.error("Error fetching bidders:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchBidders();
  }, [preSelectedBidderId]);

  useEffect(() => {
    if (!selectedBidder) return;
    const fetchEvals = async () => {
      setEvalLoading(true);
      try {
        const data = await api.getEvaluations(selectedBidder);
        setEvaluations(data);
        // Reset overrides when switching bidders
        setOverrides({});
      } catch (error) {
        console.error("Error fetching evaluations:", error);
      } finally {
        setEvalLoading(false);
      }
    };
    fetchEvals();
  }, [selectedBidder]);

  const getVerdict = (evalItem) => overrides[evalItem.id] || evalItem.verdict;

  // Use useMemo to ensure counts update instantly when overrides change
  const stats = useMemo(() => {
    const counts = { eligible: 0, review: 0, ineligible: 0 };
    evaluations.forEach(e => {
      const v = getVerdict(e);
      if (counts[v] !== undefined) counts[v]++;
    });
    return counts;
  }, [evaluations, overrides]);

  const handleOverride = async (evalId, newVerdict) => {
    try {
      // 1. Update UI immediately
      setOverrides(prev => ({ ...prev, [evalId]: newVerdict }));
      
      // 2. Save to backend
      await api.updateEvaluation(evalId, newVerdict);
      
      // 3. Optional: Sync in background
      // const data = await api.getEvaluations(selectedBidder);
      // setEvaluations(data);
    } catch (error) {
      console.error("Failed to save override:", error);
    }
  };

  const handleDownloadReport = () => {
    const bidder = bidders.find(b => b.id === selectedBidder);
    if (!bidder) return;
    const report = generateEvaluationReport(bidder, evaluations);
    downloadBlob(report, `CRPF_Evaluation_${bidder.id}.txt`, 'text/plain');
  };

  if (loading) return <div className="fade-in" style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>Loading CRPF Bidders...</div>;

  return (
    <div className="fade-in">
      {/* Bidder Selector + Summary */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <select className="filter-select" value={selectedBidder} onChange={e => setSelectedBidder(e.target.value)} style={{ fontSize: '0.9rem', fontWeight: 600 }}>
              {bidders.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <span className="badge badge-purple">vs CRPF-CONST-2024</span>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-primary" onClick={handleDownloadReport}>
              <Download size={16}/> Export Final Report
            </button>
            <div className="summary-box eligible">
              <div className="count">{stats.eligible}</div>
              <div className="label">Eligible</div>
            </div>
            <div className="summary-box review">
              <div className="count">{stats.review}</div>
              <div className="label">Review</div>
            </div>
            <div className="summary-box ineligible">
              <div className="count">{stats.ineligible}</div>
              <div className="label">Ineligible</div>
            </div>
          </div>
        </div>
      </div>

      {evalLoading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Analyzing evaluation results for {bidders.find(b => b.id === selectedBidder)?.name}...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {evaluations.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No criteria evaluations found for this bidder.</div>
          ) : (
            evaluations.map(evalItem => {
              const verdict = getVerdict(evalItem);
              const isExpanded = expandedCard === evalItem.id;
              return (
                <div key={evalItem.id} className={`criterion-card ${verdict === 'eligible' ? 'pass' : verdict === 'ineligible' ? 'fail' : 'review'}`}>
                  <div className="criterion-header" onClick={() => setExpandedCard(isExpanded ? null : evalItem.id)}>
                    <div>
                      <div className="criterion-name">{evalItem.criterion_id} Compliance Check</div>
                      <div className="criterion-category">{evalItem.match_type === 'direct' ? 'Automated Match' : 'Semantic Inference'}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="confidence">
                        <span className={`confidence-dot ${evalItem.confidence}`} />
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'capitalize' }}>{evalItem.confidence} Confidence</span>
                      </div>
                      <span className={`badge ${verdict === 'eligible' ? 'badge-green' : verdict === 'review' ? 'badge-yellow' : 'badge-red'}`}>
                        {verdict === 'eligible' ? <><CheckCircle size={10}/> Eligible</> : verdict === 'review' ? <><AlertTriangle size={10}/> Human Review</> : <><XCircle size={10}/> Ineligible</>}
                      </span>
                      {isExpanded ? <ChevronUp size={16} style={{ color: '#64748b' }}/> : <ChevronDown size={16} style={{ color: '#64748b' }}/>}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="criterion-body slide-up">
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                        <div className="criterion-field">
                          <label>Required Threshold</label>
                          <span style={{ color: '#818cf8', fontWeight: 600 }}>{evalItem.criterion_id === 'C1' ? '> ₹5 Crore' : evalItem.criterion_id === 'C2' ? '≥ 3 Projects' : 'Valid Document'}</span>
                        </div>
                        <div className="criterion-field">
                          <label>Extracted Value</label>
                          <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{evalItem.extracted_value}</span>
                        </div>
                      </div>
                      
                      <div className="criterion-field" style={{ marginBottom: 20 }}>
                        <label>AI Reasoning & Evidence</label>
                        <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.6', background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 6, border: '1px solid rgba(255,255,255,0.05)' }}>
                          {evalItem.reasoning}
                        </p>
                        <div style={{ marginTop: 8, fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <FileText size={12}/> Cited from document page {evalItem.source_page}
                        </div>
                      </div>

                      <div className="evaluation-actions">
                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 12 }}>Human-in-the-Loop Override</div>
                        <div style={{ display: 'flex', gap: 12 }}>
                          <button 
                            className={`btn btn-sm ${verdict === 'eligible' ? 'btn-success' : 'btn-secondary'}`}
                            onClick={(e) => { e.stopPropagation(); handleOverride(evalItem.id, 'eligible'); }}
                          >
                            <ThumbsUp size={14}/> Approve as Eligible
                          </button>
                          <button 
                            className={`btn btn-sm ${verdict === 'review' ? 'btn-warning' : 'btn-secondary'}`}
                            onClick={(e) => { e.stopPropagation(); handleOverride(evalItem.id, 'review'); }}
                          >
                            <AlertTriangle size={14}/> Flag for Review
                          </button>
                          <button 
                            className={`btn btn-sm ${verdict === 'ineligible' ? 'btn-danger' : 'btn-secondary'}`}
                            onClick={(e) => { e.stopPropagation(); handleOverride(evalItem.id, 'ineligible'); }}
                          >
                            <ThumbsDown size={14}/> Reject as Ineligible
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
