const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const api = {
  getTenders: async () => {
    const response = await fetch(`${API_BASE_URL}/tenders`);
    if (!response.ok) throw new Error('Failed to fetch tenders');
    return response.json();
  },

  getCriteria: async (tenderId) => {
    const response = await fetch(`${API_BASE_URL}/tenders/${tenderId}/criteria`);
    if (!response.ok) throw new Error('Failed to fetch criteria');
    return response.json();
  },

  getBidders: async () => {
    const response = await fetch(`${API_BASE_URL}/bidders`);
    if (!response.ok) throw new Error('Failed to fetch bidders');
    return response.json();
  },

  getEvaluations: async (bidderId) => {
    const response = await fetch(`${API_BASE_URL}/evaluations/${bidderId}`);
    if (!response.ok) throw new Error('Failed to fetch evaluations');
    return response.json();
  },

  getTenderSummary: async (tenderId) => {
    const response = await fetch(`${API_BASE_URL}/tenders/${tenderId}/summary`);
    if (!response.ok) throw new Error('Failed to fetch tender summary');
    return response.json();
  },

  signTender: async (tenderId, officerName) => {
    const response = await fetch(`${API_BASE_URL}/tenders/${tenderId}/sign?officer_name=${encodeURIComponent(officerName)}`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Failed to sign tender');
    return response.json();
  },

  getAuditLog: async () => {
    const response = await fetch(`${API_BASE_URL}/audit`);
    if (!response.ok) throw new Error('Failed to fetch audit log');
    return response.json();
  },

  deleteTender: async (id) => {
    const response = await fetch(`${API_BASE_URL}/tenders/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete tender');
    return response.json();
  },

  deleteBidder: async (id) => {
    const response = await fetch(`${API_BASE_URL}/bidders/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete bidder');
    return response.json();
  },

  createTender: async (tender) => {
    const formData = new FormData();
    formData.append('title', tender.title);
    formData.append('department', tender.department);
    formData.append('value', tender.value);
    formData.append('file', tender.file);

    const response = await fetch(`${API_BASE_URL}/tenders/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('Failed to upload tender');
    return response.json();
  },

  uploadBidder: async (bidder) => {
    const formData = new FormData();
    formData.append('tender_id', bidder.tender_id);
    formData.append('name', bidder.name);
    bidder.files.forEach(file => {
      formData.append('files', file);
    });

    const response = await fetch(`${API_BASE_URL}/bidders/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('Failed to upload bidder');
    return response.json();
  },

  updateEvaluation: async (evalId, verdict) => {
    const response = await fetch(`${API_BASE_URL}/evaluations/${evalId}?verdict=${verdict}`, { method: 'PUT' });
    if (!response.ok) throw new Error('Failed to update evaluation');
    return response.json();
  },

  upsertEvaluation: async (bidderId, criterionId, verdict) => {
    const response = await fetch(`${API_BASE_URL}/evaluations/upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bidder_id: bidderId, criterion_id: criterionId, verdict })
    });
    if (!response.ok) throw new Error('Failed to upsert evaluation');
    return response.json();
  },

  updateCriterion: async (id, updates) => {
    const response = await fetch(`${API_BASE_URL}/criteria/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!response.ok) throw new Error('Failed to update criterion');
    return response.json();
  },

  deleteCriterion: async (id) => {
    const response = await fetch(`${API_BASE_URL}/criteria/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete criterion');
    return response.json();
  },

  createCriterion: async (criterion) => {
    const response = await fetch(`${API_BASE_URL}/criteria`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(criterion)
    });
    if (!response.ok) throw new Error('Failed to create criterion');
    return response.json();
  },

  seedData: async () => {
    const response = await fetch(`${API_BASE_URL}/seed`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to seed data');
    return response.json();
  },

  getAiSettings: async () => {
    const response = await fetch(`${API_BASE_URL}/settings/ai`);
    if (!response.ok) throw new Error('Failed to fetch AI settings');
    return response.json();
  },

  updateAiSettings: async (engine) => {
    const response = await fetch(`${API_BASE_URL}/settings/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferred_engine: engine })
    });
    if (!response.ok) throw new Error('Failed to update AI settings');
    return response.json();
  },

  reEvaluateBidder: async (bidderId, engine = null) => {
    let url = `${API_BASE_URL}/bidders/${bidderId}/re-evaluate`;
    if (engine) url += `?engine=${engine}`;
    const response = await fetch(url, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to start re-evaluation');
    return response.json();
  }
};
