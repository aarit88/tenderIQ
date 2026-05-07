import { useState, useEffect } from 'react';
import { Upload, CheckCircle, Loader, Edit3, Trash2, FileText } from 'lucide-react';
import { api } from '../utils/api';

export default function TenderUpload() {
  const [tenders, setTenders] = useState([]);
  const [criteria, setCriteria] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState('all');
  const [dragOver, setDragOver] = useState(false);
  const [extractionLogs, setExtractionLogs] = useState([]);

  const extractionSteps = [
    "Reading tender document...",
    "OCR Engine: Analyzing layout...",
    "Identifying 'Evaluation Criteria' section...",
    "Extracting Financial requirement...",
    "Extracting Technical requirement...",
    "Extracting Compliance requirements...",
    "Verification complete."
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await api.getTenders();
        setTenders(data);
        if (data.length > 0) {
          const critData = await api.getCriteria(data[0].id);
          setCriteria(critData);
        }
      } catch (error) {
        console.error("Error fetching tenders:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const fileInputRef = useState(null);

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setProgress(10);
    setExtractionLogs(["Initializing AI extraction..."]);
    
    try {
      const result = await api.createTender({
        title: "Construction of Multi-Level Parking", // Ideally these come from a form, but let's keep it simple
        department: "CRPF Civil Works",
        value: "₹4.5 Cr",
        file: file
      });
      
      setExtractionLogs(prev => [...prev, "Reading tender document...", "AI identifying criteria...", "Criteria saved."]);
      setProgress(100);
      setTimeout(() => {
        setUploading(false);
        api.getTenders().then(setTenders);
        if (result.id) api.getCriteria(result.id).then(setCriteria);
      }, 1000);
    } catch (error) {
      console.error("Upload failed:", error);
      setExtractionLogs(prev => [...prev, "Error: Upload failed. Check backend/Gemini API key."]);
      setUploading(false);
    }
  };

  const onFileChange = (e) => {
    const file = e.target.files[0];
    handleUpload(file);
  };

  const filtered = activeTab === 'all' ? criteria : criteria.filter(c => c.category.toLowerCase() === activeTab);

  if (loading) return <div className="fade-in" style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>Loading Tenders...</div>;

  return (
    <div className="fade-in">
      {/* Upload Section */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="section-header">
          <div>
            <div className="section-title">Upload Tender Document</div>
            <div className="section-subtitle">PDF, scanned documents — OCR + AI extraction</div>
          </div>
        </div>

        <div
          className={`upload-zone ${dragOver ? 'dragover' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { 
            e.preventDefault(); 
            setDragOver(false); 
            if (e.dataTransfer.files.length > 0) handleUpload(e.dataTransfer.files[0]); 
          }}
          onClick={() => document.getElementById('tender-file-input').click()}
        >
          <input 
            id="tender-file-input" 
            type="file" 
            style={{ display: 'none' }} 
            onChange={onFileChange}
            accept=".pdf,.docx"
          />
          <div className="upload-zone-icon"><Upload size={40} /></div>
          <div className="upload-zone-text">Drag & drop tender PDF here, or click to browse</div>
          <div className="upload-zone-hint">Supports PDF, scanned PDFs (OCR), DOCX — Max 200MB</div>
        </div>

        {uploading && (
          <div style={{ marginTop: 20 }}>
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${Math.min(100, progress)}%` }} /></div>
          </div>
        )}
      </div>

      {/* Extracted Checklist */}
      {tenders.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="section-header">
            <div className="section-title">Automated Document Checklist</div>
            <div className="section-subtitle">AI-identified mandatory documents for this tender</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
            {tenders[0].required_docs?.map((doc, idx) => (
              <div key={idx} className="badge badge-gray" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1' }}></div>
                {doc}
              </div>
            ))}
            {(!tenders[0].required_docs || tenders[0].required_docs.length === 0) && (
              <div className="section-subtitle">No specific checklist extracted yet.</div>
            )}
          </div>
        </div>
      )}

      {/* Existing Tenders */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="section-header">
          <div className="section-title">Uploaded Tenders</div>
        </div>
        <div className="table-container">
          <table>
            <thead><tr><th>Tender ID</th><th>Title</th><th>Department</th><th>Value</th><th>Status</th></tr></thead>
            <tbody>
              {tenders.map(t => (
                <tr key={t.id}>
                  <td style={{ fontFamily: 'JetBrains Mono', fontSize: '0.8rem', color: '#6366f1' }}>{t.id}</td>
                  <td style={{ fontWeight: 600, color: '#f1f5f9', maxWidth: 250 }}>{t.title}</td>
                  <td>{t.department}</td>
                  <td style={{ fontWeight: 600 }}>{t.value}</td>
                  <td><span className="badge badge-green">{t.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Extracted Criteria */}
      <div className="card">
        <div className="section-header">
          <div className="section-title">Extracted Criteria</div>
        </div>

        <div className="tabs">
          {['all', 'financial', 'technical', 'compliance'].map(tab => (
            <button key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="table-container">
          <table>
            <thead><tr><th>Category</th><th>Criterion</th><th>Threshold</th><th>Mandatory</th><th>Source</th></tr></thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  <td><span className={`badge ${c.category === 'Financial' ? 'badge-purple' : c.category === 'Technical' ? 'badge-cyan' : 'badge-yellow'}`}>{c.category}</span></td>
                  <td style={{ fontWeight: 600, color: '#f1f5f9' }}>{c.name}</td>
                  <td style={{ fontFamily: 'JetBrains Mono', fontSize: '0.8rem', color: '#6366f1' }}>{c.threshold}</td>
                  <td>
                    {c.mandatory ? (
                      <span className="badge badge-red" style={{ fontWeight: 800 }}>MANDATORY</span>
                    ) : (
                      <span className="badge badge-gray">OPTIONAL</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: '#94a3b8' }}>
                      <FileText size={12}/> Page {c.source_page}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
