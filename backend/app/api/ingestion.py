from fastapi import APIRouter, BackgroundTasks
import os
import glob
from app.services.ingestion_service import process_file
from app.core.db import db_client

router = APIRouter()

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "..", "data_files")

@router.post("/trigger_all")
async def ingest_all_files():
    # Helper to map filename to domain
    domain_map = {
        "bank_statements.csv": "BANKING",
        "cdr_records.csv": "TELECOM",
        "ipdr_sessions.csv": "NETWORK",
        "social_media_logs.csv": "SOCIAL",
        "raw_entities_profiles.csv": "KYC"
    }
    
    # Clear old MongoDB data for fresh run
    await db_client.events_col.delete_many({})
    
    results = []
    for filename, domain in domain_map.items():
        filepath = os.path.join(DATA_DIR, filename)
        if os.path.exists(filepath):
            try:
                res = await process_file(filepath, domain)
                results.append({"status": "success", "file": filename, "domain": domain})
            except Exception as e:
                results.append({"status": "error", "file": filename, "error": str(e)})

    return {"message": "Ingestion complete", "results": results}

@router.get("/events")
async def get_events(limit: int = 200):
    events = await db_client.events_col.find({}).sort("timestamp", 1).limit(limit).to_list(None)
    for ev in events:
        ev["_id"] = str(ev["_id"])
    return events
