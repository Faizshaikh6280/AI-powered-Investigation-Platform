from typing import Dict, Any, List
from app.anomaly.engines.base import BaseDetector
from app.anomaly.schemas.anomaly_contracts import (
    DetectorMetadata, DetectorExecutionResult, DetectorStatus, DetectorType
)
from app.core.database import get_db_context
from app.models.postgres_models import GoldenProfileModel

class IdentityDiscrepancyEngine(BaseDetector):
    """
    Engine #10: Identity & Entity Discrepancy Engine.
    Leverages Zingg Entity Resolution golden clusters to identify synthetic identities,
    alias discrepancies, shared national identifiers, and conflicting identity attributes.
    """

    def get_metadata(self) -> DetectorMetadata:
        return DetectorMetadata(
            detector_id="DET-ID-DISCREPANCY",
            name="Zingg Identity & Profile Discrepancy Engine",
            version="v2.0.0",
            detector_type=DetectorType.IDENTITY_DISCREPANCY,
            domain="KYC",
            applicable_domains=["KYC", "CROSS_DOMAIN"],
            required_fields=[],
            min_sample_size=1,
            description="Detects alias proliferation, conflicting credentials, and synthetic identity markers."
        )

    def run_detection(
        self,
        case_id: str,
        entity_id: str,
        entity_data: Dict[str, Any],
        context: Dict[str, Any]
    ) -> DetectorExecutionResult:
        meta = self.get_metadata()

        # Query Golden Profile from PostgreSQL
        profile = None
        with get_db_context() as db:
            p = db.query(GoldenProfileModel).filter_by(z_cluster_id=entity_id).first()
            if p:
                profile = {
                    "primary_name": p.primary_name,
                    "aliases": p.known_aliases or [],
                    "phones": p.known_phones or [],
                    "accounts": p.known_accounts or [],
                    "national_ids": p.national_ids or [],
                    "risk_score": p.risk_score
                }

        if not profile:
            return DetectorExecutionResult(
                detector_id=meta.detector_id,
                detector_type=meta.detector_type,
                status=DetectorStatus.NOT_APPLICABLE,
                entity_id=entity_id,
                case_id=case_id,
                domain=meta.domain,
                not_applicable_reason="No resolved golden profile cluster found for entity ID."
            )

        signals = []
        score = 0.0

        aliases = profile.get("aliases", [])
        if len(aliases) >= 2:
            score += 35.0
            signals.append(f"Alias Proliferation: Entity resolved to {len(aliases)} distinct operating aliases ({', '.join(aliases)}).")

        phones = profile.get("phones", [])
        if len(phones) >= 2:
            score += 25.0
            signals.append(f"Multiple Linked Cellular Subscriptions: Associated with {len(phones)} phone numbers ({', '.join(phones)}).")

        accounts = profile.get("accounts", [])
        if len(accounts) >= 2:
            score += 20.0
            signals.append(f"Multi-Account Banking Footprint: Linked across {len(accounts)} financial accounts.")

        nat_ids = profile.get("national_ids", [])
        if len(nat_ids) > 1:
            score += 45.0
            signals.append(f"Conflicting National Identifiers: Associated with multiple conflicting Govt IDs: {', '.join(nat_ids)}.")

        if score < 35.0:
            return DetectorExecutionResult(
                detector_id=meta.detector_id,
                detector_type=meta.detector_type,
                status=DetectorStatus.NORMAL,
                entity_id=entity_id,
                case_id=case_id,
                domain=meta.domain
            )

        total_score = min(100.0, score)
        explanation = f"Entity resolution discrepancy engine identified synthetic profile risk for {profile['primary_name']}. " + " ".join(signals)

        return DetectorExecutionResult(
            detector_id=meta.detector_id,
            detector_version=meta.version,
            detector_type=meta.detector_type,
            status=DetectorStatus.FLAGGED,
            entity_id=entity_id,
            case_id=case_id,
            domain=meta.domain,
            raw_score=float(len(aliases) + len(phones)),
            normalized_score=round(total_score, 1),
            confidence=0.94,
            title="Synthetic Identity & Credential Discrepancy",
            signals=signals,
            features=profile,
            explanation=explanation,
            evidence_refs=entity_data.get("evidence_ids", []),
            canonical_event_refs=entity_data.get("event_ids", [])[:5]
        )
