from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from app.api.ingestion import router as ingestion_router
from app.api.graph import router as graph_router
from app.api.zingg import router as zingg_router
from app.api.geo_timeline import router as geo_timeline_router
from app.api.anomaly import router as anomaly_router
from app.api.cases import router as cases_router
from app.core.database import init_postgres, get_db_context
from app.core.storage import storage_service
from app.models.postgres_models import GoldenProfileModel

app = FastAPI(title="Unified Investigative Analytics Platform", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    # Initialize PostgreSQL tables and MinIO buckets
    init_postgres()
    try:
        storage_service.ensure_buckets()
    except Exception as e:
        print(f"[MinIO] Storage init warning: {e}")

# Register API Routers
app.include_router(cases_router, prefix="/api", tags=["Cases & Evidence"])
app.include_router(ingestion_router, prefix="/api/ingest", tags=["Ingestion"])
app.include_router(zingg_router, prefix="/api/zingg", tags=["Zingg ML"])
app.include_router(graph_router, prefix="/api/graph", tags=["Graph Sync"])
app.include_router(geo_timeline_router, prefix="/api/geo", tags=["Geo Timeline"])
app.include_router(anomaly_router, prefix="/api/anomalies", tags=["Anomalies"])

@app.post("/api/system/reset")
async def reset_all():
    from app.services.reset import clear_and_reset
    return await clear_and_reset()

@app.get("/api/system/golden_profiles")
async def get_golden_profiles():
    """
    Retrieves resolved golden entity profiles from PostgreSQL.
    Replaces MongoDB collection with identical JSON response structure.
    """
    with get_db_context() as db:
        profiles = db.query(GoldenProfileModel).all()
        return [{
            "z_cluster_id": p.z_cluster_id,
            "primary_name": p.primary_name,
            "known_aliases": p.known_aliases or [],
            "known_phones": p.known_phones or [],
            "known_accounts": p.known_accounts or [],
            "associated_emails": p.associated_emails or [],
            "known_addresses": p.known_addresses or [],
            "national_ids": p.national_ids or [],
            "social_handles": p.social_handles or [],
            "risk_score": p.risk_score,
            "method": p.method,
            "last_updated": p.last_updated.isoformat() if p.last_updated else ""
        } for p in profiles]

@app.get("/")
def read_root():
    return {"status": "Investigative Core Online"}
