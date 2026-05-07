from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
import uvicorn
import shutil
import os
import uuid
import datetime

import hashlib

def calculate_hash(file_path):
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

from .database import engine, get_db, Base
from .models import models
from .services import ai_service

# Create tables
models.Base.metadata.create_all(bind=engine)

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app = FastAPI(title="TenderIQ API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "backend/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# API Routes
@app.get("/api")
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

@app.get("/tenders/{tender_id}/summary")
def get_tender_summary(tender_id: str, db: Session = Depends(get_db)):
    tender = db.query(models.Tender).filter(models.Tender.id == tender_id).first()
    if not tender: raise HTTPException(404, "Tender not found")
    
    bidders = db.query(models.Bidder).filter(models.Bidder.tender_id == tender_id).all()
    criteria = db.query(models.Criterion).filter(models.Criterion.tender_id == tender_id).all()
    
    summary = []
    for bidder in bidders:
        evals = db.query(models.Evaluation).filter(models.Evaluation.bidder_id == bidder.id).all()
        # Create a map of criterion_id -> verdict
        verdicts = {e.criterion_id: e.verdict for e in evals}
        summary.append({
            "bidder_id": bidder.id,
            "name": bidder.name,
            "status": bidder.status,
            "match_score": bidder.match_score,
            "is_disqualified": bidder.is_disqualified,
            "disqualification_reason": bidder.disqualification_reason,
            "verdicts": verdicts
        })
    
    return {
        "tender_id": tender_id,
        "criteria": [{"id": c.id, "name": c.name, "mandatory": c.mandatory} for c in criteria],
        "required_docs": tender.required_docs,
        "is_signed": tender.is_signed,
        "signed_by": tender.signed_by,
        "bidders": summary
    }

@app.post("/tenders/{tender_id}/sign")
def sign_tender(tender_id: str, officer_name: str, db: Session = Depends(get_db)):
    tender = db.query(models.Tender).filter(models.Tender.id == tender_id).first()
    if not tender: raise HTTPException(404, "Tender not found")
    
    tender.is_signed = True
    tender.signed_by = officer_name
    tender.signed_at = datetime.datetime.utcnow()
    
    db.add(models.AuditLog(user=officer_name, action="sign-off", entity="Tender", details=f"Final evaluation signed off for {tender_id}.", type="action"))
    db.commit()
    return {"message": "Tender signed off successfully"}

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
    
    # If a mandatory criterion is rejected, mark the bidder as disqualified
    bidder = db.query(models.Bidder).filter(models.Bidder.id == evaluation.bidder_id).first()
    criterion = db.query(models.Criterion).filter(models.Criterion.id == evaluation.criterion_id).first()
    
    if bidder and criterion:
        if verdict == "ineligible" and criterion.mandatory:
            bidder.is_disqualified = True
            bidder.disqualification_reason = f"Human override: Failed mandatory criterion {criterion.name}"
        elif verdict == "eligible" and criterion.mandatory:
            # Check if any OTHER mandatory criteria are failing before clearing disqualification
            other_fails = db.query(models.Evaluation).join(models.Criterion).filter(
                models.Evaluation.bidder_id == bidder.id,
                models.Criterion.mandatory == True,
                models.Evaluation.verdict == "ineligible",
                models.Evaluation.id != eval_id
            ).count()
            if other_fails == 0:
                bidder.is_disqualified = False
                bidder.disqualification_reason = None
        
        # Recalculate score
        evals = db.query(models.Evaluation).filter(models.Evaluation.bidder_id == bidder.id).all()
        eligible_count = sum(1 for e in evals if e.verdict == "eligible")
        if len(evals) > 0:
            bidder.match_score = (eligible_count / len(evals)) * 100
    
    # Log the human override
    audit = models.AuditLog(
        user="CRPF Officer", 
        action="approval" if verdict == "eligible" else "override", 
        entity=f"Eval {eval_id}", 
        details=f"Human override: Changed verdict from {old_verdict} to {verdict}. Updated bidder status.", 
        type="approval" if verdict == "eligible" else "alert"
    )
    db.add(audit)
    db.commit()
    return {"message": "Verdict updated"}

@app.post("/tenders/upload")
async def upload_tender(
    title: str = Form(...),
    department: str = Form(...),
    value: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    tender_id = f"T-{uuid.uuid4().hex[:4].upper()}"
    file_path = os.path.join(UPLOAD_DIR, "tenders", f"{tender_id}_{file.filename}")
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    file_hash = calculate_hash(file_path)
    tender = models.Tender(id=tender_id, title=title, department=department, value=value, status="parsing", document_path=file_path, file_hash=file_hash)
    db.add(tender)
    db.commit()

    # AI Extraction
    ai_data = ai_service.extract_criteria_from_tender(file_path)
    tender.required_docs = ai_data.get("required_docs", [])
    db.commit()

    for i, c in enumerate(ai_data.get("criteria", [])):
        crit = models.Criterion(
            id=f"C-{tender_id}-{i}",
            tender_id=tender_id,
            category=c.get("category", "General"),
            name=c.get("name", "Unnamed"),
            threshold=c.get("threshold", "N/A"),
            mandatory=c.get("mandatory", True),
            source_page=c.get("source_page", 1),
            source_text=c.get("source_text", "")
        )
        db.add(crit)
    
    tender.status = "evaluated"
    db.add(models.AuditLog(user="System (AI)", action="extraction", entity=f"Tender {tender_id}", details=f"Extracted {len(ai_data.get('criteria', []))} criteria from document.", type="action"))
    db.commit()
    db.refresh(tender)
    return tender

@app.post("/bidders/upload")
async def upload_bidder(
    tender_id: str = Form(...),
    name: str = Form(...),
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    bidder_id = f"B-{uuid.uuid4().hex[:4].upper()}"
    saved_files = []
    file_hashes = {}
    
    bidder_dir = os.path.join(UPLOAD_DIR, "bidders", bidder_id)
    os.makedirs(bidder_dir, exist_ok=True)
    
    for file in files:
        file_path = os.path.join(bidder_dir, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        saved_files.append(file_path)
        file_hashes[file.filename] = calculate_hash(file_path)
    
    bidder = models.Bidder(id=bidder_id, tender_id=tender_id, name=name, status="parsing", documents=[f.filename for f in files], file_hashes=file_hashes)
    db.add(bidder)
    db.commit()

    # Get tender criteria
    criteria = db.query(models.Criterion).filter(models.Criterion.tender_id == tender_id).all()
    criteria_dicts = [{"id": c.id, "category": c.category, "name": c.name, "threshold": c.threshold, "mandatory": c.mandatory} for c in criteria]
    
    # AI Evaluation
    ai_result = ai_service.evaluate_bidder_against_criteria(saved_files, criteria_dicts)
    evaluations_data = ai_result.get("evaluations", [])
    bidder.checklist_status = ai_result.get("checklist", {})
    
    total_criteria = len(evaluations_data)
    eligible_count = 0
    
    for res in evaluations_data:
        # Check if this criterion was mandatory
        criterion_obj = next((c for c in criteria if c.id == res.get("criterion_id")), None)
        is_mandatory = criterion_obj.mandatory if criterion_obj else False
        
        evaluation = models.Evaluation(
            bidder_id=bidder_id,
            criterion_id=res.get("criterion_id"),
            verdict=res.get("verdict", "review"),
            confidence=res.get("confidence", "low"),
            match_type=res.get("match_type", "semantic"),
            extracted_value=res.get("extracted_value", "N/A"),
            reasoning=res.get("reasoning", ""),
            source_page=res.get("source_page", 1),
            source_document=res.get("source_document", "Unknown"),
            evidence_snippet=res.get("evidence_snippet", ""),
            action_required=res.get("action_required", "")
        )
        db.add(evaluation)
        
        if res.get("verdict") == "eligible":
            eligible_count += 1
        elif res.get("verdict") == "ineligible" and is_mandatory:
            bidder.is_disqualified = True
            bidder.disqualification_reason = f"Failed mandatory criterion: {criterion_obj.name if criterion_obj else res.get('criterion_id')}"

    # Update bidder status and score
    bidder.status = "parsed"
    if total_criteria > 0:
        bidder.match_score = (eligible_count / total_criteria) * 100
    else:
        bidder.match_score = 100
        
    db.add(models.AuditLog(user="System (AI)", action="evaluation", entity=f"Bidder {bidder_id}", details=f"Evaluated {total_criteria} criteria. Result: {bidder.match_score}% match.", type="action"))
    db.commit()
    db.refresh(bidder)
    return bidder

# Keep seed for quick setup but use it sparingly
@app.post("/seed")
def seed_data(db: Session = Depends(get_db)):
    db.query(models.Evaluation).delete()
    db.query(models.Bidder).delete()
    db.query(models.Criterion).delete()
    db.query(models.Tender).delete()
    db.query(models.AuditLog).delete()
    
    t1 = models.Tender(id="CRPF-CONST-2024", title="Construction of Tier-3 Data Center & Residential Complex", department="CRPF — Procurement Wing", status="evaluated", value="₹12.5 Cr", 
                       required_docs=["GST Registration", "ISO 9001:2015", "Audited Balance Sheets (3 yrs)", "PAN Card", "MSME Certificate"])
    db.add(t1)
    db.commit()
    
    c1 = models.Criterion(id="C1", tender_id="CRPF-CONST-2024", category="Financial", name="Minimum Annual Turnover", threshold="> ₹5 Crore", mandatory=True, source_page=12, source_text="The bidder must demonstrate an average annual turnover of not less than ₹5 Crores...")
    c2 = models.Criterion(id="C2", tender_id="CRPF-CONST-2024", category="Technical", name="Similar Project Experience", threshold="≥ 3 projects in last 5 years", mandatory=True, source_page=14, source_text="Bidder must have completed 3 similar construction projects...")
    c3 = models.Criterion(id="C3", tender_id="CRPF-CONST-2024", category="Compliance", name="GST Registration", threshold="Valid GSTIN Certificate", mandatory=True, source_page=5, source_text="Possession of valid GST registration is mandatory.")
    c4 = models.Criterion(id="C4", tender_id="CRPF-CONST-2024", category="Compliance", name="ISO 9001 Certification", threshold="Valid Quality Certificate", mandatory=True, source_page=8, source_text="Bidder must possess valid ISO 9001:2015 certification.")
    db.add(c1)
    db.add(c2)
    db.add(c3)
    db.add(c4)
    
    b1 = models.Bidder(id="B-LT", tender_id="CRPF-CONST-2024", name="L&T Construction", status="parsed", match_score=100.0, documents=["Balance_Sheet.pdf", "ISO_Cert.jpg"],
                       checklist_status={"GST Registration": "found", "ISO 9001:2015": "found", "Audited Balance Sheets (3 yrs)": "found", "PAN Card": "found", "MSME Certificate": "found"})
    db.add(b1)
    db.commit()
    
    b2 = models.Bidder(id="B-GA", tender_id="CRPF-CONST-2024", name="GMR Infrastructure", status="parsed", match_score=75.0, documents=["GMR_Fin.pdf"],
                       checklist_status={"GST Registration": "found", "ISO 9001:2015": "missing", "Audited Balance Sheets (3 yrs)": "found", "PAN Card": "found", "MSME Certificate": "found"})
    db.add(b2)
    db.commit()
    
    db.add(models.Evaluation(bidder_id="B-GA", criterion_id="C1", verdict="eligible", confidence="medium", match_type="semantic", extracted_value="₹8.1 Cr", reasoning="Turnover found in annual report.", source_page=2, source_document="GMR_Fin.pdf"))
    
    db.add(models.Evaluation(
        bidder_id="B-LT", 
        criterion_id="C1", 
        verdict="eligible", 
        confidence="high", 
        match_type="direct", 
        extracted_value="₹14.2 Cr (Avg)", 
        reasoning="Turnover figures extracted from audited Balance Sheet 2021-2023.", 
        source_page=4,
        source_document="Balance_Sheet.pdf",
        evidence_snippet="The average turnover for the period 2021-2023 is calculated as ₹14.2 Crores based on figures on Page 4.",
        action_required="None"
    ))
    db.add(models.AuditLog(user="System", action="seed", entity="Database", details="Database seeded with sample CRPF data.", type="action"))
    db.commit()
    return {"message": "CRPF Data Seeded Successfully"}

# Serve Frontend Static Files
# Note: In production, the 'dist' folder will be in the root
dist_path = os.path.abspath(os.path.join(os.getcwd(), "dist"))
if os.path.exists(dist_path):
    app.mount("/", StaticFiles(directory=dist_path, html=True), name="static")

    @app.exception_handler(404)
    async def not_found_exception_handler(request, exc):
        return FileResponse(os.path.join(dist_path, "index.html"))

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=port, reload=True)
