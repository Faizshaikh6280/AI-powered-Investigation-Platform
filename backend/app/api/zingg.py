from fastapi import APIRouter
from app.services.zingg_er import run_entity_resolution

router = APIRouter()

@router.post("/execute")
async def execute_entity_resolution():
    """
    Run full Entity Resolution pipeline on data files:
    1. Reads raw_entities_profiles.csv
    2. Normalizes phone numbers to E.164
    3. Clusters by national_id + phone (Zingg Docker if available, else deterministic union-find)
    4. Writes GoldenProfiles to MongoDB
    5. Backfills z_cluster_id on all normalized_events
    """
    result = await run_entity_resolution()
    return result
