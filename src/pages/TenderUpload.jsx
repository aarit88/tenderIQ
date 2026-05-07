import { useState, useEffect, useRef } from 'react';
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
  const [editingCriterion, setEditingCriterion] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedTenderId, setSelectedTenderId] = useState(null);
  const [newCrit, setNewCrit] = useState({ category: 'Financial', name: '', threshold: '', mandatory: true });

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
        if (data.length > 0 && !selectedTenderId) {
          setSelectedTenderId(data[0].id);
        }
      } catch (error) {
        console.error("Error fetching tenders:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Fetch criteria when selected tender changes
  useEffect(() => {
    if (!selectedTenderId) return;
    const fetchCriteria = async () => {
      try {
        const critData = await api.getCriteria(selectedTenderId);
        setCriteria(critData);
      } catch (error) {
        console.error("Error fetching criteria:", error);
      }
    };
    fetchCriteria();
  }, [selectedTenderId]);

  const fileInputRef = useRef(null);

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setProgress(10);
    setExtractionLogs(["Initializing AI extraction..."]);
    
    try {
      const result = await api.createTender({
        title: file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " "), // Use filename as title
        department: "CRPF Procurement",
        value: "₹ TBD", // To be detected by AI
        file: file
      });
      
      setExtractionLogs(prev => [...prev, "Reading tender document...", "AI identifying criteria...", "Background processing started."]);
      setProgress(100);
      setTimeout(() => {
        setUploading(false);
        api.getTenders().then(setTenders);
      }, 1000);
    } catch (error) {
      console.error("Upload failed:", error);
      setExtractionLogs(prev => [...prev, "Error: Upload failed. Check backend/Gemini API key."]);
      setUploading(false);
    }
  };

  // Polling for parsing tenders
  useEffect(() => {
    const parsingTenders = tenders.filter(t => t.status === 'parsing');
    if (parsingTenders.length === 0) return;

    const interval = setInterval(async () => {
      try {
        const data = await api.getTenders();
        setTenders(data);
        
        // If any were parsing and now evaluated, refresh criteria
        const stillParsing = data.some(t => t.status === 'parsing');
        if (!stillParsing) {
          clearInterval(interval);
          if (data.length > 0) {
            const critData = await api.getCriteria(data[0].id);
            setCriteria(critData);
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [tenders]);

  const handleDeleteTender = async (id) => {
    if (!window.confirm("Are you sure you want to delete this tender and all associated bidders?")) return;
    try {
      await api.deleteTender(id);
      setTenders(prev => prev.filter(t => t.id !== id));
      if (tenders[0]?.id === id) setCriteria([]);
    } catch (err) {
      console.error(err);
      alert("Failed to delete tender.");
    }
  };

  const handleDeleteCriterion = async (id) => {
    if (!window.confirm("Delete this criterion? This will also remove any existing evaluations for it.")) return;
    try {
      await api.deleteCriterion(id);
      setCriteria(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateCriterion = async (id, updates) => {
    try {
      const updated = await api.updateCriterion(id, updates);
      setCriteria(prev => prev.map(c => c.id === id ? updated : c));
      setEditingCriterion(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddCriterion = async () => {
    if (!selectedTenderId) return;
    try {
      const created = await api.createCriterion({ ...newCrit, tender_id: selectedTenderId });
      setCriteria(prev => [...prev, created]);
      setShowAddForm(false);
      setNewCrit({ category: 'Financial', name: '', threshold: '', mandatory: true });
    } catch (err) {
      console.error(err);
    }
  };

  const onFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleUpload(file);
      e.target.value = ''; // Reset to allow re-upload of same file
    }
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
          onClick={(e) => {
            if (e.target.tagName !== 'INPUT') {
              fileInputRef.current?.click();
            }
          }}
        >
          <input 
            ref={fileInputRef}
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
            <div>
              <div className="section-title">Automated Document Checklist</div>
              <div className="section-subtitle">Mandatory documents identified for: <strong>{tenders[0].title}</strong></div>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
            {tenders[0].status === 'parsing' ? (
              <div className="section-subtitle"><Loader size={14} className="spin" style={{ marginRight: 8 }} /> AI is extracting requirements from document...</div>
            ) : (
              <>
                {tenders[0].required_docs?.map((doc, idx) => (
                  <div key={idx} className="badge badge-gray" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1' }}></div>
                    {doc}
                  </div>
                ))}
                {(!tenders[0].required_docs || tenders[0].required_docs.length === 0) && (
                  <div className="section-subtitle">No specific checklist extracted.</div>
                )}
              </>
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
                <tr 
                  key={t.id} 
                  onClick={() => setSelectedTenderId(t.id)}
                  style={{ 
                    cursor: 'pointer',
                    background: selectedTenderId === t.id ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                    borderLeft: selectedTenderId === t.id ? '3px solid #6366f1' : '3px solid transparent'
                  }}
                >
                  <td style={{ fontFamily: 'JetBrains Mono', fontSize: '0.8rem', color: '#6366f1' }}>{t.id}</td>
                  <td style={{ fontWeight: 600, color: '#f1f5f9', maxWidth: 250 }}>{t.title}</td>
                  <td>{t.department}</td>
                  <td style={{ fontWeight: 600 }}>{t.value}</td>
                   <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={`badge ${t.status === 'evaluated' ? 'badge-green' : t.status === 'parsing' ? 'badge-yellow pulse-animation' : 'badge-red'}`}>
                        {t.status === 'parsing' ? <><Loader size={10} className="spin" /> Parsing...</> : t.status}
                      </span>
                      <button 
                        className="btn btn-icon btn-sm" 
                        onClick={(e) => { e.stopPropagation(); handleDeleteTender(t.id); }}
                        style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Extracted Criteria */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="section-title">
            Extracted Criteria for: <span style={{ color: '#6366f1' }}>{tenders.find(t => t.id === selectedTenderId)?.title || 'Select a Tender'}</span>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? 'Cancel' : '+ Add Criterion'}
          </button>
        </div>

        {showAddForm && (
          <div className="fade-in" style={{ padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 8, marginBottom: 20, border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 100px 80px', gap: 12, alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Category</label>
                <select className="filter-select" value={newCrit.category} onChange={e => setNewCrit({...newCrit, category: e.target.value})}>
                  <option>Financial</option><option>Technical</option><option>Compliance</option><option>General</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Name</label>
                <input type="text" className="filter-select" placeholder="e.g. ISO 9001" value={newCrit.name} onChange={e => setNewCrit({...newCrit, name: e.target.value})} />
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: 4 }}>Threshold</label>
                <input type="text" className="filter-select" placeholder="e.g. Valid cert" value={newCrit.threshold} onChange={e => setNewCrit({...newCrit, threshold: e.target.value})} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', height: 38 }}>
                 <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer' }}>
                   <input type="checkbox" checked={newCrit.mandatory} onChange={e => setNewCrit({...newCrit, mandatory: e.target.checked})} /> Mandatory
                 </label>
              </div>
              <button className="btn btn-primary btn-sm" onClick={handleAddCriterion}>Save</button>
            </div>
          </div>
        )}

        <div className="tabs">
          {['all', 'financial', 'technical', 'compliance'].map(tab => (
            <button key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="table-container">
          <table>
            <thead><tr><th>Category</th><th>Criterion</th><th>Threshold</th><th>Mandatory</th><th>Source</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  {editingCriterion === c.id ? (
                    <>
                      <td>
                        <select className="filter-select" value={c.category} onChange={e => handleUpdateCriterion(c.id, {category: e.target.value})}>
                          <option>Financial</option><option>Technical</option><option>Compliance</option><option>General</option>
                        </select>
                      </td>
                      <td><input type="text" className="filter-select" value={c.name} onChange={e => handleUpdateCriterion(c.id, {name: e.target.value})} /></td>
                      <td><input type="text" className="filter-select" value={c.threshold} onChange={e => handleUpdateCriterion(c.id, {threshold: e.target.value})} /></td>
                      <td>
                        <input type="checkbox" checked={c.mandatory} onChange={e => handleUpdateCriterion(c.id, {mandatory: e.target.checked})} />
                      </td>
                      <td><span style={{ fontSize: '0.7rem', color: '#64748b' }}>Manual Edit</span></td>
                      <td>
                        <button className="btn btn-sm btn-success" onClick={() => setEditingCriterion(null)}>Done</button>
                      </td>
                    </>
                  ) : (
                    <>
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
                          <FileText size={12}/> Page {c.source_page || '—'}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn btn-icon btn-sm" onClick={() => setEditingCriterion(c.id)}><Edit3 size={12}/></button>
                          <button className="btn btn-icon btn-sm" onClick={() => handleDeleteCriterion(c.id)} style={{ color: '#ef4444' }}><Trash2 size={12}/></button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
