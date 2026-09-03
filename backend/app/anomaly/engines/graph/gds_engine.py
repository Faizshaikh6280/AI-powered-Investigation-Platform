from typing import Dict, Any, List
import networkx as nx
from app.anomaly.engines.base import BaseDetector
from app.anomaly.schemas.anomaly_contracts import (
    DetectorMetadata, DetectorExecutionResult, DetectorStatus, DetectorType
)

class GraphDataScienceEngine(BaseDetector):
    """
    Computes structural graph data science metrics (PageRank, Betweenness Centrality)
    to identify key coordinators and hubs in the network.
    """

    def get_metadata(self) -> DetectorMetadata:
        return DetectorMetadata(
            detector_id="DET-GDS-CENTRALITY",
            name="Graph Data Science Centrality",
            version="v1.0.0",
            detector_type=DetectorType.BEHAVIORAL,
            domain="CROSS_DOMAIN",
            applicable_domains=["CROSS_DOMAIN"],
            required_fields=[],
            description="Computes PageRank and Betweenness Centrality to detect hidden hubs and structural threats."
        )

    def run_detection(
        self,
        case_id: str,
        entity_id: str,
        entity_data: Dict[str, Any],
        context: Dict[str, Any]
    ) -> DetectorExecutionResult:
        meta = self.get_metadata()
        all_entity_store = context.get("all_entity_store", {})

        # Build in-memory NetworkX Graph
        G = nx.Graph()
        for eid, edata in all_entity_store.items():
            G.add_node(eid)
            # Link entities based on shared events
            events_a = set(edata.get("event_ids", []))
            for other_eid, other_edata in all_entity_store.items():
                if eid != other_eid:
                    events_b = set(other_edata.get("event_ids", []))
                    if len(events_a.intersection(events_b)) > 0:
                        G.add_edge(eid, other_eid)

        if len(G.nodes) == 0:
            return DetectorExecutionResult(
                detector_id=meta.detector_id,
                detector_type=meta.detector_type,
                status=DetectorStatus.NORMAL,
                entity_id=entity_id,
                case_id=case_id,
                domain=meta.domain
            )

        # Compute GDS Metrics
        pagerank = nx.pagerank(G, alpha=0.85)
        betweenness = nx.betweenness_centrality(G)

        pr_score = pagerank.get(entity_id, 0.0)
        bw_score = betweenness.get(entity_id, 0.0)

        # Normalize metrics to score
        pr_values = list(pagerank.values())
        if pr_values:
            pr_90th = sorted(pr_values)[int(len(pr_values) * 0.9)]
        else:
            pr_90th = 1.0

        is_flagged = pr_score > pr_90th and pr_score > 0.0

        raw_score = (pr_score * 0.7 + bw_score * 0.3) * 100
        norm_score = min(100.0, raw_score * 50)

        signals = []
        if pr_score > pr_90th:
            signals.append(f"High PageRank Centrality ({round(pr_score, 4)}): Entity acts as a major structural hub.")
        if bw_score > 0.1:
            signals.append(f"High Betweenness ({round(bw_score, 4)}): Entity bridges multiple isolated clusters.")

        return DetectorExecutionResult(
            detector_id=meta.detector_id,
            detector_version=meta.version,
            detector_type=meta.detector_type,
            status=DetectorStatus.FLAGGED if is_flagged else DetectorStatus.NORMAL,
            entity_id=entity_id,
            case_id=case_id,
            domain=meta.domain,
            raw_score=raw_score,
            normalized_score=norm_score,
            confidence=0.90,
            title="Graph Centrality Hub",
            signals=signals,
            features={"GDS_PageRank": pr_score, "GDS_BetweennessCentrality": bw_score},
            explanation=f"Graph Data Science (GDS) flagged entity with PageRank={round(pr_score, 4)} and Betweenness={round(bw_score, 4)}.",
            evidence_refs=[],
            canonical_event_refs=[]
        )
