from fastapi import APIRouter, BackgroundTasks
from app.services.anomaly_engine import run_anomaly_detection
from pydantic import BaseModel
from neo4j import GraphDatabase
from app.core.config import settings

router = APIRouter()

class AnomalyFilter(BaseModel):
    severity: list[str] = []
    entity_type: list[str] = []
    search: str = ""

@router.post("/analyze")
def trigger_analysis():
    # Use celery in a real production, but here we can just fire it off via celery delay
    task = run_anomaly_detection.delay()
    return {"message": "Analysis started", "task_id": task.id}

@router.get("/")
def get_anomalies(severity: str = "", entity_type: str = "", search: str = ""):
    driver = GraphDatabase.driver(settings.NEO4J_URI, auth=(settings.NEO4J_USERNAME, settings.NEO4J_PASSWORD))
    try:
        with driver.session() as session:
            # Build dynamic WHERE clause based on filters
            where_clauses = []
            params = {}
            if severity:
                where_clauses.append("a.severity IN $severities")
                params["severities"] = severity.split(",")
            if entity_type:
                where_clauses.append("a.entityType IN $entity_types")
                params["entity_types"] = entity_type.split(",")
            if search:
                where_clauses.append("(toLower(a.entityId) CONTAINS toLower($search) OR toLower(apoc.text.join(a.reasons, ' ')) CONTAINS toLower($search))")
                params["search"] = search
                
            where_string = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
            
            query = f'''
                MATCH (e)-[:HAS_ANOMALY]->(a:Anomaly)
                {where_string}
                RETURN a, e.id AS entityId, labels(e)[0] AS entityType
                ORDER BY a.score DESC
                LIMIT 100
            '''
            result = session.run(query, params)
            anomalies = []
            for record in result:
                anomaly = record["a"]
                anomalies.append({
                    "id": anomaly["id"],
                    "entityId": anomaly["entityId"],
                    "entityType": anomaly["entityType"],
                    "type": anomaly["type"],
                    "severity": anomaly["severity"],
                    "score": anomaly["score"],
                    "status": anomaly["status"],
                    "reasons": anomaly["reasons"],
                    "detectedAt": anomaly["detectedAt"].iso_format() if anomaly.get("detectedAt") else None,
                })
            return {"anomalies": anomalies}
    finally:
        driver.close()

@router.get("/stats")
def get_anomaly_stats():
    driver = GraphDatabase.driver(settings.NEO4J_URI, auth=(settings.NEO4J_USERNAME, settings.NEO4J_PASSWORD))
    try:
        with driver.session() as session:
            result = session.run('''
                MATCH (a:Anomaly)
                RETURN 
                    count(a) AS total,
                    sum(CASE WHEN a.severity = 'CRITICAL' THEN 1 ELSE 0 END) AS critical,
                    sum(CASE WHEN a.severity = 'HIGH' THEN 1 ELSE 0 END) AS high,
                    sum(CASE WHEN a.severity = 'MEDIUM' THEN 1 ELSE 0 END) AS medium,
                    sum(CASE WHEN a.severity = 'LOW' THEN 1 ELSE 0 END) AS low
            ''')
            record = result.single()
            if record:
                return {
                    "total": record["total"] or 0,
                    "critical": record["critical"] or 0,
                    "high": record["high"] or 0,
                    "medium": record["medium"] or 0,
                    "low": record["low"] or 0
                }
            return {"total":0, "critical":0, "high":0, "medium":0, "low":0}
    finally:
        driver.close()
