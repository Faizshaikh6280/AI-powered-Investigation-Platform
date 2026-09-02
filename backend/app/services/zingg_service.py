import os
import csv
import logging
from datetime import datetime
from app.core.config import settings
from app.core.database import get_db_context
from app.models.postgres_models import GoldenProfileModel
from app.processing.canonical_reader import canonical_reader

logger = logging.getLogger("investigation.zingg")

PIPELINE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "zingg_pipeline")
EXPORT_PATH = os.path.join(PIPELINE_DIR, "normalized_evidence_export.csv")

async def export_for_zingg():
    """Exports canonical events to CSV format suitable for Zingg training."""
    events = canonical_reader.read_all_events()
    os.makedirs(PIPELINE_DIR, exist_ok=True)
    
    with open(EXPORT_PATH, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(["record_id", "full_name", "phone", "national_id", "email", "address"])
        for idx, ev in enumerate(events, start=1):
            identity = ev.get("normalized_identity", {})
            writer.writerow([
                ev.get("event_id", f"REC-{idx}"),
                identity.get("name", ""),
                identity.get("phone", ""),
                identity.get("national_id", ""),
                identity.get("email", ""),
                ev.get("telemetry", {}).get("address", "")
            ])
            
    return len(events)

async def run_zingg_pipeline():
    """Triggers Zingg model execution or deterministic fallback."""
    from app.services.zingg_er import run_entity_resolution
    return await run_entity_resolution()
