import io
import csv
import json
import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query, Response
from app.timeline.service import timeline_service
from app.timeline.schemas import TimelineQueryResponse, TimelineCanonicalEvent, StorylineSequence

logger = logging.getLogger("investigation.api.timeline")
router = APIRouter()

@router.get("/events", response_model=TimelineQueryResponse)
def get_timeline_events(
    case_id: Optional[str] = None,
    entities: Optional[str] = Query(None, description="Comma-separated entity names or cluster IDs"),
    domains: Optional[str] = Query(None, description="Comma-separated domains (e.g. TELECOM,FINANCIAL,SOCIAL,LOCATION)"),
    event_types: Optional[str] = Query(None, description="Comma-separated event types"),
    start_time: Optional[str] = Query(None, description="Start timestamp filter (ISO-8601)"),
    end_time: Optional[str] = Query(None, description="End timestamp filter (ISO-8601)"),
    risk: Optional[str] = Query(None, description="Comma-separated risk levels (CRITICAL,HIGH,MEDIUM,LOW)"),
    only_anomalies: bool = Query(False, description="Filter for anomalous events only"),
    min_confidence: Optional[float] = Query(None, description="Minimum confidence score 0.0 - 1.0"),
    search: Optional[str] = Query(None, description="Free-text search query across actors, narration, location"),
    zoom: str = Query("minute", description="Zoom level: month, day, hour, minute"),
    limit: int = Query(300, ge=1, le=5000),
    offset: int = Query(0, ge=0)
):
    """
    Primary timeline query endpoint. Retrieves canonical temporal events, time-density histograms,
    active correlations, bursts, and inconsistency alerts.
    """
    entity_list = [e.strip() for e in entities.split(",") if e.strip()] if entities else None
    domain_list = [d.strip() for d in domains.split(",") if d.strip()] if domains else None
    type_list = [t.strip() for t in event_types.split(",") if t.strip()] if event_types else None
    risk_list = [r.strip() for r in risk.split(",") if r.strip()] if risk else None

    return timeline_service.query_timeline(
        case_id=case_id,
        entity_ids=entity_list,
        domains=domain_list,
        event_types=type_list,
        start_time=start_time,
        end_time=end_time,
        risk_levels=risk_list,
        only_anomalies=only_anomalies,
        min_confidence=min_confidence,
        search=search,
        zoom_level=zoom,
        limit=limit,
        offset=offset
    )

@router.get("/events/{event_id}")
def get_event_detail(event_id: str, case_id: Optional[str] = None):
    """Retrieves full granular details, telemetry, and evidence provenance for an individual event."""
    target_case_id = timeline_service._resolve_case_id(case_id)
    if not target_case_id:
        raise HTTPException(status_code=404, detail="No active case found.")

    artifacts = timeline_service.get_or_build_timeline_artifacts(target_case_id)
    ev = next((e for e in artifacts["events"] if e.event_id == event_id), None)
    if not ev:
        raise HTTPException(status_code=404, detail=f"Timeline event '{event_id}' not found.")
    return ev

@router.get("/events/{event_id}/context")
def get_event_context(
    event_id: str,
    case_id: Optional[str] = None,
    window_minutes: int = Query(15, ge=1, le=1440, description="Temporal window size in minutes (±)")
):
    """
    Returns immediate temporal neighborhood events around a selected event (±5m, ±15m, ±30m, ±1h).
    """
    res = timeline_service.get_event_context(
        event_id=event_id,
        case_id=case_id,
        window_minutes=window_minutes
    )
    if not res.get("target_event"):
        raise HTTPException(status_code=404, detail=f"Target event '{event_id}' not found.")
    return res

@router.get("/correlations")
def get_correlations(case_id: Optional[str] = None):
    """Retrieves discovered cross-domain temporal correlations for the case."""
    target_case_id = timeline_service._resolve_case_id(case_id)
    if not target_case_id:
        return []
    artifacts = timeline_service.get_or_build_timeline_artifacts(target_case_id)
    return artifacts.get("correlations", [])

@router.get("/bursts")
def get_activity_bursts(case_id: Optional[str] = None):
    """Retrieves detected activity bursts (high-density temporal episodes)."""
    target_case_id = timeline_service._resolve_case_id(case_id)
    if not target_case_id:
        return []
    artifacts = timeline_service.get_or_build_timeline_artifacts(target_case_id)
    return artifacts.get("bursts", [])

@router.get("/inconsistencies")
def get_inconsistencies(case_id: Optional[str] = None):
    """Retrieves detected temporal/geospatial velocity inconsistencies."""
    target_case_id = timeline_service._resolve_case_id(case_id)
    if not target_case_id:
        return []
    artifacts = timeline_service.get_or_build_timeline_artifacts(target_case_id)
    return artifacts.get("inconsistencies", [])

@router.get("/storylines", response_model=List[StorylineSequence])
@router.get("/storyline", response_model=List[StorylineSequence])
def get_storylines(case_id: Optional[str] = None):
    """Retrieves reconstructed storyline sequences with grounded intelligence assessments."""
    return timeline_service.get_storylines(case_id=case_id)

@router.get("/compare")
def get_compare_streams(
    entities: str = Query(..., description="Comma-separated list of entity names or cluster IDs to compare"),
    case_id: Optional[str] = None
):
    """
    Returns aligned parallel temporal streams for side-by-side entity comparison.
    """
    entity_keys = [e.strip() for e in entities.split(",") if e.strip()]
    if not entity_keys:
        raise HTTPException(status_code=400, detail="At least one entity must be specified for comparison.")
    return timeline_service.get_compare_streams(entity_keys=entity_keys, case_id=case_id)

@router.get("/export")
def export_timeline_dossier(
    case_id: Optional[str] = None,
    format: str = Query("json", description="Export format: json or csv"),
    entities: Optional[str] = None,
    domains: Optional[str] = None
):
    """
    Court-ready forensic timeline export with cryptographic evidence references.
    """
    query_res = get_timeline_events(
        case_id=case_id,
        entities=entities,
        domains=domains,
        limit=5000,
        offset=0
    )

    if format.lower() == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Event ID", "Timestamp (UTC)", "Raw Timestamp", "Timezone", "Domain",
            "Event Type", "Actor(s)", "Target(s)", "Amount (INR)", "Location",
            "Evidence ID", "Evidence File", "Evidence SHA256", "Anomaly Score", "Risk Level"
        ])
        for ev in query_res.events:
            writer.writerow([
                ev.event_id,
                ev.normalized_timestamp,
                ev.raw_timestamp,
                ev.timezone_offset or "UNKNOWN",
                ev.domain,
                ev.event_type,
                "; ".join(ev.actor_entities),
                "; ".join(ev.target_entities),
                ev.amount_inr or 0.0,
                ev.location_name or "",
                ev.evidence_id,
                ev.evidence_filename or "",
                ev.evidence_sha256 or "",
                ev.anomaly_score,
                ev.risk_level
            ])
        csv_content = output.getvalue()
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=timeline_dossier_{case_id or 'active'}.csv"}
        )

    # Return full JSON export
    return {
        "export_metadata": {
            "case_id": query_res.case_id,
            "total_records": query_res.summary.total_events,
            "exported_at": query_res.summary.max_timestamp
        },
        "summary": query_res.summary.dict() if hasattr(query_res.summary, 'dict') else query_res.summary.model_dump(),
        "events": [e.dict() if hasattr(e, 'dict') else e.model_dump() for e in query_res.events],
        "correlations": [c.dict() if hasattr(c, 'dict') else c.model_dump() for c in query_res.correlations],
        "bursts": [b.dict() if hasattr(b, 'dict') else b.model_dump() for b in query_res.bursts],
        "inconsistencies": [i.dict() if hasattr(i, 'dict') else i.model_dump() for i in query_res.inconsistencies]
    }
