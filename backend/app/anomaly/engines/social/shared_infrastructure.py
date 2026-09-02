from typing import Dict, Any, List
from app.anomaly.engines.base import BaseDetector
from app.anomaly.schemas.anomaly_contracts import (
    DetectorMetadata, DetectorExecutionResult, DetectorStatus, DetectorType
)

class SharedInfrastructureDetector(BaseDetector):
    """
    Engine #7B: Shared Clandestine Infrastructure Detector.
    Identifies distinct personas sharing the exact same dynamic IP, handset IMEI,
    or physical device footprint, indicating coordinated or synthetic identities.
    """

    def get_metadata(self) -> DetectorMetadata:
        return DetectorMetadata(
            detector_id="DET-SOC-INFRA",
            name="Shared Clandestine Infrastructure Detector",
            version="v2.0.0",
            detector_type=DetectorType.SOCIAL,
            domain="CROSS_DOMAIN",
            applicable_domains=["SOCIAL", "NETWORK", "TELECOM"],
            required_fields=["all_events"],
            min_sample_size=1,
            description="Identifies multiple separate operational personas operating from the same hardware or IP."
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

        my_ips = set(entity_data.get("network", {}).get("observed_assigned_ips", []))
        my_imeis = set(entity_data.get("communication", {}).get("observed_imeis", []))

        shared_with = []
        for other_id, other_data in all_entities.items():
            if other_id == entity_id:
                continue

            other_ips = set(other_data.get("network", {}).get("observed_assigned_ips", []))
            other_imeis = set(other_data.get("communication", {}).get("observed_imeis", []))

            common_ips = my_ips.intersection(other_ips)
            common_imeis = my_imeis.intersection(other_imeis)

            if common_ips or common_imeis:
                shared_with.append({
                    "peer": other_id,
                    "common_ips": list(common_ips),
                    "common_imeis": list(common_imeis)
                })

        if not shared_with:
            return DetectorExecutionResult(
                detector_id=meta.detector_id,
                detector_type=meta.detector_type,
                status=DetectorStatus.NORMAL,
                entity_id=entity_id,
                case_id=case_id,
                domain=meta.domain
            )

        signals = []
        for s in shared_with:
            if s["common_imeis"]:
                signals.append(f"Hardware Overlap: Shares physical handset (IMEI: {', '.join(s['common_imeis'])}) with entity {s['peer']}.")
            if s["common_ips"]:
                signals.append(f"Network Overlap: Concurrent IP lease ({', '.join(s['common_ips'])}) with entity {s['peer']}.")

        score = min(100.0, 50.0 + (len(shared_with) * 25.0))

        return DetectorExecutionResult(
            detector_id=meta.detector_id,
            detector_version=meta.version,
            detector_type=meta.detector_type,
            status=DetectorStatus.FLAGGED,
            entity_id=entity_id,
            case_id=case_id,
            domain=meta.domain,
            raw_score=float(len(shared_with)),
            normalized_score=round(score, 1),
            confidence=0.95,
            title="Shared Infrastructure & Hardware Footprint",
            signals=signals,
            features={"shared_entities": shared_with},
            explanation=f"Entity shares network or hardware assets with {len(shared_with)} other investigation personas.",
            evidence_refs=entity_data.get("evidence_ids", []),
            canonical_event_refs=entity_data.get("event_ids", [])[:5]
        )
