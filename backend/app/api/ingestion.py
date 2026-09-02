import os
import glob
import logging
import traceback
from fastapi import APIRouter
from app.services.ingestion_service import process_file
from app.core.database import get_db_context
from app.models.postgres_models import CaseModel
from app.processing.canonical_reader import canonical_reader

logger = logging.getLogger("investigation.api.ingestion")
router = APIRouter()

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "..", "data_files")

@router.post("/trigger_all")
async def ingest_all_files():
    """
    Ingests all sample evidence files through the new distributed pipeline.
    Maintains full backward compatibility with existing platform clients.
    """
    files_to_ingest = [
        "bank_statements.csv",
        "cdr_records.csv",
        "ipdr_sessions.csv",
        "social_media_logs.csv",
        "raw_entities_profiles.csv"
    ]

    # Resolve active or default case in PostgreSQL
    case_id = "CASE-DEFAULT-001"
    with get_db_context() as db:
        existing_case = db.query(CaseModel).order_by(CaseModel.created_at.desc()).first()
        if existing_case:
            case_id = existing_case.case_id
        else:
            case = CaseModel(
                case_id=case_id,
                case_reference="INV-2026-0142",
                title="Operation Shadow Syndicate",
                description="Cross-domain kidnapping & extortion investigation in Delhi NCR.",
                created_by="SYSTEM"
            )
            db.add(case)

    # Clear warehouse for a clean baseline run
    canonical_reader.clear_warehouse()

    results = []
    for filename in files_to_ingest:
        filepath = os.path.join(DATA_DIR, filename)
        if os.path.exists(filepath):
            try:
                # Automatic source detection classifies each file
                res = await process_file(
                    file_path=filepath,
                    domain=None,
                    case_id=case_id
                )
                results.append({
                    "status": "success",
                    "file": filename,
                    "detected_domain": res["detected_source"],
                    "confidence": res["confidence"],
                    "records_valid": res["valid_records"],
                    "quality_score": res["quality_score"]
                })
            except Exception as e:
                logger.error(f"[Ingestion] Failed to process {filename}: {e}\n{traceback.format_exc()}")
                results.append({"status": "error", "file": filename, "error": str(e)})

    return {"message": "Ingestion complete via new distributed pipeline", "results": results}

@router.get("/events")
async def get_events(limit: int = 200):
    """
    Retrieves canonical events from the MinIO Parquet warehouse.
    Replaces MongoDB find query with zero breaking API contract changes.
    """
    return canonical_reader.read_all_events(limit=limit)
