import os
import uuid
import tempfile
import datetime
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

import logging

from app.core.database import get_db
from app.models.postgres_models import (
    CaseModel, EvidenceModel, QuarantineRecordModel, DataQualityReportModel,
    GoldenProfileModel, DetectionSignalModel, AnomalyFindingModel, AnomalyRunModel, AuditLogModel
)
from app.services.ingestion_service import process_file
from app.core.storage import storage_service

logger = logging.getLogger("investigation.api.cases")
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

    if payload.case_reference and payload.case_reference.strip():
        req_ref = payload.case_reference.strip()
        existing = db.query(CaseModel).filter_by(case_reference=req_ref).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Case reference '{req_ref}' already exists. Please choose a unique case reference."
            )
        case_ref = req_ref
    else:
        for _ in range(5):
            candidate_ref = f"INV-{datetime.datetime.now().year}-{uuid.uuid4().hex[:6].upper()}"
            if not db.query(CaseModel).filter_by(case_reference=candidate_ref).first():
                case_ref = candidate_ref
                break
        else:
            case_ref = f"INV-{uuid.uuid4().hex[:10].upper()}"

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

STANDARD_BENCHMARK_CASES = [
    {
        "case_id": "INV-2026-BLACK-CIRCUIT",
        "case_reference": "INV-2026-BLACK-CIRCUIT",
        "title": "Operation Black Circuit",
        "description": "High-velocity cybercrime syndicate operating across Chandigarh, Mohali, and Zirakpur.",
        "status": "ACTIVE",
        "created_by": "SYSTEM"
    },
    {
        "case_id": "INV-2026-IRON-LOTUS",
        "case_reference": "INV-2026-IRON-LOTUS",
        "title": "Operation Iron Lotus",
        "description": "Cross-jurisdictional syndicate tracking across Chandigarh, Mohali, and Panchkula.",
        "status": "ACTIVE",
        "created_by": "SYSTEM"
    },
    {
        "case_id": "INV-2026-NIGHT-LEDGER",
        "case_reference": "INV-2026-NIGHT-LEDGER",
        "title": "Operation Night Ledger",
        "description": "Financial layering, hawala networks, and ATM cash extractions in Delhi NCR.",
        "status": "ACTIVE",
        "created_by": "SYSTEM"
    },
    {
        "case_id": "INV-2026-RED-HAVEN",
        "case_reference": "INV-2026-RED-HAVEN",
        "title": "Operation Red Haven",
        "description": "Physical convergence and incident scene tracking in South Delhi.",
        "status": "ACTIVE",
        "created_by": "SYSTEM"
    }
]

def _ensure_benchmark_cases(db: Session):
    for b in STANDARD_BENCHMARK_CASES:
        existing = db.query(CaseModel).filter(
            (CaseModel.case_id == b["case_id"]) | (CaseModel.case_reference == b["case_reference"])
        ).first()
        if not existing:
            new_c = CaseModel(
                case_id=b["case_id"],
                case_reference=b["case_reference"],
                title=b["title"],
                description=b["description"],
                status=b["status"],
                created_by=b["created_by"]
            )
            db.add(new_c)
            try:
                db.commit()
            except Exception:
                db.rollback()

@router.post("/seed_benchmarks")
def seed_benchmark_cases(db: Session = Depends(get_db)):
    """Explicitly seeds the 4 standard benchmark cases."""
    _ensure_benchmark_cases(db)
    return {"status": "success", "message": "Benchmark cases registered successfully"}

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
            created_at=c.created_at.isoformat() if c.created_at else datetime.datetime.now(datetime.timezone.utc).isoformat(),
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
        "created_at": case.created_at.isoformat() if case.created_at else datetime.datetime.now(datetime.timezone.utc).isoformat(),
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
    source_type: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Upload evidence file to a case.
    Accepts optional source_type or auto-detects if omitted.
    The platform calculates SHA-256, encrypts via AES-256-GCM, stores to MinIO,
    detects source domain, normalizes, deduplicates, and produces data quality metrics.
    Automatically triggers Entity Resolution, Graph Synchronization, and Anomaly Detection.
    """
    case = db.query(CaseModel).filter_by(case_id=case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Read uploaded bytes into a temporary file
    temp_dir = tempfile.mkdtemp()
    temp_path = os.path.join(temp_dir, file.filename)
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")
        with open(temp_path, "wb") as f:
            f.write(content)

        # Process file through pipeline
        evidence_id = f"EV-{uuid.uuid4().hex[:8].upper()}"
        try:
            result = await process_file(
                file_path=temp_path,
                domain=source_type,  # Use investigator source_type hint if provided
                case_id=case_id,
                evidence_id=evidence_id
            )

            # Automatically trigger Entity Resolution, Graph Sync, and Anomaly Detection in background
            try:
                from app.services.pipeline_orchestrator import run_case_pipeline_async
                run_case_pipeline_async(case_id=case_id)
            except Exception as pe:
                logger.warning(f"Background pipeline auto-trigger failed for case {case_id}: {pe}")

            return result
        except ValueError as ve:
            logger.error(f"Evidence processing validation error for {file.filename}: {ve}")
            raise HTTPException(status_code=400, detail=str(ve))
        except Exception as e:
            logger.exception(f"Unhandled error processing evidence {file.filename}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to process evidence file: {str(e)}")
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

@router.delete("/{case_id}")
def delete_case(case_id: str, db: Session = Depends(get_db)):
    """Permanently deletes a case and all associated data across Postgres, Neo4j, MinIO, and Redis."""
    case = db.query(CaseModel).filter_by(case_id=case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Delete PostgreSQL records
    db.query(AnomalyFindingModel).filter(AnomalyFindingModel.case_id == case_id).delete()
    db.query(AnomalyRunModel).filter(AnomalyRunModel.case_id == case_id).delete()
    db.query(DetectionSignalModel).filter(DetectionSignalModel.case_id == case_id).delete()
    db.query(GoldenProfileModel).filter(GoldenProfileModel.case_id == case_id).delete()
    db.query(AuditLogModel).filter(AuditLogModel.case_id == case_id).delete()

    ev_list = db.query(EvidenceModel).filter_by(case_id=case_id).all()
    for ev in ev_list:
        db.query(QuarantineRecordModel).filter_by(evidence_id=ev.evidence_id).delete()
        db.query(DataQualityReportModel).filter_by(evidence_id=ev.evidence_id).delete()
        db.delete(ev)

    db.delete(case)
    db.commit()

    # Neo4j cleanup
    try:
        from app.core.neo4j_client import neo4j_client
        if neo4j_client.ensure_connected():
            with neo4j_client.driver.session() as session:
                session.run("MATCH (n {case_id: $case_id}) DETACH DELETE n", case_id=case_id)
                if db.query(CaseModel).count() == 0:
                    session.run("MATCH (n) DETACH DELETE n")
    except Exception as e:
        logger.warning(f"Neo4j cleanup for {case_id} failed: {e}")

    # MinIO cleanup
    try:
        from app.core.storage import storage_service
        s3 = storage_service.s3_client
        for b in ["raw-evidence", "iceberg-warehouse"]:
            res = s3.list_objects_v2(Bucket=b, Prefix=f"{case_id}/")
            for obj in res.get("Contents", []):
                s3.delete_object(Bucket=b, Key=obj["Key"])
            wh_res = s3.list_objects_v2(Bucket=b, Prefix=f"events/case_id={case_id}/")
            for obj in wh_res.get("Contents", []):
                s3.delete_object(Bucket=b, Key=obj["Key"])
    except Exception as e:
        logger.warning(f"MinIO cleanup for {case_id} failed: {e}")

    # Redis cache flush
    try:
        import redis
        from app.core.config import settings
        r = redis.from_url(settings.REDIS_URL)
        r.flushall()
    except Exception as e:
        logger.warning(f"Redis cleanup failed: {e}")

    return {"status": "success", "message": f"Case {case_id} deleted successfully"}

@router.delete("")
def delete_all_cases(db: Session = Depends(get_db)):
    """Wipes all cases and associated data across all databases for a clean slate."""
    db.query(AnomalyFindingModel).delete()
    db.query(AnomalyRunModel).delete()
    db.query(DetectionSignalModel).delete()
    db.query(GoldenProfileModel).delete()
    db.query(QuarantineRecordModel).delete()
    db.query(DataQualityReportModel).delete()
    db.query(EvidenceModel).delete()
    db.query(AuditLogModel).delete()
    db.query(CaseModel).delete()
    db.commit()

    try:
        from app.core.neo4j_client import neo4j_client
        if neo4j_client.ensure_connected():
            with neo4j_client.driver.session() as session:
                session.run("MATCH (n) DETACH DELETE n")
    except Exception as e:
        logger.warning(f"Neo4j cleanup failed: {e}")

    try:
        from app.core.storage import storage_service
        s3 = storage_service.s3_client
        for b in ["raw-evidence", "iceberg-warehouse"]:
            res = s3.list_objects_v2(Bucket=b)
            for obj in res.get("Contents", []):
                s3.delete_object(Bucket=b, Key=obj["Key"])
    except Exception as e:
        logger.warning(f"MinIO cleanup failed: {e}")

    try:
        import redis
        from app.core.config import settings
        r = redis.from_url(settings.REDIS_URL)
        r.flushall()
    except Exception as e:
        logger.warning(f"Redis cleanup failed: {e}")

    return {"status": "success", "message": "All cases and data purged successfully"}

