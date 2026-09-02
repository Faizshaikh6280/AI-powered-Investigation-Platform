from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from app.api.ingestion import router as ingestion_router
from app.api.graph import router as graph_router
from app.api.zingg import router as zingg_router
from app.api.geo_timeline import router as geo_timeline_router
from app.core.db import init_mongo

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
    await init_mongo()

app.include_router(ingestion_router, prefix="/api/ingest", tags=["Ingestion"])
app.include_router(zingg_router, prefix="/api/zingg", tags=["Zingg ML"])
app.include_router(graph_router, prefix="/api/graph", tags=["Graph Sync"])
app.include_router(geo_timeline_router, prefix="/api/geo", tags=["Geo Timeline"])
from app.api.anomaly import router as anomaly_router
app.include_router(anomaly_router, prefix="/api/anomalies", tags=["Anomalies"])

@app.post("/api/system/reset")
async def reset_all():
    from app.services.reset import clear_and_reset
    return await clear_and_reset()

@app.get("/api/system/golden_profiles")
async def get_golden_profiles():
    from app.core.db import db_client
    profiles = await db_client.golden_col.find({}, {"_id": 0}).to_list(None)
    return profiles

@app.get("/")
def read_root():
    return {"status": "Investigative Core Online"}
