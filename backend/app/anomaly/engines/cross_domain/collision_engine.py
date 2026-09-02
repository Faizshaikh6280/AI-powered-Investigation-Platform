from typing import Dict, Any, List
from datetime import datetime
from app.anomaly.engines.base import BaseDetector
from app.anomaly.schemas.anomaly_contracts import (
    DetectorMetadata, DetectorExecutionResult, DetectorStatus, DetectorType
)

class CrossDomainCollisionEngine(BaseDetector):
    """
    Engine #9: Cross-Domain Multi-Source Collision Engine.
    Correlates events across disparate domains occurring in close temporal and spatial proximity:
    Bank Transfer + Telegram Activity + Dynamic IP + Cell Tower Ping within a narrow Δt window.
    """

    def get_metadata(self) -> DetectorMetadata:
        return DetectorMetadata(
            detector_id="DET-CROSS-COLLISION",
            name="Cross-Domain Multi-Source Collision Engine",
            version="v2.0.0",
            detector_type=DetectorType.CROSS_DOMAIN,
            domain="CROSS_DOMAIN",
            applicable_domains=["CROSS_DOMAIN", "TELECOM", "BANKING", "SOCIAL", "NETWORK"],
            required_fields=["all_events"],
            min_sample_size=2,
            description="Identifies multi-modal operational convergence connecting banking, communications, and location."
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

        # Group events by domain
        bank_evs = [e for e in events if e.get("domain") == "BANKING" or e.get("source_type") == "BANKING"]
        comm_evs = [e for e in events if e.get("domain") in ("TELECOM", "SOCIAL", "NETWORK") or e.get("source_type") in ("TELECOM", "SOCIAL", "NETWORK")]

        if not bank_evs or not comm_evs:
            return DetectorExecutionResult(
                detector_id=meta.detector_id,
                detector_type=meta.detector_type,
                status=DetectorStatus.NOT_APPLICABLE,
                entity_id=entity_id,
                case_id=case_id,
                domain=meta.domain,
                not_applicable_reason="Requires events in at least two distinct operational domains (Financial + Telemetry/Social)."
            )

        collisions = []
        for b in bank_evs:
            b_ts_str = b.get("timestamp")
            if not b_ts_str:
                continue
            b_dt = datetime.fromisoformat(b_ts_str.replace("Z", "+00:00"))
            b_amt = b.get("financial", {}).get("amount_inr", 0.0)

            for c in comm_evs:
                c_ts_str = c.get("timestamp")
                if not c_ts_str:
                    continue
                c_dt = datetime.fromisoformat(c_ts_str.replace("Z", "+00:00"))
                delta_min = abs((c_dt - b_dt).total_seconds()) / 60.0

                # Collision within 30 minutes
                if delta_min <= 30.0:
                    c_domain = c.get("domain") or c.get("source_type")
                    c_ip = c.get("telemetry", {}).get("assigned_ip") or c.get("attributes", {}).get("client_ip")
                    c_tower = c.get("telemetry", {}).get("cell_tower_id") or c.get("attributes", {}).get("tower_address")

                    collisions.append({
                        "financial_event": b.get("event_id"),
                        "amount_inr": b_amt,
                        "comm_event": c.get("event_id"),
                        "comm_domain": c_domain,
                        "delta_minutes": round(delta_min, 1),
                        "ip": c_ip,
                        "tower": c_tower
                    })

        if not collisions:
            return DetectorExecutionResult(
                detector_id=meta.detector_id,
                detector_type=meta.detector_type,
                status=DetectorStatus.NORMAL,
                entity_id=entity_id,
                case_id=case_id,
                domain=meta.domain
            )

        signals = []
        for col in collisions[:3]:
            detail = f"₹{col['amount_inr']:,.2f} transfer correlated with {col['comm_domain']} activity within {col['delta_minutes']} minutes"
            if col["tower"]:
                detail += f" near {col['tower']}"
            if col["ip"]:
                detail += f" from IP {col['ip']}"
            signals.append(f"Multi-Domain Collision: {detail}.")

        score = min(100.0, 70.0 + (len(collisions) * 10.0))
        explanation = f"Cross-domain correlation engine detected {len(collisions)} temporal collisions between financial transactions and real-time communications/logins."

        event_refs = list({c["financial_event"] for c in collisions}.union({c["comm_event"] for c in collisions}))

        return DetectorExecutionResult(
            detector_id=meta.detector_id,
            detector_version=meta.version,
            detector_type=meta.detector_type,
            status=DetectorStatus.FLAGGED,
            entity_id=entity_id,
            case_id=case_id,
            domain=meta.domain,
            raw_score=float(len(collisions)),
            normalized_score=round(score, 1),
            confidence=0.96,  # Multi-domain cross-validation carries highest confidence
            title="Cross-Domain Financial & Communications Collision",
            signals=signals,
            features={"collisions_count": len(collisions), "collisions": collisions[:5]},
            explanation=explanation,
            evidence_refs=entity_data.get("evidence_ids", []),
            canonical_event_refs=event_refs[:10]
        )
