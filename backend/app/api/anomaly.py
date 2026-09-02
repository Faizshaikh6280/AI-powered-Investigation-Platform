import json
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from neo4j import GraphDatabase
from app.core.config import settings
from app.core.database import get_db_context
from app.models.postgres_models import AnomalyFindingModel, AnomalyRunModel
from app.services.anomaly_engine import run_anomaly_detection
from app.anomaly.registry.detector_registry import detector_registry

logger = logging.getLogger("AnomalyAPI")
router = APIRouter()

class AnomalyFilter(BaseModel):
    severity: List[str] = []
    entity_type: List[str] = []
    search: str = ""

@router.post("/analyze")
def trigger_analysis(case_id: Optional[str] = None, sync: bool = True):
    """
    Triggers end-to-end multi-engine anomaly analysis.
    Defaults to direct synchronous execution for guaranteed, immediate completion.
    """
    if sync:
        logger.info(f"Executing multi-engine anomaly analysis synchronously for case: {case_id or 'ACTIVE'}")
        result = run_anomaly_detection(case_id=case_id)
        return {"message": "Analysis completed", "result": result}
    try:
        task = run_anomaly_detection.delay(case_id=case_id)
        return {"message": "Analysis started", "task_id": task.id}
    except Exception as e:
        logger.warning(f"[Celery] Task queuing unavailable ({e}), executing synchronously...")
        result = run_anomaly_detection(case_id=case_id)
        return {"message": "Analysis completed (direct mode)", "result": result}

@router.get("/health")
def get_detector_health():
    """Returns the operational status and metadata of all 11+ registered anomaly engines."""
    detectors = detector_registry.get_all_detectors()
    return {
        "status": "HEALTHY",
        "total_detectors": len(detectors),
        "engines": [
            {
                "detector_id": d.get_metadata().detector_id,
                "name": d.get_metadata().name,
                "type": d.get_metadata().detector_type.value,
                "domain": d.get_metadata().domain,
                "version": d.get_metadata().version,
                "applicable_domains": d.get_metadata().applicable_domains,
                "description": d.get_metadata().description
            }
            for d in detectors
        ]
    }

@router.get("/")
def get_anomalies(
    severity: str = "",
    entity_type: str = "",
    search: str = "",
    limit: int = 100
):
    """
    Retrieves anomaly findings from Neo4j / PostgreSQL.
    Maintains 100% backward compatibility with the frontend AnomaliesTab and Drawer.
    """
    driver = GraphDatabase.driver(settings.NEO4J_URI, auth=(settings.NEO4J_USERNAME, settings.NEO4J_PASSWORD))
    try:
        with driver.session() as session:
            where_clauses = []
            params: Dict[str, Any] = {"limit": limit}

            if severity:
                where_clauses.append("a.severity IN $severities")
                params["severities"] = [s.strip().upper() for s in severity.split(",") if s.strip()]

            if entity_type:
                where_clauses.append("a.entityType IN $entity_types")
                params["entity_types"] = [e.strip() for e in entity_type.split(",") if e.strip()]

            if search:
                # Resilient pure Cypher search without APOC dependency
                where_clauses.append("(toLower(a.entityId) CONTAINS toLower($search) OR any(r IN a.reasons WHERE toLower(r) CONTAINS toLower($search)))")
                params["search"] = search

            where_string = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

            query = f"""
                MATCH (a:Anomaly)
                OPTIONAL MATCH (e)-[:HAS_ANOMALY]->(a)
                {where_string}
                RETURN a, coalesce(a.entityId, e.id) AS entityId, coalesce(a.entityType, labels(e)[0]) AS entityType
                ORDER BY a.score DESC
                LIMIT $limit
            """
            result = session.run(query, params)
            anomalies = []
            for record in result:
                anomaly = record["a"]
                metrics_val = anomaly.get("metrics")
                if isinstance(metrics_val, str):
                    try:
                        metrics_val = json.loads(metrics_val)
                    except Exception:
                        pass

                detected_at = anomaly.get("detectedAt")
                detected_iso = detected_at.iso_format() if hasattr(detected_at, "iso_format") else str(detected_at) if detected_at else None

                anomalies.append({
                    "id": anomaly.get("id"),
                    "entityId": anomaly.get("entityId") or record.get("entityId"),
                    "entityType": anomaly.get("entityType") or record.get("entityType") or "Person",
                    "type": anomaly.get("type", "Multi-Engine Anomaly"),
                    "severity": anomaly.get("severity", "MEDIUM"),
                    "score": float(anomaly.get("score", 0.0)),
                    "status": anomaly.get("status", "NEW"),
                    "reasons": anomaly.get("reasons", []),
                    "metrics": metrics_val or {},
                    "detectedAt": detected_iso,
                    "title": anomaly.get("title", ""),
                    "confidence": float(anomaly.get("confidence", 1.0)),
                    "investigativePriority": anomaly.get("investigativePriority", "MEDIUM"),
                    "domain": anomaly.get("domain", "CROSS_DOMAIN"),
                    "contributingDetectors": anomaly.get("contributingDetectors", [])
                })
            return {"anomalies": anomalies}
    except Exception as e:
        logger.error(f"Error reading anomalies from Neo4j, falling back to PostgreSQL: {e}")
        # Fallback to PostgreSQL
        with get_db_context() as db:
            query = db.query(AnomalyFindingModel)
            if severity:
                query = query.filter(AnomalyFindingModel.severity.in_([s.strip().upper() for s in severity.split(",")]))
            if entity_type:
                query = query.filter(AnomalyFindingModel.entity_type.in_([e.strip() for e in entity_type.split(",")]))
            rows = query.order_by(AnomalyFindingModel.unified_score.desc()).limit(limit).all()
            return {
                "anomalies": [
                    {
                        "id": r.finding_id,
                        "entityId": r.entity_id,
                        "entityType": r.entity_type,
                        "type": r.primary_detector_type,
                        "severity": r.severity,
                        "score": r.unified_score,
                        "status": r.status,
                        "reasons": r.signals,
                        "metrics": r.metrics or {},
                        "detectedAt": r.created_at.isoformat() if r.created_at else None,
                        "title": r.title,
                        "confidence": r.confidence,
                        "investigativePriority": r.investigative_priority,
                        "domain": r.domain,
                        "contributingDetectors": r.contributing_detectors
                    }
                    for r in rows
                ]
            }
    finally:
        driver.close()

@router.get("/stats")
def get_anomaly_stats():
    """
    Returns counts by severity band for the overview and radar dashboard.
    """
    driver = GraphDatabase.driver(settings.NEO4J_URI, auth=(settings.NEO4J_USERNAME, settings.NEO4J_PASSWORD))
    try:
        with driver.session() as session:
            result = session.run("""
                MATCH (a:Anomaly)
                RETURN 
                    count(a) AS total,
                    sum(CASE WHEN a.severity = 'CRITICAL' THEN 1 ELSE 0 END) AS critical,
                    sum(CASE WHEN a.severity = 'HIGH' THEN 1 ELSE 0 END) AS high,
                    sum(CASE WHEN a.severity = 'MEDIUM' THEN 1 ELSE 0 END) AS medium,
                    sum(CASE WHEN a.severity = 'LOW' THEN 1 ELSE 0 END) AS low
            """)
            record = result.single()
            if record and record["total"]:
                return {
                    "total": int(record["total"] or 0),
                    "critical": int(record["critical"] or 0),
                    "high": int(record["high"] or 0),
                    "medium": int(record["medium"] or 0),
                    "low": int(record["low"] or 0)
                }
    except Exception as e:
        logger.warning(f"Neo4j stats query failed ({e}), querying PostgreSQL...")
    finally:
        driver.close()

    # Fallback to PostgreSQL
    with get_db_context() as db:
        from sqlalchemy import func, case
        row = db.query(
            func.count(AnomalyFindingModel.finding_id).label("total"),
            func.sum(case((AnomalyFindingModel.severity == 'CRITICAL', 1), else_=0)).label("critical"),
            func.sum(case((AnomalyFindingModel.severity == 'HIGH', 1), else_=0)).label("high"),
            func.sum(case((AnomalyFindingModel.severity == 'MEDIUM', 1), else_=0)).label("medium"),
            func.sum(case((AnomalyFindingModel.severity == 'LOW', 1), else_=0)).label("low")
        ).first()

        return {
            "total": int(row.total or 0),
            "critical": int(row.critical or 0),
            "high": int(row.high or 0),
            "medium": int(row.medium or 0),
            "low": int(row.low or 0)
        }

@router.get("/{finding_id}")
def get_anomaly_detail(finding_id: str):
    """
    Retrieves complete analytical detail, provenance, metrics, and explanations for a finding.
    """
    with get_db_context() as db:
        finding = db.query(AnomalyFindingModel).filter_by(finding_id=finding_id).first()
        if not finding:
            raise HTTPException(status_code=404, detail=f"Anomaly finding '{finding_id}' not found.")

        return {
            "finding_id": finding.finding_id,
            "case_id": finding.case_id,
            "entity_id": finding.entity_id,
            "entity_type": finding.entity_type,
            "fingerprint": finding.fingerprint,
            "title": finding.title,
            "severity": finding.severity,
            "unified_score": finding.unified_score,
            "confidence": finding.confidence,
            "investigative_priority": finding.investigative_priority,
            "domain": finding.domain,
            "primary_detector_type": finding.primary_detector_type,
            "contributing_detectors": finding.contributing_detectors,
            "signals": finding.signals,
            "explanation": finding.explanation,
            "metrics": finding.metrics,
            "evidence_refs": finding.evidence_refs,
            "canonical_event_refs": finding.canonical_event_refs,
            "graph_refs": finding.graph_refs,
            "model_metadata": finding.model_metadata,
            "status": finding.status,
            "created_at": finding.created_at.isoformat() if finding.created_at else None
        }

@router.get("/cases/{case_id}/findings")
def get_case_anomaly_findings(case_id: str):
    """Retrieves all anomaly findings scoped to a specific case."""
    with get_db_context() as db:
        findings = db.query(AnomalyFindingModel).filter_by(case_id=case_id).order_by(AnomalyFindingModel.unified_score.desc()).all()
        return {
            "case_id": case_id,
            "total_findings": len(findings),
            "findings": [
                {
                    "finding_id": f.finding_id,
                    "entity_id": f.entity_id,
                    "entity_type": f.entity_type,
                    "title": f.title,
                    "severity": f.severity,
                    "unified_score": f.unified_score,
                    "confidence": f.confidence,
                    "priority": f.investigative_priority,
                    "domain": f.domain,
                    "signals": f.signals,
                    "explanation": f.explanation,
                    "evidence_count": len(f.evidence_refs or [])
                }
                for f in findings
            ]
        }
