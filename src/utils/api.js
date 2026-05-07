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

  getAuditLog: async () => {
    const response = await fetch(`${API_BASE_URL}/audit`);
    if (!response.ok) throw new Error('Failed to fetch audit log');
    return response.json();
  },

  createTender: async (tender) => {
    const response = await fetch(`${API_BASE_URL}/tenders?title=${encodeURIComponent(tender.title)}&department=${encodeURIComponent(tender.department)}&value=${encodeURIComponent(tender.value)}`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to create tender');
    return response.json();
  },

  updateEvaluation: async (evalId, verdict) => {
    const response = await fetch(`${API_BASE_URL}/evaluations/${evalId}?verdict=${verdict}`, { method: 'PUT' });
    if (!response.ok) throw new Error('Failed to update evaluation');
    return response.json();
  },

  seedData: async () => {
    const response = await fetch(`${API_BASE_URL}/seed`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to seed data');
    return response.json();
  }
};
