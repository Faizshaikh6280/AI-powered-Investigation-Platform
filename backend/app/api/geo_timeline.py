from fastapi import APIRouter
from app.core.db import db_client
from typing import List, Dict, Any
from datetime import datetime

router = APIRouter()

def iso_to_ms(iso_str: str) -> int:
    try:
        dt = datetime.fromisoformat(iso_str.replace('Z', '+00:00'))
        return int(dt.timestamp() * 1000)
    except:
        return 0

@router.get("/sync-data")
async def get_sync_data():
    events = await db_client.events_col.find({"timestamp": {"$ne": None}}).to_list(None)
    
    timeline_data = []
    waypoint_data = {}

    for ev in events:
        ts_str = ev.get("timestamp")
        if not ts_str:
            continue
            
        ts_ms = iso_to_ms(ts_str)
        if ts_ms == 0:
            continue
            
        # Add to timeline
        timeline_data.append({
            "id": str(ev["_id"]),
            "domain": ev.get("domain", "UNKNOWN"),
            "event_type": ev.get("event_type", ""),
            "timestamp": ts_str,
            "time_ms": ts_ms,
            "identity": ev.get("normalized_identity", {}),
            "financial": ev.get("financial", {}),
            "telemetry": ev.get("telemetry", {})
        })
        
        # Add to waypoints if geospatial
        cluster_id = ev.get("z_cluster_id")
        lat = ev.get("telemetry", {}).get("lat")
        lng = ev.get("telemetry", {}).get("lng")
        
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
        # Sort parallel lists
        sorted_pairs = sorted(zip(data["timestamps"], data["path"]))
        data["timestamps"] = [p[0] for p in sorted_pairs]
        data["path"] = [p[1] for p in sorted_pairs]
        formatted_waypoints.append(data)

    return {
        "timeline": timeline_data,
        "waypoints": formatted_waypoints
    }
