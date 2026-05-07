# Technical Solution Proposal: TenderIQ
**Theme 3: AI-Based Tender Evaluation for CRPF**

## 1. Problem Understanding & Vision
Government procurement, particularly for organizations like the **CRPF**, is a high-stakes environment where eligibility checks must be **unassailable, consistent, and fast**. Currently, manual evaluation is a bottleneck that introduces human error and audit risks.

**TenderIQ** is designed to transform this unstructured chaos into a structured, auditable decision-making pipeline. Our platform doesn't just "read" documents; it **audits** them by matching extracted evidence against regulatory and financial thresholds with 100% traceability.

---

## 2. Technical Architecture & Approach

### A. Criteria Extraction (The "Legal" Layer)
We use **Google Gemini 1.5 Flash** to ingest long-form tender PDFs (up to 1M tokens). 
- **Mandatory vs. Optional:** Our LLM prompt is engineered to detect legal markers (e.g., "shall," "must," "mandatory") to automatically flag essential criteria.
- **Categorization:** Criteria are classified into Technical, Financial, and Compliance buckets to streamline the evaluation committee's focus.

### B. Multimodal Bidder Parsing (The "Vision" Layer)
To meet the requirement for handling **scanned documents and photographs**, our pipeline is **multimodal**.
- **OCR-Free Vision:** Instead of traditional OCR which loses layout context, we pass image files (JPG/PNG) directly to Gemini's vision encoder. This allows the AI to "see" stamps, signatures, and handwritten figures on certificates with high spatial accuracy.
- **Document Hashing:** Every file uploaded is processed via **SHA-256 hashing**. This hash is stored in the database, ensuring that the "Evidence" used for a decision cannot be swapped or altered post-evaluation.

### C. Evaluation & Reasoning Engine
- **Semantic Matching:** The engine handles variations in language (e.g., matching "Gross Revenue" to "Turnover") by performing semantic comparisons rather than simple keyword matching.
- **Explainability:** Every "Verdict" (Eligible/Ineligible) is accompanied by a **Reasoning String** and a **Source Citation** (Document Name & Page Number), allowing an officer to verify the AI's "work" in seconds.

---

## 3. Deep Decision Logic & Real-World Compliance

### A. Automated Compliance Checklist (The "Pre-Check")
To simulate real government rigor, TenderIQ generates an automated **Document Checklist** from the tender. Before the AI evaluates a bidder's eligibility, it verifies the **presence** of mandatory files (PAN, GST, MSME). Any missing documents are instantly flagged as a compliance risk.

### B. Financial Logic Engine (3-Year Averaging)
Our AI doesn't just look for a single number. It is programmed to extract multi-year financial data from balance sheets, **calculate the average annual turnover**, and compare it against the tender threshold. This replaces hours of manual calculator work with a single automated check.

### C. Digital Sign-Off & Evaluation Freezing
Once the committee reaches a consensus, the platform enables a **Digital Sign-off**. 
- **State Locking:** Signing the report "freezes" all evaluations and results, preventing post-decision tampering.
- **Forensic Audit:** The officer's name, timestamp, and a summary of the decision are permanently etched into the immutable Audit Log.

---

## 4. Side-by-Side Comparative Analysis
TenderIQ provides a **Comparison Modal** that allows officers to pin two bidders against each other. This surfacing of relative strengths and weaknesses is critical for cases where multiple bidders are technically eligible but vary in financial stability or past project scale.

---

## 5. Key Technology & Model Choices
| Component | Choice | Rationale |
| :--- | :--- | :--- |
| **LLM / Vision** | Gemini 1.5 Flash | Multimodal native support (handles photos/scans) and massive context window for long tenders. |
| **Backend** | FastAPI / Python | High performance, excellent support for asynchronous file processing. |
| **Frontend** | React / Vite | Premium, glassmorphic UI designed for high-density information display. |
| **Audit Layer** | SHA-256 Hashing | Ensures document integrity and non-repudiation in a government context. |

---

## 5. Risks & Trade-offs
1. **Risk:** AI Hallucinations in financial figures.
   * **Mitigation:** We enforce a "Strict Citation" rule. If the AI cannot point to a specific page/text snippet, the verdict is forced to "Manual Review."
2. **Risk:** Variable scan quality.
   * **Mitigation:** The system uses confidence scoring. Low-quality images trigger a "Review Required" status with a reason (e.g., "Handwriting illegible").

---

## 6. Round 2 Implementation Plan
1. **Sandbox Deployment:** Containerize the application for easy deployment in the hackathon sandbox.
2. **Local LLM Fallback:** Integrate **Ollama** support for environments where external API access (Gemini) is restricted.
3. **Advanced PDF Highlighting:** Implement a PDF viewer that automatically scrolls to and highlights the AI-cited evidence.
