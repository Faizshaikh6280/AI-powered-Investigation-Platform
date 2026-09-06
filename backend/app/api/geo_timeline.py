from fastapi import APIRouter, Query, HTTPException, Body
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from app.geo.service import geo_service
from app.geo.schemas import (
    GeoInvestigationResponse, AreaInvestigationResult, MovementSegment,
    CoLocationFinding, CommonPlace
)

router = APIRouter()

class AreaQueryRequest(BaseModel):
    case_id: str
    center_lat: float
    center_lng: float
    radius_meters: float = 500.0
    start_time: Optional[str] = None
    end_time: Optional[str] = None

@router.get("/sync-data")
def get_sync_data(case_id: Optional[str] = None):
    """
    Retrieves chronological timeline events and Deck.gl TripsLayer geospatial waypoints.
    Preserves 100% backward compatibility with existing TripsLayer callers.
    """
    try:
        return geo_service.get_trips_sync_data(case_id=case_id)
    except Exception as e:
        return {"timeline": [], "waypoints": [], "error": str(e)}

@router.get("/investigation", response_model=GeoInvestigationResponse)
def get_geo_investigation(
    case_id: str = Query(..., description="Target investigation case ID"),
    entity_ids: Optional[str] = Query(None, description="Comma-separated entity IDs or names"),
    domains: Optional[str] = Query(None, description="Comma-separated domains (TELECOM, FINANCIAL, LOCATION, SOCIAL, NETWORK)"),
    start_time: Optional[str] = Query(None, description="ISO-8601 UTC start time"),
    end_time: Optional[str] = Query(None, description="ISO-8601 UTC end time"),
    min_confidence: Optional[float] = Query(None, description="Minimum location confidence (0.0 to 1.0)"),
    min_lng: Optional[float] = Query(None),
    min_lat: Optional[float] = Query(None),
    max_lng: Optional[float] = Query(None),
    max_lat: Optional[float] = Query(None)
):
    """
    Complete Geospatial Investigation endpoint.
    Returns normalized geo events, movement trajectories, co-location findings,
    common places, activity density cells, narrative story cards, and summary stats.
    """
    ent_list = [e.strip() for e in entity_ids.split(",")] if entity_ids else None
    dom_list = [d.strip() for d in domains.split(",")] if domains else None
    
    bbox = None
    if all(x is not None for x in [min_lng, min_lat, max_lng, max_lat]):
        bbox = [min_lng, min_lat, max_lng, max_lat]

    try:
        return geo_service.get_geo_investigation(
            case_id=case_id,
            entity_ids=ent_list,
            domains=dom_list,
            start_time=start_time,
            end_time=end_time,
            min_confidence=min_confidence,
            bbox=bbox
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Geo investigation query failed: {str(e)}")

@router.get("/movements", response_model=List[MovementSegment])
def get_movements(
    case_id: str = Query(...),
    entity_ids: Optional[str] = Query(None)
):
    """
    Reconstructs chronological movement segments and gaps for entities.
    """
    ent_list = [e.strip() for e in entity_ids.split(",")] if entity_ids else None
    investigation = geo_service.get_geo_investigation(case_id=case_id, entity_ids=ent_list)
    return investigation.movements

@router.get("/co-locations", response_model=List[CoLocationFinding])
def get_co_locations(
    case_id: str = Query(...)
):
    """
    Retrieves detected multi-entity cell sector and proximity co-location findings.
    """
    investigation = geo_service.get_geo_investigation(case_id=case_id)
    return investigation.co_locations

@router.get("/common-places", response_model=List[CommonPlace])
def get_common_places(
    case_id: str = Query(...)
):
    """
    Retrieves high-frequency spatial hubs and common places with entity overlap.
    """
    investigation = geo_service.get_geo_investigation(case_id=case_id)
    return investigation.common_places

@router.post("/area-query", response_model=AreaInvestigationResult)
def area_query(payload: AreaQueryRequest):
    """
    Area Investigation query: 'Who Was Here?' and 'What Happened Here?'.
    Searches within a geodesic circle radius and returns all entities and events inside.
    """
    try:
        return geo_service.run_area_query(
            case_id=payload.case_id,
            center_lat=payload.center_lat,
            center_lng=payload.center_lng,
            radius_meters=payload.radius_meters,
            start_time=payload.start_time,
            end_time=payload.end_time
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Area query failed: {str(e)}")

@router.get("/segment-context")
def get_segment_context(
    case_id: str = Query(...),
    event_id: str = Query(...),
    window_seconds: float = Query(1800.0, description="Temporal window around event in seconds")
):
    """
    Before and After Movement Context.
    Retrieves events directly prior to departure and upon arrival around a waypoint or movement segment.
    """
    try:
        return geo_service.get_movement_context(
            case_id=case_id,
            event_id=event_id,
            window_seconds=window_seconds
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Movement context query failed: {str(e)}")

@router.get("/export")
def export_geo_dossier(
    case_id: str = Query(...),
    format: str = Query("geojson", pattern="^(geojson|json)$")
):
    """
    Exports geospatial intelligence findings as standard GeoJSON FeatureCollection or JSON dossier.
    """
    try:
        return geo_service.export_geo_dossier(case_id=case_id, export_format=format)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")
