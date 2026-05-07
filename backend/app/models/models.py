from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from ..database import Base

class Tender(Base):
    __tablename__ = "tenders"

    id = Column(String, primary_key=True, index=True)
    title = Column(String)
    department = Column(String)
    upload_date = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="pending")
    value = Column(String)
    document_path = Column(String)
    file_hash = Column(String)
    required_docs = Column(JSON) # List of documents like ["GST", "ISO", "MSME"]
    is_signed = Column(Boolean, default=False)
    signed_by = Column(String, nullable=True)
    signed_at = Column(DateTime, nullable=True)

    criteria = relationship("Criterion", back_populates="tender")
    bidders = relationship("Bidder", back_populates="tender")

class Criterion(Base):
    __tablename__ = "criteria"

    id = Column(String, primary_key=True, index=True)
    tender_id = Column(String, ForeignKey("tenders.id"))
    category = Column(String)
    name = Column(String)
    threshold = Column(String)
    mandatory = Column(Boolean, default=True)
    source_page = Column(Integer)
    source_text = Column(Text)

    tender = relationship("Tender", back_populates="criteria")

class Bidder(Base):
    __tablename__ = "bidders"

    id = Column(String, primary_key=True, index=True)
    tender_id = Column(String, ForeignKey("tenders.id"))
    name = Column(String)
    status = Column(String, default="parsing")
    match_score = Column(Float, nullable=True)
    is_disqualified = Column(Boolean, default=False)
    disqualification_reason = Column(String, nullable=True)
    documents = Column(JSON) # List of document names
    file_hashes = Column(JSON) # Map of filename to SHA-256
    checklist_status = Column(JSON) # Map of doc_name -> "found" / "missing"

    tender = relationship("Tender", back_populates="bidders")
    evaluations = relationship("Evaluation", back_populates="bidder")

class Evaluation(Base):
    __tablename__ = "evaluations"

    id = Column(Integer, primary_key=True, index=True)
    bidder_id = Column(String, ForeignKey("bidders.id"))
    criterion_id = Column(String, ForeignKey("criteria.id"))
    verdict = Column(String) # pass, fail, review
    confidence = Column(String) # high, medium, low
    match_type = Column(String) # direct, semantic
    extracted_value = Column(String)
    reasoning = Column(Text)
    source_page = Column(Integer)
    source_document = Column(String, nullable=True)
    evidence_snippet = Column(Text, nullable=True)
    action_required = Column(Text, nullable=True)

    bidder = relationship("Bidder", back_populates="evaluations")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    user = Column(String)
    action = Column(String)
    entity = Column(String)
    details = Column(Text)
    type = Column(String) # upload, action, approval, alert
