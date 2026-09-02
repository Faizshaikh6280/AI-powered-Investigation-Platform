import logging
import uuid
import datetime
import json
from typing import Dict, Any, List, Optional
from app.core.database import get_db_context
from app.core.neo4j_client import neo4j_client
from app.models.postgres_models import AnomalyFindingModel, AnomalyRunModel, CaseModel
from app.anomaly.features.feature_factory import feature_factory
from app.anomaly.registry.detector_registry import detector_registry
from app.anomaly.scoring.unified_scoring import unified_scoring
from app.anomaly.schemas.anomaly_contracts import UnifiedFindingContract, DetectorStatus

logger = logging.getLogger("MultiEngineOrchestrator")

class MultiEngineOrchestrator:
    """
    Production-grade Multi-Engine Anomaly Orchestrator.
    Manages end-to-end execution across 11+ analytical engines with complete failure isolation,
    dual PostgreSQL and Neo4j persistence, and frontend backward compatibility.
    """

    def __init__(self):
        self.registry = detector_registry

    def run_case_analysis(self, case_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Executes multi-engine anomaly analysis for a given case (or active case).
        """
        run_id = f"RUN-{uuid.uuid4()}"
        start_time = datetime.datetime.now(datetime.timezone.utc)

        # Resolve active case if None
        resolved_case_id = case_id
        with get_db_context() as db:
            if not resolved_case_id:
                latest_case = db.query(CaseModel).order_by(CaseModel.created_at.desc()).first()
                if latest_case:
                    resolved_case_id = latest_case.case_id
                else:
                    resolved_case_id = "CASE-DEFAULT"

            # Ensure case row exists in PostgreSQL to satisfy foreign key constraint
            existing_case = db.query(CaseModel).filter_by(case_id=resolved_case_id).first()
            if not existing_case:
                default_case = CaseModel(
                    case_id=resolved_case_id,
                    case_reference=f"REF-{resolved_case_id}",
                    title=f"Investigation Case {resolved_case_id}",
                    status="ACTIVE"
                )
                db.add(default_case)
                db.commit()

            # Create AnomalyRunModel
            run_record = AnomalyRunModel(
                run_id=run_id,
                case_id=resolved_case_id,
                status="RUNNING",
                current_stage="FEATURE_EXTRACTION",
                started_at=start_time,
                detectors_executed=[],
                detectors_failed=[]
            )
            db.add(run_record)
            db.commit()

        logger.info(f"Starting Multi-Engine Anomaly Run {run_id} for Case {resolved_case_id}")

        detectors_executed = []
        detectors_failed = []
        all_findings: List[UnifiedFindingContract] = []

        try:
            # Stage 1: Feature Extraction
            logger.info("Stage 1: Building entity feature store from Canonical Warehouse...")
            entity_store = feature_factory.build_entity_feature_store(case_id=resolved_case_id)
            population_df = feature_factory.build_tabular_matrix(entity_store)

            # Stage 2: Prepare Context
            context: Dict[str, Any] = {
                "case_id": resolved_case_id,
                "all_entity_store": entity_store,
                "population_matrix": population_df,
                "run_id": run_id
            }

            # Update Run stage
            with get_db_context() as db:
                run = db.query(AnomalyRunModel).filter_by(run_id=run_id).first()
                if run:
                    run.current_stage = "ENGINE_EXECUTION"
                    db.commit()

            # Stage 3: Multi-Engine Execution
            logger.info("Stage 2: Executing 11+ analytical engines across entity store...")
            detectors = self.registry.get_all_detectors()

            for entity_id, entity_data in entity_store.items():
                entity_results = []

                for detector in detectors:
                    det_meta = detector.get_metadata()
                    det_id = det_meta.detector_id

                    try:
                        res = detector.execute(
                            case_id=resolved_case_id,
                            entity_id=entity_id,
                            entity_data=entity_data,
                            context=context
                        )
                        entity_results.append(res)
                        if det_id not in detectors_executed:
                            detectors_executed.append(det_id)
                    except Exception as ex:
                        logger.error(f"Detector {det_id} failed on entity {entity_id}: {ex}")
                        if det_id not in detectors_failed:
                            detectors_failed.append(det_id)

                # Stage 4: Scoring & Fusion per entity
                consolidated = unified_scoring.consolidate_findings(
                    case_id=resolved_case_id,
                    entity_id=entity_id,
                    entity_data=entity_data,
                    results=entity_results
                )
                all_findings.extend(consolidated)

            # Stage 5: Dual Persistence
            logger.info(f"Stage 3: Persisting {len(all_findings)} unified findings to PostgreSQL & Neo4j...")
            self._persist_to_postgres(resolved_case_id, all_findings)
            self._persist_to_neo4j(all_findings)

            # Stage 6: Finalize Run State
            end_time = datetime.datetime.now(datetime.timezone.utc)
            duration_sec = (end_time - start_time).total_seconds()

            summary_stats = {
                "total_entities_analyzed": len(entity_store),
                "total_findings": len(all_findings),
                "critical_count": sum(1 for f in all_findings if f.severity.value == "CRITICAL"),
                "high_count": sum(1 for f in all_findings if f.severity.value == "HIGH"),
                "medium_count": sum(1 for f in all_findings if f.severity.value == "MEDIUM"),
                "low_count": sum(1 for f in all_findings if f.severity.value == "LOW"),
                "duration_seconds": round(duration_sec, 2)
            }

            with get_db_context() as db:
                run = db.query(AnomalyRunModel).filter_by(run_id=run_id).first()
                if run:
                    run.status = "COMPLETED" if not detectors_failed else "PARTIAL_FAILURE"
                    run.current_stage = "COMPLETED"
                    run.completed_at = end_time
                    run.detectors_executed = detectors_executed
                    run.detectors_failed = detectors_failed
                    run.total_findings = len(all_findings)
                    run.summary_stats = summary_stats
                    db.commit()

            logger.info(f"Anomaly run {run_id} completed successfully. Findings: {len(all_findings)}")
            return {
                "status": "success",
                "run_id": run_id,
                "case_id": resolved_case_id,
                "summary": summary_stats,
                "detectors_executed": detectors_executed,
                "detectors_failed": detectors_failed
            }

        except Exception as e:
            logger.error(f"Anomaly Orchestrator encountered unhandled error: {e}", exc_info=True)
            with get_db_context() as db:
                run = db.query(AnomalyRunModel).filter_by(run_id=run_id).first()
                if run:
                    run.status = "FAILED"
                    run.completed_at = datetime.datetime.now(datetime.timezone.utc)
                    run.error_message = str(e)
                    db.commit()
            return {"status": "error", "message": str(e), "run_id": run_id}

    def _persist_to_postgres(self, case_id: str, findings: List[UnifiedFindingContract]):
        """Persists findings into PostgreSQL anomaly_findings table."""
        with get_db_context() as db:
            for f in findings:
                existing = db.query(AnomalyFindingModel).filter_by(finding_id=f.finding_id).first()
                if not existing:
                    row = AnomalyFindingModel(
                        finding_id=f.finding_id,
                        case_id=case_id,
                        entity_id=f.entity_id,
                        entity_type=f.entity_type,
                        fingerprint=f.fingerprint,
                        title=f.title,
                        severity=f.severity.value,
                        unified_score=f.unified_score,
                        confidence=f.confidence,
                        investigative_priority=f.investigative_priority,
                        domain=f.domain,
                        primary_detector_type=f.primary_detector_type,
                        contributing_detectors=f.contributing_detectors,
                        signals=f.signals,
                        explanation=f.explanation,
                        metrics=f.metrics,
                        evidence_refs=f.evidence_refs,
                        canonical_event_refs=f.canonical_event_refs,
                        graph_refs=f.graph_refs,
                        model_metadata=f.model_metadata,
                        status="DETECTED"
                    )
                    db.add(row)
            db.commit()

    def _persist_to_neo4j(self, findings: List[UnifiedFindingContract]):
        """
        Persists findings into Neo4j graph with full backward compatibility.
        Creates (:Anomaly) nodes and [:HAS_ANOMALY] relationships.
        """
        if not neo4j_client.ensure_connected():
            logger.warning("Neo4j driver not connected; skipping Neo4j graph sync for anomalies.")
            return

        with neo4j_client.driver.session() as session:
            for f in findings:
                cypher = """
                MERGE (a:Anomaly {id: $finding_id})
                SET a.score = $score,
                    a.severity = $severity,
                    a.type = $anomaly_type,
                    a.reasons = $reasons,
                    a.metrics = $metrics,
                    a.detectedAt = datetime(),
                    a.status = 'NEW',
                    a.entityType = $entity_type,
                    a.entityId = $entity_id,
                    a.title = $title,
                    a.confidence = $confidence,
                    a.investigativePriority = $priority,
                    a.domain = $domain,
                    a.contributingDetectors = $contributing

                WITH a
                OPTIONAL MATCH (e) WHERE 
                    e.golden_id = $entity_id
                    OR e.number = $entity_id
                    OR e.account_number = $entity_id
                    OR e.handle = $entity_id
                    OR e.address = $entity_id
                    OR e.imei_number = $entity_id
                    OR e.tower_id = $entity_id
                    OR coalesce(e.golden_id, e.number, e.account_number, e.handle, e.address, elementId(e)) = $entity_id
                FOREACH (_ IN CASE WHEN e IS NOT NULL THEN [1] ELSE [] END |
                    MERGE (e)-[:HAS_ANOMALY]->(a)
                )
                """
                session.run(cypher, {
                    "finding_id": f.finding_id,
                    "score": f.unified_score,
                    "severity": f.severity.value,
                    "anomaly_type": f.primary_detector_type,
                    "reasons": f.signals if f.signals else [f.title],
                    "metrics": json.dumps(f.metrics),
                    "entity_type": f.entity_type,
                    "entity_id": f.entity_id,
                    "title": f.title,
                    "confidence": f.confidence,
                    "priority": f.investigative_priority,
                    "domain": f.domain,
                    "contributing": f.contributing_detectors
                })

orchestrator = MultiEngineOrchestrator()
