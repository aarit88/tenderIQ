from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
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

from .database import engine, get_db, Base, SessionLocal
from .models import models
from .services import ai_service
from .config import settings

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

UPLOAD_DIR = settings.UPLOAD_DIR
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Global settings (simplified for now, could be in DB)
preferred_ai_engine = "auto" # auto, gemini, ollama

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


@app.post("/evaluations/upsert")
def upsert_evaluation(data: dict, db: Session = Depends(get_db)):
    bidder_id = data.get("bidder_id")
    criterion_id = data.get("criterion_id")
    verdict = data.get("verdict")
    
    evaluation = db.query(models.Evaluation).filter(
        models.Evaluation.bidder_id == bidder_id,
        models.Evaluation.criterion_id == criterion_id
    ).first()
    
    if not evaluation:
        evaluation = models.Evaluation(
            bidder_id=bidder_id,
            criterion_id=criterion_id,
            verdict=verdict,
            confidence="high",
            match_type="manual",
            extracted_value="User Override",
            reasoning="Manually evaluated by user",
            source_page=0,
            source_document="N/A",
            evidence_snippet="User manual selection",
            action_required="",
            ai_engine="manual"
        )
        db.add(evaluation)
        db.flush()
    else:
        evaluation.verdict = verdict
        evaluation.match_type = "manual"
        evaluation.reasoning = "Manually updated by user"
    
    return _perform_verdict_update(evaluation, verdict, db)

@app.put("/evaluations/{eval_id}")
def update_evaluation(eval_id: int, verdict: str, db: Session = Depends(get_db)):
    evaluation = db.query(models.Evaluation).filter(models.Evaluation.id == eval_id).first()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    
    return _perform_verdict_update(evaluation, verdict, db)

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

@app.get("/settings/ai")
def get_ai_settings():
    return {"preferred_engine": preferred_ai_engine}

@app.post("/settings/ai")
def update_ai_settings(data: dict):
    global preferred_ai_engine
    engine = data.get("preferred_engine")
    if engine not in ["auto", "gemini", "ollama"]:
        raise HTTPException(400, "Invalid engine. Must be auto, gemini, or ollama.")
    preferred_ai_engine = engine
    return {"preferred_engine": preferred_ai_engine}

@app.get("/api/health/ollama")
async def check_ollama_health():
    try:
        import requests
        response = requests.get(f"{settings.OLLAMA_HOST}/api/tags", timeout=2)
        if response.status_code == 200:
            return {"status": "online", "models": response.json().get("models", [])}
        return {"status": "offline", "error": "Ollama returned non-200 status"}
    except Exception as e:
        return {"status": "offline", "error": str(e)}

def _recompute_bidder_score(bidder, db) -> float:
    """
    Central score calculation used by ALL code paths.
    Score = (eligible verdicts) / (total tender criteria) * 100
    Only 'eligible' counts — 'review' and 'ineligible' both score 0.
    """
    total_criteria = db.query(models.Criterion).filter(
        models.Criterion.tender_id == bidder.tender_id
    ).count()
    if total_criteria == 0:
        return None
    evals = db.query(models.Evaluation).filter(
        models.Evaluation.bidder_id == bidder.id
    ).all()
    eligible_count = sum(1 for e in evals if e.verdict == "eligible")
    return round((eligible_count / total_criteria) * 100, 1)


@app.post("/criteria")
def create_criterion(criterion: dict, db: Session = Depends(get_db)):
    # criterion should have tender_id, category, name, threshold, mandatory
    new_crit = models.Criterion(
        id=f"C-MANUAL-{uuid.uuid4().hex[:4].upper()}",
        tender_id=criterion.get("tender_id"),
        category=criterion.get("category", "General"),
        name=criterion.get("name"),
        threshold=criterion.get("threshold", "N/A"),
        mandatory=criterion.get("mandatory", True),
        source_page=0,
        source_text="Manually added by user"
    )
    db.add(new_crit)
    db.commit()
    db.refresh(new_crit)
    return new_crit

@app.put("/criteria/{criterion_id}")
def update_criterion(criterion_id: str, updates: dict, db: Session = Depends(get_db)):
    crit = db.query(models.Criterion).filter(models.Criterion.id == criterion_id).first()
    if not crit: raise HTTPException(404, "Criterion not found")
    
    for key, value in updates.items():
        if hasattr(crit, key):
            setattr(crit, key, value)
    
    db.commit()
    return crit

@app.delete("/criteria/{criterion_id}")
def delete_criterion(criterion_id: str, db: Session = Depends(get_db)):
    crit = db.query(models.Criterion).filter(models.Criterion.id == criterion_id).first()
    if not crit: raise HTTPException(404, "Criterion not found")
    
    # Also delete evaluations for this criterion
    db.query(models.Evaluation).filter(models.Evaluation.criterion_id == criterion_id).delete()
    
    db.delete(crit)
    db.commit()
    return {"message": "Criterion deleted"}

def _perform_verdict_update(evaluation, verdict, db: Session):
    old_verdict = evaluation.verdict
    evaluation.verdict = verdict
    db.flush()
    
    bidder = db.query(models.Bidder).filter(models.Bidder.id == evaluation.bidder_id).first()
    criterion = db.query(models.Criterion).filter(models.Criterion.id == evaluation.criterion_id).first()
    
    if bidder and criterion:
        if verdict == "ineligible" and criterion.mandatory:
            bidder.is_disqualified = True
            bidder.disqualification_reason = f"Human override: Failed mandatory criterion: {criterion.name}"
        elif verdict == "eligible" and criterion.mandatory:
            other_fails = db.query(models.Evaluation).join(models.Criterion).filter(
                models.Evaluation.bidder_id == bidder.id,
                models.Criterion.mandatory == True,
                models.Evaluation.verdict == "ineligible",
                models.Evaluation.id != evaluation.id
            ).count()
            if other_fails == 0:
                bidder.is_disqualified = False
                bidder.disqualification_reason = None
        
        new_score = _recompute_bidder_score(bidder, db)
        bidder.match_score = new_score
        db.add(models.AuditLog(
            user="CRPF Officer",
            action="approval" if verdict == "eligible" else "override",
            entity=f"Bidder {bidder.id}",
            details=(
                f"Human override: '{old_verdict}' → '{verdict}' "
                f"for criterion '{criterion.name}'. "
                f"New score: {new_score}%."
            ),
            type="approval" if verdict == "eligible" else "alert"
        ))
    
    db.commit()
    return {"message": "Verdict updated", "new_score": bidder.match_score if bidder else None}

async def process_tender_background(tender_id: str, file_path: str):
    db = SessionLocal()
    try:
        tender = db.query(models.Tender).filter(models.Tender.id == tender_id).first()
        if not tender: return

        # AI Extraction - respect global setting
        ai_data = ai_service.extract_criteria_from_tender(file_path, preferred_engine=preferred_ai_engine)
        tender.required_docs = ai_data.get("required_docs", [])
        engine_used = ai_data.get("_engine", "unknown")
        
        # Clear any existing criteria for this tender (if any)
        db.query(models.Criterion).filter(models.Criterion.tender_id == tender_id).delete()

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
        db.add(models.AuditLog(user=f"System ({engine_used})", action="extraction", entity=f"Tender {tender_id}", details=f"Extracted {len(ai_data.get('criteria', []))} criteria using {engine_used}.", type="action"))
        db.commit()
    except Exception as e:
        print(f"Background extraction failed: {e}")
        if tender:
            tender.status = "error"
            db.commit()
    finally:
        db.close()

@app.post("/tenders/upload")
async def upload_tender(
    background_tasks: BackgroundTasks,
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
    db.refresh(tender)

    background_tasks.add_task(process_tender_background, tender_id, file_path)
    
    return tender

async def process_bidder_background(bidder_id: str, tender_id: str, saved_files: List[str], engine_override: str = None):
    db = SessionLocal()
    try:
        # Use override if provided (for re-evaluation), otherwise use global setting
        target_engine = engine_override or preferred_ai_engine
        bidder = db.query(models.Bidder).filter(models.Bidder.id == bidder_id).first()
        if not bidder: return

        # Get tender criteria
        criteria = db.query(models.Criterion).filter(models.Criterion.tender_id == tender_id).all()
        criteria_dicts = [{"id": c.id, "category": c.category, "name": c.name, "threshold": c.threshold, "mandatory": c.mandatory} for c in criteria]

        # Score denominator = ALL tender criteria (never the AI's partial return)
        total_tender_criteria = len(criteria_dicts)

        # AI Evaluation
        ai_result = ai_service.evaluate_bidder_against_criteria(saved_files, criteria_dicts, preferred_engine=target_engine)
        evaluations_data = ai_result.get("evaluations", [])
        bidder.checklist_status = ai_result.get("checklist", {})
        is_simulated = ai_result.get("_simulated", False)
        engine_used = ai_result.get("_engine", "unknown")

        # Build lookup of criterion_id -> AI result
        ai_eval_map = {res.get("criterion_id"): res for res in evaluations_data}

        eligible_count = 0

        # Sentinel values that mean "no real evidence found" — used to catch AI hallucinations
        _NO_EVIDENCE = {"not found", "n/a", "none", "", "no evidence found", "ai engines offline — manual review required"}

        # Clear existing evaluations
        db.query(models.Evaluation).filter(models.Evaluation.bidder_id == bidder_id).delete()

        for crit in criteria:
            res = ai_eval_map.get(crit.id)

            if res is None:
                # AI did not return an evaluation for this criterion — treat as ineligible
                verdict = "ineligible"
                evaluation = models.Evaluation(
                    bidder_id=bidder_id,
                    criterion_id=crit.id,
                    verdict="ineligible",
                    confidence="high",
                    match_type="none",
                    extracted_value="Not found",
                    reasoning=(
                        f"AI did not find any evidence for '{crit.name}' (threshold: {crit.threshold}) "
                        f"in the submitted documents. This criterion was not evaluated — "
                        f"treated as ineligible by default."
                    ),
                    source_page=0,
                    source_document=saved_files[0].split(os.sep)[-1] if saved_files else "Unknown",
                    evidence_snippet="No evidence found",
                    action_required=f"Upload a document that explicitly proves '{crit.name}'."
                )
            else:
                verdict = res.get("verdict", "ineligible")

                # ── Hallucination guard ───────────────────────────────────────────
                # If AI claims 'eligible' but the extracted_value or evidence_snippet
                # contains no real content, downgrade to 'review' so a human verifies.
                if verdict == "eligible":
                    extracted = str(res.get("extracted_value") or "").strip().lower()
                    snippet   = str(res.get("evidence_snippet") or "").strip().lower()
                    if extracted in _NO_EVIDENCE and snippet in _NO_EVIDENCE:
                        verdict = "review"
                        res["reasoning"] = (
                            f"[AUTO-DOWNGRADED] AI claimed 'eligible' but provided no extracted value "
                            f"or evidence snippet for '{crit.name}'. Flagged for manual review."
                        )
                        res["action_required"] = (
                            f"Manual review required: verify that '{crit.name}' is genuinely met. "
                            f"No supporting evidence was extracted from the document."
                        )
                # ─────────────────────────────────────────────────────────────────

                evaluation = models.Evaluation(
                    bidder_id=bidder_id,
                    criterion_id=crit.id,
                    verdict=verdict,
                    confidence=res.get("confidence", "low"),
                    match_type=res.get("match_type", "semantic"),
                    extracted_value=res.get("extracted_value", "N/A"),
                    reasoning=res.get("reasoning", ""),
                    source_page=res.get("source_page", 1),
                    source_document=res.get("source_document", "Unknown"),
                    evidence_snippet=res.get("evidence_snippet", ""),
                    action_required=res.get("action_required", ""),
                    ai_engine=engine_used
                )

            db.add(evaluation)

            # Only 'eligible' counts toward the score; 'review' and 'ineligible' score 0
            if verdict == "eligible":
                eligible_count += 1
            elif verdict == "ineligible" and crit.mandatory:
                bidder.is_disqualified = True
                bidder.disqualification_reason = f"Failed mandatory criterion: {crit.name}"

        if is_simulated:
            # AI was offline — do NOT assign a fake match score. Mark for human review.
            bidder.status = "needs_review"
            bidder.match_score = None
            bidder.is_disqualified = False
            bidder.disqualification_reason = None
            db.add(models.AuditLog(user="System (AI)", action="evaluation", entity=f"Bidder {bidder_id}", details=f"AI engines offline. {total_tender_criteria} criteria flagged for manual review.", type="alert"))
        elif total_tender_criteria > 0:
            bidder.status = "parsed"
            # Score = eligible-only out of ALL tender criteria (denominator never shrinks)
            bidder.match_score = round((eligible_count / total_tender_criteria) * 100, 1)
            if eligible_count == 0:
                bidder.is_disqualified = True
                bidder.disqualification_reason = "Zero criteria matched in submitted documents."
            ineligible_count = total_tender_criteria - eligible_count
            db.add(models.AuditLog(
                user="System (AI)", action="evaluation", entity=f"Bidder {bidder_id}",
                details=(
                    f"Evaluated {total_tender_criteria} criteria using {engine_used}. "
                    f"Eligible: {eligible_count} | "
                    f"Ineligible/Review: {ineligible_count}. "
                    f"Score: {bidder.match_score}%."
                ),
                type="action"
            ))
        else:
            bidder.status = "needs_review"
            bidder.match_score = None
            bidder.is_disqualified = True
            bidder.disqualification_reason = "No tender criteria available. Upload a tender document first."
            db.add(models.AuditLog(user="System (AI)", action="evaluation", entity=f"Bidder {bidder_id}", details="Evaluation skipped: no criteria found for tender.", type="alert"))
        
        db.commit()
    except Exception as e:
        print(f"Background evaluation failed: {e}")
        if bidder:
            bidder.status = "error"
            db.commit()
    finally:
        db.close()

@app.post("/bidders/upload")
async def upload_bidder(
    background_tasks: BackgroundTasks,
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
    db.refresh(bidder)

    background_tasks.add_task(process_bidder_background, bidder_id, tender_id, saved_files)
    
    return bidder

@app.post("/bidders/{bidder_id}/re-evaluate")
async def re_evaluate_bidder(
    bidder_id: str,
    background_tasks: BackgroundTasks,
    engine: str = None,
    db: Session = Depends(get_db)
):
    bidder = db.query(models.Bidder).filter(models.Bidder.id == bidder_id).first()
    if not bidder:
        raise HTTPException(404, "Bidder not found")
    
    bidder.status = "parsing"
    db.commit()
    
    # Re-run background task with specific engine
    bidder_dir = os.path.join(UPLOAD_DIR, "bidders", bidder_id)
    saved_files = [os.path.join(bidder_dir, f) for f in bidder.documents]
    
    background_tasks.add_task(process_bidder_background, bidder_id, bidder.tender_id, saved_files, engine_override=engine)
    
    return {"message": f"Re-evaluation started using {engine or 'default settings'}"}

@app.delete("/tenders/{tender_id}")
async def delete_tender(tender_id: str, db: Session = Depends(get_db)):
    tender = db.query(models.Tender).filter(models.Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    
    # 1. Delete file from disk (Graceful)
    if tender.document_path and os.path.exists(tender.document_path):
        try:
            # On Windows, files might be locked. We try to delete but continue if it fails.
            os.remove(tender.document_path)
        except Exception as e:
            print(f"Non-fatal error: Could not remove tender file {tender.document_path}: {e}")

    # 2. Delete related criteria
    db.query(models.Criterion).filter(models.Criterion.tender_id == tender_id).delete()
    
    # 3. Delete related bidders (and their evaluations/folders)
    bidders = db.query(models.Bidder).filter(models.Bidder.tender_id == tender_id).all()
    for b in bidders:
        db.query(models.Evaluation).filter(models.Evaluation.bidder_id == b.id).delete()
        bidder_dir = os.path.join(UPLOAD_DIR, "bidders", b.id)
        if os.path.exists(bidder_dir):
            try:
                shutil.rmtree(bidder_dir, ignore_errors=True)
            except Exception as e:
                print(f"Non-fatal error: Could not remove bidder directory {bidder_dir}: {e}")
        db.delete(b)

    # 4. Delete the tender itself
    db.delete(tender)
    db.add(models.AuditLog(user="System", action="delete", entity=f"Tender {tender_id}", details=f"Tender and associated data deleted.", type="alert"))
    db.commit()
    return {"message": "Tender deleted successfully"}

@app.delete("/bidders/{bidder_id}")
async def delete_bidder(bidder_id: str, db: Session = Depends(get_db)):
    bidder = db.query(models.Bidder).filter(models.Bidder.id == bidder_id).first()
    if not bidder:
        raise HTTPException(status_code=404, detail="Bidder not found")
    
    # 1. Delete evaluations
    db.query(models.Evaluation).filter(models.Evaluation.bidder_id == bidder_id).delete()
    
    # 2. Delete files from disk (Graceful)
    bidder_dir = os.path.join(UPLOAD_DIR, "bidders", bidder_id)
    if os.path.exists(bidder_dir):
        try:
            shutil.rmtree(bidder_dir, ignore_errors=True)
        except Exception as e:
            print(f"Non-fatal error: Could not remove bidder directory {bidder_dir}: {e}")
    
    # 3. Delete bidder record
    db.delete(bidder)
    db.add(models.AuditLog(user="System", action="delete", entity=f"Bidder {bidder_id}", details=f"Bidder data deleted.", type="alert"))
    db.commit()
    return {"message": "Bidder deleted successfully"}

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
    db.add_all([c1, c2, c3, c4])
    db.commit()

    # --- L&T Construction: only turnover proven, others missing ---
    lt_evals = [
        {"criterion_id": "C1", "verdict": "eligible", "confidence": "high", "extracted_value": "₹14.2 Cr (Avg)", "reasoning": "Average turnover 2021-2023 extracted from Balance Sheet.", "source_page": 4, "source_document": "Balance_Sheet.pdf", "evidence_snippet": "Average turnover for 2021-2023: ₹14.2 Crores.", "action_required": "", "ai_engine": "gemini"},
        {"criterion_id": "C2", "verdict": "eligible", "confidence": "high", "extracted_value": "3 Projects", "reasoning": "Project completion certificates for 3 major works found.", "source_page": 8, "source_document": "Experience.pdf", "evidence_snippet": "Completed 3 projects worth > ₹5Cr each.", "action_required": "", "ai_engine": "gemini"},
        {"criterion_id": "C3", "verdict": "eligible", "confidence": "high", "extracted_value": "GSTIN 07AAAAA0000A1Z5", "reasoning": "Valid GST registration certificate found.", "source_page": 1, "source_document": "Compliance.pdf", "evidence_snippet": "GSTIN: 07AAAAA0000A1Z5.", "action_required": "", "ai_engine": "gemini"},
        {"criterion_id": "C4", "verdict": "eligible", "confidence": "high", "extracted_value": "ISO 9001:2015", "reasoning": "Valid ISO certificate found.", "source_page": 2, "source_document": "Compliance.pdf", "evidence_snippet": "ISO 9001:2015 Certificate #12345.", "action_required": "", "ai_engine": "ollama"},
    ]
    lt_eligible = sum(1 for e in lt_evals if e["verdict"] == "eligible")
    b1 = models.Bidder(
        id="B-LT", tender_id="CRPF-CONST-2024", name="L&T Construction", status="parsed",
        match_score=round((lt_eligible / 4) * 100, 1),
        is_disqualified=False,
        disqualification_reason=None,
        documents=["Balance_Sheet.pdf", "ISO_Cert.jpg"],
        checklist_status={"GST Registration": "missing", "ISO 9001:2015": "found", "Audited Balance Sheets (3 yrs)": "found", "PAN Card": "missing", "MSME Certificate": "missing"}
    )
    db.add(b1)
    db.commit()
    for e in lt_evals:
        db.add(models.Evaluation(bidder_id="B-LT", **e))

    # --- GMR Infrastructure: only turnover proven, others missing ---
    gmr_evals = [
        {"criterion_id": "C1", "verdict": "eligible",   "confidence": "medium", "extracted_value": "₹8.1 Cr", "reasoning": "Annual turnover found in GMR financial report.", "source_page": 2, "source_document": "GMR_Fin.pdf", "evidence_snippet": "Net revenue FY2023: ₹8.1 Crores.", "action_required": "", "ai_engine": "gemini"},
        {"criterion_id": "C2", "verdict": "eligible", "confidence": "high", "extracted_value": "3 Projects", "reasoning": "Experience documented in GMR corporate profile.", "source_page": 5, "source_document": "GMR_Profile.pdf", "evidence_snippet": "Major infrastructure works listed on page 5.", "action_required": "", "ai_engine": "gemini"},
        {"criterion_id": "C3", "verdict": "eligible", "confidence": "high", "extracted_value": "GSTIN 09BBBBB1111B2Z6", "reasoning": "GST certificate verified.", "source_page": 1, "source_document": "GMR_Compliance.pdf", "evidence_snippet": "GST registration confirmed.", "action_required": "", "ai_engine": "gemini"},
        {"criterion_id": "C4", "verdict": "ineligible", "confidence": "high",   "extracted_value": "Not found", "reasoning": "No ISO 9001:2015 certificate submitted.", "source_page": 0, "source_document": "GMR_Fin.pdf", "evidence_snippet": "No evidence found", "action_required": "Upload ISO 9001:2015 certificate.", "ai_engine": "gemini"},
    ]
    gmr_eligible = sum(1 for e in gmr_evals if e["verdict"] == "eligible")
    b2 = models.Bidder(
        id="B-GA", tender_id="CRPF-CONST-2024", name="GMR Infrastructure", status="parsed",
        match_score=round((gmr_eligible / 4) * 100, 1),
        is_disqualified=True,
        disqualification_reason="Failed mandatory criterion: ISO 9001 Certification",
        documents=["GMR_Fin.pdf"],
        checklist_status={"GST Registration": "missing", "ISO 9001:2015": "missing", "Audited Balance Sheets (3 yrs)": "found", "PAN Card": "missing", "MSME Certificate": "missing"}
    )
    db.add(b2)
    db.commit()
    for e in gmr_evals:
        db.add(models.Evaluation(bidder_id="B-GA", **e))

    db.add(models.AuditLog(user="System", action="seed", entity="Database", details="Database seeded with CRPF demo data. L&T: 100%, GMR: 75%.", type="action"))
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
