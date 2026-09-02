from typing import List, Dict, Any, Optional
from collections import defaultdict
import pandas as pd
from app.processing.canonical_reader import canonical_reader
from app.anomaly.features.communication_features import comm_features
from app.anomaly.features.financial_features import financial_features
from app.anomaly.features.spatial_features import spatial_features
from app.anomaly.features.network_features import network_features

class FeatureFactory:
    """
    Columnar Feature Factory that aggregates raw canonical events from MinIO/Iceberg
    into entity-level and event-level analytical feature representations.
    """

    def __init__(self):
        pass

    def build_entity_feature_store(
        self,
        case_id: Optional[str] = None
    ) -> Dict[str, Dict[str, Any]]:
        """
        Groups all canonical events by resolved entity cluster or primary anchor,
        then computes cross-domain feature vectors for each entity.
        Returns:
            dict mapping entity_id -> {
                "entity_id": ...,
                "entity_type": ...,
                "communication": {...},
                "financial": {...},
                "spatial": {...},
                "network": {...},
                "all_events": [...],
                "evidence_ids": [...],
                "event_ids": [...]
            }
        """
        events = canonical_reader.read_all_events(case_id=case_id)
        if not events:
            return {}

        # Group events by entity
        # Hierarchy: z_cluster_id -> phone -> account_number -> handle -> raw event
        entity_events: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

        for ev in events:
            cluster_id = ev.get("z_cluster_id")
            phone = ev.get("normalized_identity", {}).get("phone")
            account = ev.get("financial", {}).get("account_number")
            handle = ev.get("normalized_identity", {}).get("social_handle")

            entity_key = cluster_id or phone or account or handle or ev.get("event_id")
            entity_events[str(entity_key)].append(ev)

        entity_store: Dict[str, Dict[str, Any]] = {}

        for entity_id, ev_list in entity_events.items():
            # Partition by domain
            cdr_events = [e for e in ev_list if e.get("domain") == "TELECOM" or e.get("source_type") == "TELECOM"]
            bank_events = [e for e in ev_list if e.get("domain") == "BANKING" or e.get("source_type") == "BANKING"]
            ipdr_events = [e for e in ev_list if e.get("domain") == "NETWORK" or e.get("source_type") == "NETWORK"]
            social_events = [e for e in ev_list if e.get("domain") == "SOCIAL" or e.get("source_type") == "SOCIAL"]
            kyc_events = [e for e in ev_list if e.get("domain") == "KYC" or e.get("source_type") == "KYC"]

            comm_feat = comm_features.extract_features(cdr_events) if cdr_events else {}
            fin_feat = financial_features.extract_features(bank_events) if bank_events else {}
            spatial_feat = spatial_features.extract_trajectory_features(ev_list)
            net_feat = network_features.extract_features(ipdr_events + social_events)

            evidence_ids = list({e.get("evidence_id") for e in ev_list if e.get("evidence_id")})
            event_ids = [e.get("event_id") for e in ev_list if e.get("event_id")]

            # Resolve entity display name/type
            name = None
            for e in ev_list:
                n = e.get("normalized_identity", {}).get("name")
                if n and n != "Unknown":
                    name = n
                    break

            entity_store[entity_id] = {
                "entity_id": entity_id,
                "display_name": name or entity_id,
                "entity_type": "Person" if (entity_id.startswith("CLUSTER") or name) else "Account" if any(bank_events) else "Phone",
                "communication": comm_feat,
                "financial": fin_feat,
                "spatial": spatial_feat,
                "network": net_feat,
                "events_by_domain": {
                    "TELECOM": cdr_events,
                    "BANKING": bank_events,
                    "NETWORK": ipdr_events,
                    "SOCIAL": social_events,
                    "KYC": kyc_events
                },
                "all_events": ev_list,
                "evidence_ids": evidence_ids,
                "event_ids": event_ids
            }

        return entity_store

    def build_tabular_matrix(self, entity_store: Dict[str, Dict[str, Any]]) -> pd.DataFrame:
        """Flattens entity features into a tabular Pandas/PyArrow DataFrame for ML inference."""
        rows = []
        for entity_id, data in entity_store.items():
            comm = data.get("communication", {})
            fin = data.get("financial", {})
            spat = data.get("spatial", {})
            net = data.get("network", {})

            rows.append({
                "entity_id": entity_id,
                "call_count": comm.get("call_count", 0),
                "unique_contacts": comm.get("unique_contacts", 0),
                "avg_call_duration": comm.get("avg_call_duration", 0.0),
                "night_activity_ratio": comm.get("night_activity_ratio", 0.0),
                "unique_imeis": comm.get("unique_imeis", 0),
                "transaction_count": fin.get("transaction_count", 0),
                "total_volume_inr": fin.get("total_volume_inr", 0.0),
                "max_transaction_inr": fin.get("max_transaction_inr", 0.0),
                "inflow_outflow_ratio": fin.get("inflow_outflow_ratio", 1.0),
                "velocity_per_day": fin.get("velocity_per_day", 0.0),
                "total_distance_km": spat.get("total_distance_km", 0.0),
                "max_speed_kmh": spat.get("max_speed_kmh", 0.0),
                "session_count": net.get("session_count", 0),
                "total_bytes_transferred": net.get("total_bytes_transferred", 0.0),
                "tor_port_hits": net.get("tor_port_hits", 0)
            })

        df = pd.DataFrame(rows)
        if not df.empty:
            df.fillna(0, inplace=True)
        return df

feature_factory = FeatureFactory()
