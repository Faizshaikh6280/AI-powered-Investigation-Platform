from fastapi import APIRouter
from typing import List, Dict, Any
from datetime import datetime
from app.processing.canonical_reader import canonical_reader

router = APIRouter()

def iso_to_ms(iso_str: str) -> int:
    try:
        dt = datetime.fromisoformat(iso_str.replace('Z', '+00:00'))
        return int(dt.timestamp() * 1000)
    except Exception:
        return 0

@router.get("/sync-data")
async def get_sync_data(case_id: str = None):
    """
    Retrieves chronological timeline events and Deck.gl TripsLayer geospatial waypoints.
    Reads from the MinIO Parquet canonical warehouse.
    Zero MongoDB dependency.
    """
    target_case_id = case_id
    if not target_case_id:
        from app.core.database import get_db_context
        from app.models.postgres_models import CaseModel
        with get_db_context() as db:
            c = db.query(CaseModel).order_by(CaseModel.created_at.desc()).first()
            if not c:
                return {"timeline": [], "waypoints": []}
            target_case_id = c.case_id

    events = canonical_reader.read_all_events(case_id=target_case_id)

    timeline_data = []
    waypoint_data = {}

    for ev in events:
        ts_str = ev.get("timestamp")
        if not ts_str:
            continue

        ts_ms = iso_to_ms(ts_str)
        if ts_ms == 0:
            continue

        # Add to chronological timeline
        timeline_data.append({
            "id": str(ev.get("event_id")),
            "domain": ev.get("domain") or ev.get("source_type", "UNKNOWN"),
            "event_type": ev.get("event_type", ""),
            "timestamp": ts_str,
            "time_ms": ts_ms,
            "identity": ev.get("normalized_identity", {}),
            "financial": ev.get("financial", {}),
            "telemetry": ev.get("telemetry", {})
        })

        # Group into waypoints if geospatial coordinates exist
        cluster_id = ev.get("z_cluster_id")
        telemetry = ev.get("telemetry", {})
        lat = telemetry.get("lat")
        lng = telemetry.get("lng")

        if cluster_id and lat is not None and lng is not None:
            if cluster_id not in waypoint_data:
                waypoint_data[cluster_id] = {
                    "cluster_id": cluster_id,
                    "path": [],
                    "timestamps": []
                }
            waypoint_data[cluster_id]["path"].append([float(lng), float(lat)])
            waypoint_data[cluster_id]["timestamps"].append(ts_ms)

    # Sort timeline by time
    timeline_data.sort(key=lambda x: x["time_ms"])

    # Sort waypoints by time internally
    formatted_waypoints = []
    for cid, data in waypoint_data.items():
        sorted_pairs = sorted(zip(data["timestamps"], data["path"]))
        data["timestamps"] = [p[0] for p in sorted_pairs]
        data["path"] = [p[1] for p in sorted_pairs]
        formatted_waypoints.append(data)

    return {
        "timeline": timeline_data,
        "waypoints": formatted_waypoints
    }
