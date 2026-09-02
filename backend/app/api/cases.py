import os
import uuid
import tempfile
import datetime
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.postgres_models import CaseModel, EvidenceModel, QuarantineRecordModel, DataQualityReportModel
from app.services.ingestion_service import process_file
from app.core.storage import storage_service

router = APIRouter(prefix="/cases", tags=["Cases & Evidence Intake"])

class CaseCreateRequest(BaseModel):
    title: str
    description: Optional[str] = None  # Written case context / investigator notes
    case_reference: Optional[str] = None
    created_by: Optional[str] = "INVESTIGATOR_LEAD"

class CaseResponse(BaseModel):
    case_id: str
    case_reference: str
    title: str
    description: Optional[str]
    status: str
    created_at: str
    created_by: str

@router.post("", response_model=CaseResponse)
def create_case(payload: CaseCreateRequest, db: Session = Depends(get_db)):
    """Create a new formal investigation case with investigator context."""
    case_id = f"CASE-{uuid.uuid4().hex[:8].upper()}"
    case_ref = payload.case_reference or f"INV-{datetime.datetime.now().year}-{uuid.uuid4().hex[:4].upper()}"

    new_case = CaseModel(
        case_id=case_id,
        case_reference=case_ref,
        title=payload.title,
        description=payload.description,
        created_by=payload.created_by or "INVESTIGATOR_LEAD"
    )
    db.add(new_case)
    db.commit()
    db.refresh(new_case)

    return CaseResponse(
        case_id=new_case.case_id,
        case_reference=new_case.case_reference,
        title=new_case.title,
        description=new_case.description,
        status=new_case.status,
        created_at=new_case.created_at.isoformat(),
        created_by=new_case.created_by
    )

@router.get("", response_model=List[CaseResponse])
def list_cases(db: Session = Depends(get_db)):
    """List all registered investigation cases."""
    cases = db.query(CaseModel).order_by(CaseModel.created_at.desc()).all()
    return [
        CaseResponse(
            case_id=c.case_id,
            case_reference=c.case_reference,
            title=c.title,
            description=c.description,
            status=c.status,
            created_at=c.created_at.isoformat(),
            created_by=c.created_by
        ) for c in cases
    ]

@router.get("/{case_id}")
def get_case_details(case_id: str, db: Session = Depends(get_db)):
    """Retrieve case metadata, context notes, and attached evidence items."""
    case = db.query(CaseModel).filter_by(case_id=case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    evidence_items = db.query(EvidenceModel).filter_by(case_id=case_id).all()
    return {
        "case_id": case.case_id,
        "case_reference": case.case_reference,
        "title": case.title,
        "description": case.description,
        "status": case.status,
        "created_at": case.created_at.isoformat(),
        "created_by": case.created_by,
        "evidence_count": len(evidence_items),
        "evidence": [{
            "evidence_id": e.evidence_id,
            "filename": e.original_filename,
            "source_type": e.detected_source_type,
            "confidence": e.detected_source_confidence,
            "status": e.processing_status,
            "records": e.record_count,
            "quality_score": e.quality_score,
            "sha256": e.sha256
        } for e in evidence_items]
    }

@router.post("/{case_id}/evidence")
async def upload_evidence(
    case_id: str,
    file: UploadFile = File(...),
    notes: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Upload unlabelled evidence file to a case.
    The investigator does NOT need to specify source domain.
    The platform calculates SHA-256, encrypts via AES-256-GCM, stores to MinIO,
    detects source domain, normalizes, deduplicates, and produces data quality metrics.
    """
    case = db.query(CaseModel).filter_by(case_id=case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Read uploaded bytes into a temporary file
    temp_dir = tempfile.mkdtemp()
    temp_path = os.path.join(temp_dir, file.filename)
    try:
        content = await file.read()
        with open(temp_path, "wb") as f:
            f.write(content)

        # Process file through pipeline
        evidence_id = f"EV-{uuid.uuid4().hex[:8].upper()}"
        result = await process_file(
            file_path=temp_path,
            domain=None,  # Automatic source detection
            case_id=case_id,
            evidence_id=evidence_id
        )
        return result
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        if os.path.exists(temp_dir):
            os.rmdir(temp_dir)

@router.get("/evidence/{evidence_id}/status")
def get_evidence_status(evidence_id: str, db: Session = Depends(get_db)):
    """Check granular processing status, source detection confidence, and quality metrics."""
    ev = db.query(EvidenceModel).filter_by(evidence_id=evidence_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Evidence not found")

    quarantine_count = db.query(QuarantineRecordModel).filter_by(evidence_id=evidence_id).count()
    quality = db.query(DataQualityReportModel).filter_by(evidence_id=evidence_id).first()

    return {
        "evidence_id": ev.evidence_id,
        "case_id": ev.case_id,
        "filename": ev.original_filename,
        "status": ev.processing_status,
        "detected_source": ev.detected_source_type,
        "confidence": ev.detected_source_confidence,
        "sha256": ev.sha256,
        "storage_path": ev.storage_path,
        "records": {
            "total": ev.record_count,
            "valid": ev.valid_record_count,
            "duplicates": ev.duplicate_record_count,
            "invalid_quarantined": quarantine_count
        },
        "quality_score": ev.quality_score,
        "missing_field_ratios": quality.missing_field_ratios if quality else {}
    }

@router.post("/evidence/{evidence_id}/verify-integrity")
def verify_evidence_integrity(evidence_id: str, db: Session = Depends(get_db)):
    """Tamper-evident verification: recalculates SHA-256 hash against stored encrypted object."""
    ev = db.query(EvidenceModel).filter_by(evidence_id=evidence_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Evidence not found")

    is_valid = storage_service.verify_integrity(ev.storage_path, ev.sha256)
    return {
        "evidence_id": evidence_id,
        "filename": ev.original_filename,
        "expected_sha256": ev.sha256,
        "verified": is_valid,
        "integrity_status": "VERIFIED_AUTHENTIC" if is_valid else "TAMPERED_OR_CORRUPT"
    }
