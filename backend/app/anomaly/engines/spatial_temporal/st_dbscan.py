from typing import Dict, Any, List
from datetime import datetime
from app.anomaly.engines.base import BaseDetector
from app.anomaly.schemas.anomaly_contracts import (
    DetectorMetadata, DetectorExecutionResult, DetectorStatus, DetectorType
)
from app.anomaly.features.spatial_features import spatial_features
from app.anomaly.config.anomaly_config import anomaly_config

class STDBSCANConvergenceDetector(BaseDetector):
    """
    Engine #5B: ST-DBSCAN Spatio-Temporal Convergence Detector.
    Identifies clandestine physical co-location and convergence gatherings
    where multiple separate entities congregate within narrow spatial and temporal bounds.
    """

    def get_metadata(self) -> DetectorMetadata:
        return DetectorMetadata(
            detector_id="DET-SPATIAL-CONVERGENCE",
            name="ST-DBSCAN Multi-Entity Convergence Detector",
            version="v2.0.0",
            detector_type=DetectorType.SPATIAL_TEMPORAL,
            domain="CROSS_DOMAIN",
            applicable_domains=["TELECOM", "NETWORK", "CROSS_DOMAIN"],
            required_fields=["spatial.waypoints"],
            min_sample_size=1,
            description="Detects localized multi-device geographic convergence clusters."
        )

    def run_detection(
        self,
        case_id: str,
        entity_id: str,
        entity_data: Dict[str, Any],
        context: Dict[str, Any]
    ) -> DetectorExecutionResult:
        meta = self.get_metadata()
        all_entities = context.get("all_entity_store", {})

        my_waypoints = entity_data.get("spatial", {}).get("waypoints", [])
        if not my_waypoints:
            return DetectorExecutionResult(
                detector_id=meta.detector_id,
                detector_type=meta.detector_type,
                status=DetectorStatus.NORMAL,
                entity_id=entity_id,
                case_id=case_id,
                domain=meta.domain
            )

        eps_km = anomaly_config.spatial.st_dbscan_eps_km
        eps_sec = anomaly_config.spatial.st_dbscan_eps_time_sec

        co_located_entities = set()
        convergence_events = []

        for w1 in my_waypoints:
            t1 = datetime.fromisoformat(w1["timestamp"])
            lat1, lon1 = w1["lat"], w1["lng"]

            # Compare with other entities in the case
            for other_id, other_data in all_entities.items():
                if other_id == entity_id:
                    continue

                for w2 in other_data.get("spatial", {}).get("waypoints", []):
                    t2 = datetime.fromisoformat(w2["timestamp"])
                    time_diff = abs((t2 - t1).total_seconds())

                    if time_diff <= eps_sec:
                        dist = spatial_features.haversine_km(lat1, lon1, w2["lat"], w2["lng"])
                        if dist <= eps_km:
                            co_located_entities.add(other_id)
                            convergence_events.append({
                                "peer_entity": other_id,
                                "distance_km": round(dist, 2),
                                "time_delta_min": round(time_diff / 60.0, 1),
                                "at_time": w1["timestamp"]
                            })

        if not co_located_entities:
            return DetectorExecutionResult(
                detector_id=meta.detector_id,
                detector_type=meta.detector_type,
                status=DetectorStatus.NORMAL,
                entity_id=entity_id,
                case_id=case_id,
                domain=meta.domain
            )

        signals = [
            f"Geographic convergence: Entity converged with {len(co_located_entities)} other entities ({', '.join(list(co_located_entities)[:3])}) within {eps_km} km and {round(eps_sec/60)} minutes."
        ]
        score = min(100.0, 50.0 + (len(co_located_entities) * 15.0))
        explanation = f"ST-DBSCAN detected co-location cluster with {len(co_located_entities)} entities."

        return DetectorExecutionResult(
            detector_id=meta.detector_id,
            detector_version=meta.version,
            detector_type=meta.detector_type,
            status=DetectorStatus.FLAGGED,
            entity_id=entity_id,
            case_id=case_id,
            domain=meta.domain,
            raw_score=float(len(co_located_entities)),
            normalized_score=round(score, 1),
            confidence=0.85,
            title="Spatio-Temporal Co-Location Convergence",
            signals=signals,
            features={"converging_entities": list(co_located_entities), "convergence_events_count": len(convergence_events)},
            explanation=explanation,
            evidence_refs=entity_data.get("evidence_ids", [])
        )
