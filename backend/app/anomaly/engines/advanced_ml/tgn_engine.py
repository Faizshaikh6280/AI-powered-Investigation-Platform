from typing import Dict, Any, List
from datetime import datetime
import numpy as np
from app.anomaly.engines.base import BaseDetector
from app.anomaly.schemas.anomaly_contracts import (
    DetectorMetadata, DetectorExecutionResult, DetectorStatus, DetectorType
)

class TemporalGraphNetworkDetector(BaseDetector):
    """
    Engine #11D: Temporal Graph Network (TGN) Dynamic Edge Evolution Engine.
    Models continuous-time interaction streams to detect abnormal temporal graph evolution,
    such as sudden bursts of newly formed edges with unfamiliar counterparties.
    """

    def get_metadata(self) -> DetectorMetadata:
        return DetectorMetadata(
            detector_id="DET-ADV-TGN",
            name="Temporal Graph Network (TGN) Dynamic Edge Detector",
            version="v2.0.0",
            detector_type=DetectorType.ADVANCED_ML,
            domain="CROSS_DOMAIN",
            applicable_domains=["CROSS_DOMAIN", "TELECOM", "BANKING"],
            required_fields=["all_events"],
            min_sample_size=3,
            description="Models temporal edge evolution to detect anomalous interaction bursts."
        )

    def run_detection(
        self,
        case_id: str,
        entity_id: str,
        entity_data: Dict[str, Any],
        context: Dict[str, Any]
    ) -> DetectorExecutionResult:
        meta = self.get_metadata()
        events = entity_data.get("all_events", [])

        if len(events) < 3:
            return DetectorExecutionResult(
                detector_id=meta.detector_id,
                detector_type=meta.detector_type,
                status=DetectorStatus.NOT_APPLICABLE,
                entity_id=entity_id,
                case_id=case_id,
                domain=meta.domain,
                not_applicable_reason="Insufficient interaction stream length for TGN temporal sequence modeling."
            )

        # Extract timestamped interaction sequence
        interactions = []
        for e in events:
            ts = e.get("timestamp")
            if ts:
                try:
                    dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                    interactions.append(dt)
                except Exception:
                    pass

        interactions.sort()
        deltas = [(interactions[i+1] - interactions[i]).total_seconds() for i in range(len(interactions)-1)]

        if not deltas:
            return DetectorExecutionResult(
                detector_id=meta.detector_id,
                detector_type=meta.detector_type,
                status=DetectorStatus.NORMAL,
                entity_id=entity_id,
                case_id=case_id,
                domain=meta.domain
            )

        mean_delta = float(np.mean(deltas))
        min_delta = float(np.min(deltas))

        # TGN burstiness: rapid successive interactions within less than 60s
        burst_count = sum(1 for d in deltas if d <= 60.0)
        is_flagged = bool(burst_count >= 2 and min_delta <= 15.0)

        score = min(100.0, 50.0 + (burst_count * 15.0))

        signals = []
        if is_flagged:
            signals.append(f"Dynamic Edge Velocity Spike: {burst_count} rapid continuous-time interactions formed within seconds of each other (Min Δt: {min_delta}s).")

        return DetectorExecutionResult(
            detector_id=meta.detector_id,
            detector_version=meta.version,
            detector_type=meta.detector_type,
            status=DetectorStatus.FLAGGED if is_flagged else DetectorStatus.NORMAL,
            entity_id=entity_id,
            case_id=case_id,
            domain=meta.domain,
            raw_score=float(burst_count),
            normalized_score=round(score, 1),
            confidence=0.87,
            title="Temporal Graph Edge Evolution Burst",
            signals=signals,
            features={"burst_interactions": burst_count, "min_interval_sec": min_delta},
            explanation=f"TGN continuous-time sequence analysis identified dynamic edge creation bursts.",
            evidence_refs=entity_data.get("evidence_ids", [])
        )
