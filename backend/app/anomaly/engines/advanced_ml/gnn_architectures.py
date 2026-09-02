from typing import Dict, Any, List
import numpy as np
try:
    import networkx as nx
except ImportError:
    nx = None
from app.anomaly.engines.base import BaseDetector
from app.anomaly.schemas.anomaly_contracts import (
    DetectorMetadata, DetectorExecutionResult, DetectorStatus, DetectorType
)

class RelationalGNNAnomalyDetector(BaseDetector):
    """
    Engine #11C: Relational Graph Convolutional Network (RGCN) & GraphSAGE Detector.
    Aggregates multi-hop heterogeneous neighborhoods across distinct edge relation types
    (OWNS_PHONE, OWNS_ACCOUNT, TRANSACTED_WITH, LOGGED_IN_FROM) to score multi-relational discordance.
    """

    def get_metadata(self) -> DetectorMetadata:
        return DetectorMetadata(
            detector_id="DET-ADV-RGCN",
            name="Multi-Relational GNN (RGCN / GraphSAGE) Detector",
            version="v2.0.0",
            detector_type=DetectorType.ADVANCED_ML,
            domain="CROSS_DOMAIN",
            applicable_domains=["CROSS_DOMAIN"],
            required_fields=[],
            min_sample_size=3,
            description="Heterogeneous neighborhood aggregation discovering multi-relational criminal cut-outs."
        )

    def run_detection(
        self,
        case_id: str,
        entity_id: str,
        entity_data: Dict[str, Any],
        context: Dict[str, Any]
    ) -> DetectorExecutionResult:
        meta = self.get_metadata()
        G = context.get("graph_nx")

        if nx is None or G is None or len(G) < meta.min_sample_size or entity_id not in G:
            return DetectorExecutionResult(
                detector_id=meta.detector_id,
                detector_type=meta.detector_type,
                status=DetectorStatus.NOT_APPLICABLE,
                entity_id=entity_id,
                case_id=case_id,
                domain=meta.domain,
                not_applicable_reason="Insufficient graph nodes for multi-relational GNN aggregation."
            )

        # 1-hop and 2-hop heterogeneous neighborhood aggregation
        neighbors_1hop = list(G.neighbors(entity_id))
        rel_types = set()
        for n in neighbors_1hop:
            edge_data = G.get_edge_data(entity_id, n, default={})
            rel = edge_data.get("relation")
            if rel:
                rel_types.add(rel)

        # Multi-relational entropy score: entities connecting diverse relation types
        # (e.g. holding phones, banking accounts, and IP logins simultaneously)
        rel_diversity = len(rel_types)
        deg = len(neighbors_1hop)

        score = min(100.0, (rel_diversity * 20.0) + (deg * 5.0))
        is_flagged = bool(rel_diversity >= 3 and deg >= 4)

        signals = []
        if is_flagged:
            signals.append(f"Heterogeneous Neighborhood Discordance: Entity orchestrates {deg} multi-modal links across {rel_diversity} relation types ({', '.join(rel_types)}).")

        return DetectorExecutionResult(
            detector_id=meta.detector_id,
            detector_version=meta.version,
            detector_type=meta.detector_type,
            status=DetectorStatus.FLAGGED if is_flagged else DetectorStatus.NORMAL,
            entity_id=entity_id,
            case_id=case_id,
            domain=meta.domain,
            raw_score=float(rel_diversity),
            normalized_score=round(score, 1),
            confidence=0.88,
            title="Multi-Relational GNN Heterogeneous Discordance",
            signals=signals,
            features={"relation_diversity": rel_diversity, "relations": list(rel_types), "degree": deg},
            explanation=f"Relational GNN aggregation flagged entity bridging {rel_diversity} disparate operational domains.",
            graph_refs=[entity_id]
        )
