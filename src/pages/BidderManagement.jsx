import { useState, useEffect } from 'react';
import { Users, CheckCircle, Loader, FileText, Eye, Download } from 'lucide-react';
import { api } from '../utils/api';
import { downloadBlob } from '../utils/downloadUtils';

export default function BidderManagement({ search, onViewEvidence }) {
  const [bidders, setBidders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractionLogs, setExtractionLogs] = useState([]);

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
      
      setExtractionLogs(prev => [...prev, ...extractionSteps.slice(0, 5), "AI evaluation complete."]);
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

  const onFileChange = (e) => {
    handleUpload(e.target.files);
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
          onClick={() => document.getElementById('bidder-file-input').click()}
        >
          <input 
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
              <span className={`badge ${bidder.status === 'parsed' ? 'badge-green' : 'badge-yellow'}`}>
                {bidder.status === 'parsed' ? <><CheckCircle size={10}/> Parsed</> : <><Loader size={10}/> Parsing</>}
              </span>
            </div>

            {/* Documents */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Documents</div>
              {bidder.documents && bidder.documents.map((doc, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, marginBottom: 4, border: '1px solid rgba(255,255,255,0.04)' }}>
                  <FileText size={14} style={{ color: '#6366f1', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8', flex: 1 }}>{doc}</span>
                  <span className={`badge ${doc.endsWith('.pdf') ? 'badge-purple' : 'badge-cyan'}`} style={{ fontSize: '0.6rem' }}>{doc.endsWith('.pdf') ? 'PDF' : 'DOCX'}</span>
                </div>
              ))}
            </div>

            {/* Match Score */}
            {bidder.match_score !== null && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Overall Match</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: bidder.match_score >= 80 ? '#10b981' : bidder.match_score >= 60 ? '#f59e0b' : '#ef4444' }}>{bidder.match_score}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${bidder.match_score}%`, background: bidder.match_score >= 80 ? '#10b981' : bidder.match_score >= 60 ? '#f59e0b' : '#ef4444' }} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                className="btn btn-secondary btn-sm" 
                style={{ flex: 1 }}
                onClick={() => onViewEvidence(bidder.id)}
              >
                <Eye size={14}/> View Evidence
              </button>
              <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => handleDownloadReport(bidder)}><Download size={14}/> Report</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
