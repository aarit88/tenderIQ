import { useState, useEffect, useRef } from 'react';
import { Users, CheckCircle, Loader, FileText, Eye, Download, Trash2, AlertTriangle, Clock } from 'lucide-react';
import { api } from '../utils/api';
import { downloadBlob } from '../utils/downloadUtils';

export default function BidderManagement({ search, onViewEvidence }) {
  const [bidders, setBidders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractionLogs, setExtractionLogs] = useState([]);
  const fileInputRef = useRef(null);

  const extractionSteps = [
    "Analyzing bidder submission package...",
    "OCR Engine: Processing Scanned_Finance.pdf",
    "Extracted: FY23 Turnover - ₹6.2 Cr",
    "Extracted: PAN and GSTIN (Verified)",
    "Processing Project_Portfolio.docx",
    "Identified 4 Completed Projects (Government Sector)",
    "Verifying ISO 9001:2015 Certification...",
    "Found valid ISO certificate (Exp: 2026)",
    "Cross-referencing evidence against Tender CRPF-CONST-2024...",
    "Extraction Complete. Bidder profile generated."
  ];

  const handleUpload = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setProgress(5);
    setExtractionLogs(["Initializing multi-document AI analysis..."]);
    
    const files = Array.from(fileList);
    
    try {
      // For demo, we'll use a hardcoded tender ID or the first one available
      const tenders = await api.getTenders();
      if (tenders.length === 0) throw new Error("No tenders available to bid for.");
      
      const result = await api.uploadBidder({
        tender_id: tenders[0].id,
        name: files[0].name.split('.')[0] || "New Bidder",
        files: files
      });
      
      setExtractionLogs(prev => [...prev, ...extractionSteps.slice(0, 5), "Background evaluation started."]);
      setProgress(100);
      setTimeout(() => {
        setUploading(false);
        setBidders(prev => [result, ...prev]);
      }, 1000);
    } catch (error) {
      console.error("Bidder upload failed:", error);
      setExtractionLogs(prev => [...prev, "Error: Upload failed. Ensure a tender exists and Gemini key is set."]);
      setUploading(false);
    }
  };

  // Polling for parsing bidders
  useEffect(() => {
    const parsingBidders = bidders.filter(b => b.status === 'parsing');
    if (parsingBidders.length === 0) return;

    const interval = setInterval(async () => {
      try {
        const data = await api.getBidders();
        setBidders(data);
        
        const stillParsing = data.some(b => b.status === 'parsing');
        if (!stillParsing) {
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [bidders]);

  const handleDeleteBidder = async (id) => {
    if (!window.confirm("Are you sure you want to delete this bidder?")) return;
    try {
      await api.deleteBidder(id);
      setBidders(prev => prev.filter(b => b.id !== id));
    } catch (err) {
      console.error(err);
      alert("Failed to delete bidder.");
    }
  };

  const handleDownloadReport = (bidder) => {
    const lines = [
      `=== TENDER-IQ BIDDER REPORT ===`,
      `Bidder: ${bidder.name}`,
      `ID: ${bidder.id}`,
      `Status: ${bidder.is_disqualified ? 'REJECTED' : bidder.status}`,
      `Match Score: ${bidder.match_score}%`,
      bidder.disqualification_reason ? `Rejection Reason: ${bidder.disqualification_reason}` : '',
      ``,
      `Documents Submitted:`,
      ...(bidder.documents || []).map(d => `  - ${d}`),
      ``,
      `Document Checklist:`,
      ...Object.entries(bidder.checklist_status || {}).map(([k, v]) => `  - ${k}: ${v.toUpperCase()}`),
      ``,
      `Generated: ${new Date().toLocaleString()}`
    ].filter(l => l !== undefined);

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${bidder.name.replace(/\s+/g, '_')}_report.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFileChange = (e) => {
    if (e.target.files.length > 0) {
      handleUpload(e.target.files);
      e.target.value = ''; // Reset to allow re-upload
    }
  };

  useEffect(() => {
    const fetchBidders = async () => {
      try {
        const data = await api.getBidders();
        setBidders(data);
      } catch (error) {
        console.error("Error fetching bidders:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchBidders();
  }, []);

  if (loading) return <div className="fade-in" style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>Loading CRPF Bidders...</div>;

  return (
    <div className="fade-in">
      {/* Upload Section */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="section-header">
          <div>
            <div className="section-title">Upload Bidder Documents</div>
            <div className="section-subtitle">Upload bid documents for parsing and evidence extraction</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="filter-select">
              <option>CRPF-CONST-2024 — Data Center</option>
            </select>
          </div>
        </div>

        <div
          className={`upload-zone ${dragOver ? 'dragover' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { 
            e.preventDefault(); 
            setDragOver(false); 
            if (e.dataTransfer.files.length > 0) handleUpload(e.dataTransfer.files); 
          }}
          onClick={(e) => {
            if (e.target.tagName !== 'INPUT') {
              fileInputRef.current?.click();
            }
          }}
        >
          <input 
            ref={fileInputRef}
            id="bidder-file-input" 
            type="file" 
            style={{ display: 'none' }} 
            onChange={onFileChange}
            multiple
            accept=".pdf,.docx,.jpg,.png"
          />
          <div className="upload-zone-icon"><Users size={40} /></div>
          <div className="upload-zone-text">Drop bidder documents here — multi-file supported</div>
          <div className="upload-zone-hint">PDF, DOCX, Scanned images — Bidder name auto-detected</div>
        </div>

        {uploading && (
          <div style={{ marginTop: 24 }} className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>AI Extraction in progress...</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6366f1' }}>{Math.round(progress)}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            
            <div style={{ 
              marginTop: 20, 
              padding: 16, 
              background: 'rgba(0,0,0,0.3)', 
              borderRadius: 8, 
              border: '1px solid rgba(255,255,255,0.05)',
              fontFamily: 'JetBrains Mono',
              maxHeight: '150px',
              overflowY: 'auto'
            }}>
              {extractionLogs.map((log, i) => (
                <div key={i} style={{ fontSize: '0.7rem', color: i === extractionLogs.length - 1 ? '#6366f1' : '#64748b', marginBottom: 4, display: 'flex', gap: 8 }}>
                  <span style={{ color: '#4ade80' }}>&gt;</span>
                  {log}
                </div>
              ))}
              {uploading && <div className="pulse" style={{ width: 4, height: 10, background: '#6366f1', display: 'inline-block', marginLeft: 16 }} />}
            </div>
          </div>
        )}
      </div>

      {/* Bidder Cards */}
      <div className="section-header">
        <div className="section-title">Bidders — CRPF-CONST-2024</div>
        <span className="badge badge-purple">{bidders.length} bidders</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16, marginBottom: 24 }}>
        {bidders.map(bidder => (
          <div className="card" key={bidder.id} style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', marginBottom: 2 }}>{bidder.name}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'JetBrains Mono' }}>{bidder.id}</div>
              </div>
              <span className={`badge ${
                bidder.is_disqualified ? 'badge-red' :
                bidder.status === 'parsed' ? 'badge-green' :
                bidder.status === 'parsing' ? 'badge-yellow pulse-animation' :
                bidder.status === 'needs_review' ? 'badge-orange pulse-animation' :
                'badge-red'
              }`}>
                {bidder.is_disqualified ? <><AlertTriangle size={10}/> REJECTED</> :
                 bidder.status === 'parsed' ? <><CheckCircle size={10}/> Parsed</> :
                 bidder.status === 'parsing' ? <><Loader size={10} className="spin" /> Parsing</> :
                 bidder.status === 'needs_review' ? <><Clock size={10}/> Needs Review</> :
                 bidder.status}
              </span>
            </div>
            {bidder.is_disqualified && (
              <div style={{ fontSize: '0.7rem', color: '#ef4444', marginBottom: 12, padding: '4px 8px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 4, border: '1px dashed rgba(239, 68, 68, 0.3)' }}>
                <strong>Reason:</strong> {bidder.disqualification_reason}
              </div>
            )}

            {/* Documents */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Documents</div>
              {bidder.documents && bidder.documents.map((doc, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, marginBottom: 4, border: '1px solid rgba(255,255,255,0.04)' }}>
                  <FileText size={14} style={{ color: '#6366f1', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8', flex: 1 }}>{doc}</span>
                  <span className={`badge ${
                    doc.toLowerCase().endsWith('.pdf') ? 'badge-purple' :
                    doc.toLowerCase().endsWith('.docx') || doc.toLowerCase().endsWith('.doc') ? 'badge-cyan' :
                    doc.toLowerCase().endsWith('.jpg') || doc.toLowerCase().endsWith('.jpeg') || doc.toLowerCase().endsWith('.png') ? 'badge-yellow' :
                    'badge-gray'
                  }`} style={{ fontSize: '0.6rem' }}>
                    {doc.toLowerCase().endsWith('.pdf') ? 'PDF' :
                     doc.toLowerCase().endsWith('.docx') ? 'DOCX' :
                     doc.toLowerCase().endsWith('.doc') ? 'DOC' :
                     doc.toLowerCase().endsWith('.jpg') || doc.toLowerCase().endsWith('.jpeg') ? 'JPG' :
                     doc.toLowerCase().endsWith('.png') ? 'PNG' :
                     doc.split('.').pop().toUpperCase()}
                  </span>
                </div>
              ))}
            </div>

            {/* Match Score */}
            {bidder.status === 'needs_review' && !bidder.is_disqualified ? (
              <div style={{ marginBottom: 14, padding: '10px 12px', background: 'rgba(245, 158, 11, 0.08)', borderRadius: 8, border: '1px dashed rgba(245, 158, 11, 0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: '#f59e0b' }}>
                  <Clock size={13} />
                  <span><strong>Awaiting Human Review</strong> — AI engines were offline at upload time. A procurement officer must manually verify each criterion.</span>
                </div>
              </div>
            ) : bidder.match_score !== null && bidder.match_score !== undefined ? (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Overall Match</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: bidder.match_score >= 80 ? '#10b981' : bidder.match_score >= 60 ? '#f59e0b' : '#ef4444' }}>{bidder.match_score.toFixed(0)}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${bidder.match_score}%`, background: bidder.match_score >= 80 ? '#10b981' : bidder.match_score >= 60 ? '#f59e0b' : '#ef4444' }} />
                </div>
              </div>
            ) : null}

            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                className="btn btn-secondary btn-sm" 
                style={{ flex: 1 }}
                onClick={() => onViewEvidence(bidder.id)}
              >
                <Eye size={14}/> View Evidence
              </button>
              <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => handleDownloadReport(bidder)}><Download size={14}/> Report</button>
              <button 
                className="btn btn-icon btn-sm" 
                onClick={() => handleDeleteBidder(bidder.id)}
                style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
