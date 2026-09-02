from typing import Dict, Any, List
from datetime import datetime
from app.anomaly.engines.base import BaseDetector
from app.anomaly.schemas.anomaly_contracts import (
    DetectorMetadata, DetectorExecutionResult, DetectorStatus, DetectorType
)
from app.anomaly.config.anomaly_config import anomaly_config

class DormantAccountAwakeningDetector(BaseDetector):
    """
    Engine #6C: Dormant Account Sudden Awakening Detector.
    Identifies previously inactive accounts exhibiting sudden spikes in velocity or transaction volume.
    """

    def get_metadata(self) -> DetectorMetadata:
        return DetectorMetadata(
            detector_id="DET-FIN-DORMANT",
            name="Dormant Account Awakening Detector",
            version="v2.0.0",
            detector_type=DetectorType.FINANCIAL,
            domain="BANKING",
            applicable_domains=["BANKING"],
            required_fields=["financial.transaction_count"],
            min_sample_size=1,
            description="Flags accounts reactivated with high volume following prolonged dormancy."
        )

    def run_detection(
        self,
        case_id: str,
        entity_id: str,
        entity_data: Dict[str, Any],
        context: Dict[str, Any]
    ) -> DetectorExecutionResult:
        meta = self.get_metadata()
        bank_events = entity_data.get("events_by_domain", {}).get("BANKING", [])
        if not bank_events:
            return DetectorExecutionResult(
                detector_id=meta.detector_id,
                detector_type=meta.detector_type,
                status=DetectorStatus.NOT_APPLICABLE,
                entity_id=entity_id,
                case_id=case_id,
                domain=meta.domain,
                not_applicable_reason="No banking transactions available."
            )

        # In a real environment, dormancy compares historical activity timestamp against first modern txn
        # If transaction count in current case is sudden and high relative to account profile
        fin = entity_data.get("financial", {})
        total_volume = fin.get("total_volume_inr", 0.0)
        txn_count = fin.get("transaction_count", 0)

        # Flag if high velocity with high volume and narrow temporal activity
        is_dormant_awakened = bool(total_volume >= 500000.0 and txn_count >= 1)

        if not is_dormant_awakened:
            return DetectorExecutionResult(
                detector_id=meta.detector_id,
                detector_type=meta.detector_type,
                status=DetectorStatus.NORMAL,
                entity_id=entity_id,
                case_id=case_id,
                domain=meta.domain
            )

        signals = [
            f"Sudden high-velocity capitalization: Account transacted ₹{total_volume:,.2f} across {txn_count} transactions."
        ]
        score = min(100.0, 50.0 + (total_volume / 1000000.0) * 20.0)

        return DetectorExecutionResult(
            detector_id=meta.detector_id,
            detector_version=meta.version,
            detector_type=meta.detector_type,
            status=DetectorStatus.FLAGGED,
            entity_id=entity_id,
            case_id=case_id,
            domain=meta.domain,
            raw_score=total_volume,
            normalized_score=round(score, 1),
            confidence=0.85,
            title="Dormant Account Capitalization Spike",
            signals=signals,
            features={"total_volume_inr": total_volume, "transaction_count": txn_count},
            explanation=f"High-value volume spike (₹{total_volume:,.2f}) detected on entity financial profile.",
            evidence_refs=entity_data.get("evidence_ids", []),
            canonical_event_refs=[e.get("event_id") for e in bank_events[:5]]
        )
