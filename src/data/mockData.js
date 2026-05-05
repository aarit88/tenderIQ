export const mockTenders = [
  {
    id: 'T-2024-001',
    title: 'Smart City Infrastructure Development — Phase II',
    department: 'Ministry of Urban Development',
    uploadDate: '2024-12-15',
    status: 'evaluated',
    bidderCount: 8,
    criteriaCount: 24,
    value: '₹450 Cr',
  },
  {
    id: 'T-2024-002',
    title: 'National Highway Expansion — NH48 Corridor',
    department: 'NHAI',
    uploadDate: '2024-12-20',
    status: 'in_review',
    bidderCount: 12,
    criteriaCount: 18,
    value: '₹1,200 Cr',
  },
  {
    id: 'T-2024-003',
    title: 'Digital Health Records Platform',
    department: 'Ministry of Health',
    uploadDate: '2025-01-05',
    status: 'extracting',
    bidderCount: 5,
    criteriaCount: 30,
    value: '₹85 Cr',
  },
  {
    id: 'T-2024-004',
    title: 'Railway Station Modernization — Tier-2 Cities',
    department: 'Indian Railways',
    uploadDate: '2025-01-10',
    status: 'pending',
    bidderCount: 0,
    criteriaCount: 0,
    value: '₹320 Cr',
  },
];

export const mockCriteria = [
  { id: 'C1', tenderId: 'T-2024-001', category: 'Financial', name: 'Minimum Annual Turnover', threshold: '> ₹50 Cr (avg. last 3 FY)', mandatory: true, sourcePage: 12, sourceText: 'The bidder must demonstrate an average annual turnover of not less than ₹50 Crores...' },
  { id: 'C2', tenderId: 'T-2024-001', category: 'Financial', name: 'Net Worth', threshold: '> ₹15 Cr', mandatory: true, sourcePage: 12, sourceText: 'Positive net worth of minimum ₹15 Crores as per latest audited balance sheet.' },
  { id: 'C3', tenderId: 'T-2024-001', category: 'Technical', name: 'Similar Project Experience', threshold: '≥ 3 projects of ₹20 Cr+', mandatory: true, sourcePage: 14, sourceText: 'Must have successfully completed at least 3 similar projects worth ₹20 Crores each...' },
  { id: 'C4', tenderId: 'T-2024-001', category: 'Technical', name: 'ISO 9001 Certification', threshold: 'Valid certificate', mandatory: true, sourcePage: 15, sourceText: 'The contractor shall possess valid ISO 9001:2015 quality management certification.' },
  { id: 'C5', tenderId: 'T-2024-001', category: 'Technical', name: 'Key Personnel Qualification', threshold: 'Min 5 engineers with 10+ yrs exp', mandatory: false, sourcePage: 16, sourceText: 'Key personnel should include minimum 5 qualified engineers with 10+ years experience...' },
  { id: 'C6', tenderId: 'T-2024-001', category: 'Compliance', name: 'EMD/Bid Security', threshold: '₹2 Cr bank guarantee', mandatory: true, sourcePage: 8, sourceText: 'Earnest Money Deposit of ₹2 Crores in the form of bank guarantee from scheduled bank.' },
  { id: 'C7', tenderId: 'T-2024-001', category: 'Compliance', name: 'GST Registration', threshold: 'Valid GSTIN', mandatory: true, sourcePage: 9, sourceText: 'Valid GST registration certificate must be furnished with the bid.' },
  { id: 'C8', tenderId: 'T-2024-001', category: 'Compliance', name: 'No Blacklisting', threshold: 'Self-declaration', mandatory: true, sourcePage: 10, sourceText: 'The bidder should not be blacklisted by any Central/State Government department.' },
  { id: 'C9', tenderId: 'T-2024-001', category: 'Financial', name: 'Working Capital', threshold: '> ₹10 Cr', mandatory: false, sourcePage: 13, sourceText: 'The bidder should have access to working capital or credit facility of at least ₹10 Crores.' },
  { id: 'C10', tenderId: 'T-2024-001', category: 'Technical', name: 'Equipment Ownership', threshold: 'Owned or lease agreement', mandatory: false, sourcePage: 17, sourceText: 'The bidder should own or have lease agreements for the specified construction equipment.' },
];

export const mockBidders = [
  { id: 'B1', tenderId: 'T-2024-001', name: 'Larsen & Toubro Ltd', documents: ['Financial_Statement_FY22-24.pdf', 'Technical_Proposal.pdf', 'Compliance_Docs.pdf'], status: 'parsed', matchScore: 92 },
  { id: 'B2', tenderId: 'T-2024-001', name: 'Tata Projects Ltd', documents: ['Annual_Reports.pdf', 'Project_Portfolio.docx', 'Certifications.pdf'], status: 'parsed', matchScore: 87 },
  { id: 'B3', tenderId: 'T-2024-001', name: 'NCC Limited', documents: ['Financial_Docs.pdf', 'Experience_Certificates.pdf'], status: 'parsed', matchScore: 74 },
  { id: 'B4', tenderId: 'T-2024-001', name: 'Shapoorji Pallonji', documents: ['Bid_Document_Complete.pdf'], status: 'parsing', matchScore: null },
  { id: 'B5', tenderId: 'T-2024-001', name: 'HCC Infrastructure', documents: ['Technical_Bid.pdf', 'Financial_Bid.pdf', 'Compliance.pdf'], status: 'parsed', matchScore: 68 },
];

export const mockEvaluations = [
  { id: 'E1', bidderId: 'B1', bidderName: 'Larsen & Toubro Ltd', criterionId: 'C1', criterionName: 'Minimum Annual Turnover', category: 'Financial', threshold: '> ₹50 Cr', extractedValue: '₹187 Cr (avg FY22-24)', sourcePage: 45, confidence: 'high', verdict: 'pass', matchType: 'direct', reasoning: 'Extracted turnover figures: FY22: ₹172 Cr, FY23: ₹189 Cr, FY24: ₹201 Cr. Average = ₹187 Cr, which exceeds the ₹50 Cr threshold. Values sourced from audited financial statements on pages 42-48.' },
  { id: 'E2', bidderId: 'B1', bidderName: 'Larsen & Toubro Ltd', criterionId: 'C2', criterionName: 'Net Worth', category: 'Financial', threshold: '> ₹15 Cr', extractedValue: '₹89 Cr', sourcePage: 48, confidence: 'high', verdict: 'pass', matchType: 'direct', reasoning: 'Net worth of ₹89 Crores identified from audited balance sheet FY2024, page 48. Clearly exceeds the minimum requirement of ₹15 Crores.' },
  { id: 'E3', bidderId: 'B1', bidderName: 'Larsen & Toubro Ltd', criterionId: 'C3', criterionName: 'Similar Project Experience', category: 'Technical', threshold: '≥ 3 projects of ₹20 Cr+', extractedValue: '5 projects identified (₹25-85 Cr range)', sourcePage: 12, confidence: 'medium', verdict: 'review', matchType: 'semantic', reasoning: 'Found 5 projects in portfolio: (1) Smart City Pune - ₹85Cr, (2) Metro Station Complex - ₹45Cr, (3) IT Park Development - ₹32Cr, (4) Township Project - ₹28Cr, (5) Hospital Complex - ₹25Cr. Projects 1,2,3 appear to be "similar" infrastructure projects. However, "similar" classification requires human judgment on scope alignment.' },
  { id: 'E4', bidderId: 'B1', bidderName: 'Larsen & Toubro Ltd', criterionId: 'C4', criterionName: 'ISO 9001 Certification', category: 'Technical', threshold: 'Valid certificate', extractedValue: 'ISO 9001:2015 — Valid till Mar 2026', sourcePage: 67, confidence: 'high', verdict: 'pass', matchType: 'direct', reasoning: 'ISO 9001:2015 certificate found on page 67, issued by Bureau Veritas, valid from April 2023 to March 2026. Certificate number: QMS-2023-IN-78542.' },
  { id: 'E5', bidderId: 'B1', bidderName: 'Larsen & Toubro Ltd', criterionId: 'C5', criterionName: 'Key Personnel Qualification', category: 'Technical', threshold: 'Min 5 engineers with 10+ yrs', extractedValue: '7 engineers listed (8-22 yrs exp)', sourcePage: 23, confidence: 'medium', verdict: 'review', matchType: 'semantic', reasoning: 'Found 7 engineers in team composition: 5 with 10+ years experience, 2 with 8 years. Meets the minimum count of 5 qualified engineers. However, qualification domains should be verified against tender requirements.' },
  { id: 'E6', bidderId: 'B1', bidderName: 'Larsen & Toubro Ltd', criterionId: 'C6', criterionName: 'EMD/Bid Security', category: 'Compliance', threshold: '₹2 Cr bank guarantee', extractedValue: 'BG of ₹2 Cr from SBI', sourcePage: 3, confidence: 'high', verdict: 'pass', matchType: 'direct', reasoning: 'Bank Guarantee of ₹2 Crores from State Bank of India found on page 3. BG No: SBI/BG/2024/78965, valid till June 2025.' },
  { id: 'E7', bidderId: 'B3', bidderName: 'NCC Limited', criterionId: 'C1', criterionName: 'Minimum Annual Turnover', category: 'Financial', threshold: '> ₹50 Cr', extractedValue: '₹42 Cr (avg FY22-24)', sourcePage: 38, confidence: 'high', verdict: 'fail', matchType: 'direct', reasoning: 'Extracted turnover: FY22: ₹38 Cr, FY23: ₹41 Cr, FY24: ₹47 Cr. Average = ₹42 Cr, which falls below the ₹50 Cr threshold. Bidder does not meet this mandatory financial criterion.' },
  { id: 'E8', bidderId: 'B3', bidderName: 'NCC Limited', criterionId: 'C3', criterionName: 'Similar Project Experience', category: 'Technical', threshold: '≥ 3 projects of ₹20 Cr+', extractedValue: '2 projects found (₹22 Cr, ₹18 Cr)', sourcePage: 15, confidence: 'low', verdict: 'fail', matchType: 'semantic', reasoning: 'Only 2 potentially similar projects found: (1) Highway Resurfacing - ₹22 Cr (partially similar), (2) Commercial Complex - ₹18 Cr (below threshold). Does not meet the minimum 3 projects requirement. Additionally, the ₹18 Cr project falls below the ₹20 Cr threshold.' },
];

export const mockAuditLog = [
  { id: 'A1', timestamp: '2025-01-15T14:32:00', user: 'Kunal Raj', action: 'upload', entity: 'Tender T-2024-001', details: 'Uploaded tender document: Smart_City_Phase_II_Tender.pdf (142 pages)', type: 'upload' },
  { id: 'A2', timestamp: '2025-01-15T14:35:00', user: 'System (AI)', action: 'extract', entity: 'Tender T-2024-001', details: 'Extracted 24 eligibility criteria from tender document using OCR + GPT-4o', type: 'action' },
  { id: 'A3', timestamp: '2025-01-15T15:10:00', user: 'Kunal Raj', action: 'approve', entity: 'Criteria C1-C10', details: 'Approved 10 extracted criteria after manual review. 0 corrections made.', type: 'approval' },
  { id: 'A4', timestamp: '2025-01-16T09:00:00', user: 'Priya Sharma', action: 'upload', entity: 'Bidder B1', details: 'Uploaded 3 documents for Larsen & Toubro: Financial, Technical, Compliance (total 234 pages)', type: 'upload' },
  { id: 'A5', timestamp: '2025-01-16T09:15:00', user: 'System (AI)', action: 'parse', entity: 'Bidder B1', details: 'Parsed 3 bidder documents. Extracted 24 evidence items with source references.', type: 'action' },
  { id: 'A6', timestamp: '2025-01-16T10:30:00', user: 'System (AI)', action: 'evaluate', entity: 'Bidder B1 × Tender T-2024-001', details: 'Completed matching: 7 Pass (High Confidence), 3 Review (Medium Confidence), 0 Fail', type: 'action' },
  { id: 'A7', timestamp: '2025-01-16T11:00:00', user: 'Kunal Raj', action: 'override', entity: 'Evaluation E3', details: 'Changed verdict from "Review" to "Pass" for Similar Project Experience — L&T. Reason: Verified project scope alignment with tender requirements.', type: 'alert' },
  { id: 'A8', timestamp: '2025-01-17T09:30:00', user: 'System (AI)', action: 'evaluate', entity: 'Bidder B3 × Tender T-2024-001', details: 'Completed matching: 4 Pass, 1 Review, 3 Fail. Bidder flagged for mandatory criteria failure.', type: 'action' },
  { id: 'A9', timestamp: '2025-01-17T14:00:00', user: 'Kunal Raj', action: 'export', entity: 'Audit Report', details: 'Exported complete audit trail for Tender T-2024-001 as PDF for CAG compliance.', type: 'action' },
  { id: 'A10', timestamp: '2025-01-18T10:00:00', user: 'Priya Sharma', action: 'upload', entity: 'Bidder B4', details: 'Uploaded bid document for Shapoorji Pallonji (1 document, 156 pages)', type: 'upload' },
];

export const dashboardStats = {
  activeTenders: { value: 4, change: '+2 this month', trend: 'up' },
  biddersEvaluated: { value: 28, change: '+5 this week', trend: 'up' },
  criteriaMatched: { value: 156, change: '92% accuracy', trend: 'up' },
  pendingReviews: { value: 7, change: '3 urgent', trend: 'down' },
};

export const evaluationSummary = [
  { name: 'High Confidence', value: 62, color: '#10b981' },
  { name: 'Medium (Review)', value: 23, color: '#f59e0b' },
  { name: 'Low / Failed', value: 15, color: '#ef4444' },
];

export const weeklyActivity = [
  { day: 'Mon', uploads: 3, evaluations: 8 },
  { day: 'Tue', uploads: 5, evaluations: 12 },
  { day: 'Wed', uploads: 2, evaluations: 15 },
  { day: 'Thu', uploads: 7, evaluations: 10 },
  { day: 'Fri', uploads: 4, evaluations: 18 },
  { day: 'Sat', uploads: 1, evaluations: 6 },
  { day: 'Sun', uploads: 0, evaluations: 2 },
];
