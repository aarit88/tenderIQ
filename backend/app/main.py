from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
import uvicorn

from .database import engine, get_db, Base
from .models import models

# Create tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="TenderIQ API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "TenderIQ API is running"}

@app.get("/tenders")
def get_tenders(db: Session = Depends(get_db)):
    return db.query(models.Tender).all()

@app.get("/tenders/{tender_id}/criteria")
def get_criteria(tender_id: str, db: Session = Depends(get_db)):
    return db.query(models.Criterion).filter(models.Criterion.tender_id == tender_id).all()

@app.get("/bidders")
def get_bidders(db: Session = Depends(get_db)):
    return db.query(models.Bidder).all()

@app.get("/evaluations/{bidder_id}")
def get_evaluations(bidder_id: str, db: Session = Depends(get_db)):
    return db.query(models.Evaluation).filter(models.Evaluation.bidder_id == bidder_id).all()

@app.get("/audit")
def get_audit(db: Session = Depends(get_db)):
    return db.query(models.AuditLog).order_by(models.AuditLog.timestamp.desc()).all()

@app.put("/evaluations/{eval_id}")
def update_evaluation(eval_id: int, verdict: str, db: Session = Depends(get_db)):
    evaluation = db.query(models.Evaluation).filter(models.Evaluation.id == eval_id).first()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    
    old_verdict = evaluation.verdict
    evaluation.verdict = verdict
    
    # If a mandatory criterion is rejected, mark the bidder as ineligible
    bidder = db.query(models.Bidder).filter(models.Bidder.id == evaluation.bidder_id).first()
    if bidder and verdict == "ineligible":
        bidder.match_score = 0  # Force to 0 for demo purposes to reflect in Dashboard
    elif bidder and verdict == "eligible":
        bidder.match_score = 100
    
    # Log the human override
    audit = models.AuditLog(
        user="CRPF Officer", 
        action="approval" if verdict == "eligible" else "override", 
        entity=f"Eval {eval_id}", 
        details=f"Human override: Changed verdict from {old_verdict} to {verdict}. Bidder score updated.", 
        type="approval" if verdict == "eligible" else "alert"
    )
    db.add(audit)
    db.commit()
    return {"message": "Verdict and Bidder score updated"}

@app.post("/tenders")
def create_tender(title: str, department: str, value: str, db: Session = Depends(get_db)):
    import uuid
    new_id = f"T-{uuid.uuid4().hex[:4].upper()}"
    tender = models.Tender(id=new_id, title=title, department=department, value=value, status="pending")
    db.add(tender)
    # Add audit log for this action
    audit = models.AuditLog(user="System", action="create", entity=f"Tender {new_id}", details=f"Created new tender: {title}", type="action")
    db.add(audit)
    db.commit()
    db.refresh(tender)
    return tender

# Helper to seed data
@app.post("/seed")
def seed_data(db: Session = Depends(get_db)):
    # Clear existing data for a clean CRPF demo
    db.query(models.Evaluation).delete()
    db.query(models.Bidder).delete()
    db.query(models.Criterion).delete()
    db.query(models.Tender).delete()
    db.query(models.AuditLog).delete()
    
    # 1. Tender: CRPF Construction Services
    t1 = models.Tender(
        id="CRPF-CONST-2024", 
        title="Construction of Tier-3 Data Center & Residential Complex", 
        department="CRPF — Procurement Wing", 
        status="evaluated", 
        value="₹12.5 Cr"
    )
    db.add(t1)
    db.commit() # Commit to get ID if needed, though we use fixed IDs
    
    # 2. Criteria
    c1 = models.Criterion(id="C1", tender_id="CRPF-CONST-2024", category="Financial", name="Minimum Annual Turnover", threshold="> ₹5 Crore", mandatory=True, source_page=12, source_text="The bidder must demonstrate an average annual turnover of not less than ₹5 Crores...")
    c2 = models.Criterion(id="C2", tender_id="CRPF-CONST-2024", category="Technical", name="Similar Project Experience", threshold="≥ 3 projects in last 5 years", mandatory=True, source_page=14, source_text="Bidder must have completed 3 similar construction projects...")
    c3 = models.Criterion(id="C3", tender_id="CRPF-CONST-2024", category="Compliance", name="GST Registration", threshold="Valid GSTIN Certificate", mandatory=True, source_page=5, source_text="Possession of valid GST registration is mandatory.")
    c4 = models.Criterion(id="C4", tender_id="CRPF-CONST-2024", category="Compliance", name="ISO 9001 Certification", threshold="Valid Quality Certificate", mandatory=True, source_page=8, source_text="Bidder must possess valid ISO 9001:2015 certification.")
    
    db.add(c1); db.add(c2); db.add(c3); db.add(c4)
    
    # 3. Bidders
    b1 = models.Bidder(id="B-LT", tender_id="CRPF-CONST-2024", name="L&T Construction", status="parsed", match_score=100.0, documents=["Balance_Sheet.pdf", "ISO_Cert.jpg", "GST_Reg.pdf"])
    b2 = models.Bidder(id="B-NCC", tender_id="CRPF-CONST-2024", name="NCC Ltd", status="parsed", match_score=45.0, documents=["Financials.pdf", "Projects.docx"])
    b3 = models.Bidder(id="B-AMB", tender_id="CRPF-CONST-2024", name="Ambiguous Builders Inc", status="parsed", match_score=75.0, documents=["Scanned_Turnover.png", "ISO.pdf"])
    
    db.add(b1); db.add(b2); db.add(b3)
    
    # 4. Evaluations (L&T - ALL ELIGIBLE)
    db.add(models.Evaluation(bidder_id="B-LT", criterion_id="C1", verdict="eligible", confidence="high", match_type="direct", extracted_value="₹14.2 Cr (Avg)", reasoning="Turnover figures extracted from audited Balance Sheet. Meets ₹5Cr requirement.", source_page=4))
    db.add(models.Evaluation(bidder_id="B-LT", criterion_id="C2", verdict="eligible", confidence="high", match_type="direct", extracted_value="4 Projects", reasoning="Verified 4 major projects completed in the last 5 years.", source_page=8))
    db.add(models.Evaluation(bidder_id="B-LT", criterion_id="C3", verdict="eligible", confidence="high", match_type="direct", extracted_value="Valid GSTIN", reasoning="Valid GST registration certificate found.", source_page=2))
    db.add(models.Evaluation(bidder_id="B-LT", criterion_id="C4", verdict="eligible", confidence="high", match_type="direct", extracted_value="ISO 9001:2015", reasoning="Current ISO certificate verified.", source_page=1))

    # NCC - INELIGIBLE
    db.add(models.Evaluation(bidder_id="B-NCC", criterion_id="C1", verdict="ineligible", confidence="high", match_type="direct", extracted_value="₹3.8 Cr (Avg)", reasoning="Average turnover falls below the mandatory ₹5Cr threshold.", source_page=12))
    
    # Ambiguous - REVIEW
    db.add(models.Evaluation(bidder_id="B-AMB", criterion_id="C1", verdict="review", confidence="low", match_type="semantic", extracted_value="Undetermined", reasoning="Scanned document handwriting could not be read with confidence. Manual review required.", source_page=1))
    
    # 5. Audit
    db.add(models.AuditLog(user="System (AI)", action="extraction", entity="CRPF-CONST-2024", details="Extracted 4 mandatory criteria for 3 bidders.", type="action"))
    
    db.commit()
    return {"message": "CRPF Data Fixed & Seeded Successfully"}

if __name__ == "__main__":
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
