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
        case_id: Optional[str] = None,
        events: Optional[List[Dict[str, Any]]] = None
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
        if events is None:
            events = canonical_reader.iter_all_events(case_id=case_id, limit=5000)

        # Preload Golden Profiles for instant identity resolution across all anchors
        profile_map: Dict[str, Dict[str, Any]] = {}
        try:
            from app.core.database import get_db_context
            from app.models.postgres_models import GoldenProfileModel
            with get_db_context() as db:
                query = db.query(GoldenProfileModel)
                if case_id:
                    query = query.filter(GoldenProfileModel.case_id == case_id)
                for p in query.all():
                    p_data = {
                        "z_cluster_id": p.z_cluster_id,
                        "primary_name": p.primary_name,
                        "known_aliases": list(p.known_aliases or []),
                        "known_phones": [str(ph) for ph in (p.known_phones or [])],
                        "known_accounts": [str(acc) for acc in (p.known_accounts or [])],
                        "social_handles": list(p.social_handles or []),
                        "risk_score": float(p.risk_score or 0.5)
                    }
                    profile_map[p.z_cluster_id] = p_data
                    if p.primary_name:
                        profile_map[p.primary_name] = p_data
                        profile_map[p.primary_name.lower()] = p_data
                    for alias in p_data["known_aliases"]:
                        profile_map[alias] = p_data
                        profile_map[alias.lower()] = p_data
                    for ph in p_data["known_phones"]:
                        profile_map[ph] = p_data
                    for acc in p_data["known_accounts"]:
                        profile_map[acc] = p_data
                    for sh in p_data["social_handles"]:
                        if isinstance(sh, dict) and sh.get("handle"):
                            profile_map[sh["handle"]] = p_data
        except Exception as e:
            logger.warning(f"Failed to preload golden profiles: {e}")

        # Group events by resolved entity cluster
        entity_events: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

        for ev in events:
            cluster_id = ev.get("z_cluster_id")
            norm_id = ev.get("normalized_identity") or {}
            entities = ev.get("entities") or {}
            attrs = ev.get("attributes") or {}
            fin = ev.get("financial") or {}

            phone = norm_id.get("phone") or entities.get("phone") or attrs.get("phone") or attrs.get("mobile")
            account = fin.get("account_number") or attrs.get("account") or attrs.get("account_number") or attrs.get("from_account")
            handle = norm_id.get("social_handle") or entities.get("social_handle") or attrs.get("social_handle") or attrs.get("handle")
            name = norm_id.get("name") or entities.get("name") or attrs.get("name") or attrs.get("full_name")

            resolved_cid = None
            if cluster_id and cluster_id in profile_map:
                resolved_cid = cluster_id
            elif phone and str(phone) in profile_map:
                resolved_cid = profile_map[str(phone)]["z_cluster_id"]
            elif account and str(account) in profile_map:
                resolved_cid = profile_map[str(account)]["z_cluster_id"]
            elif handle and str(handle) in profile_map:
                resolved_cid = profile_map[str(handle)]["z_cluster_id"]
            elif name and str(name) in profile_map:
                resolved_cid = profile_map[str(name)]["z_cluster_id"]
            elif name and str(name).lower() in profile_map:
                resolved_cid = profile_map[str(name).lower()]["z_cluster_id"]

            imei = ev.get("telemetry", {}).get("imei") or attrs.get("imei")
            entity_key = resolved_cid or cluster_id or phone or account or handle or imei
            if not entity_key or str(entity_key).strip() in ("", "nan", "none", "None"):
                continue
            entity_events[str(entity_key).strip()].append(ev)

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

            # Resolve entity display name and metadata from Golden Profile
            profile = profile_map.get(entity_id)
            display_name = profile.get("primary_name") if profile else None
            if not display_name:
                for e in ev_list:
                    n = e.get("normalized_identity", {}).get("name")
                    if n and n != "Unknown":
                        display_name = n
                        break
            display_name = display_name or entity_id

            entity_store[entity_id] = {
                "entity_id": entity_id,
                "display_name": display_name,
                "entity_type": "Person" if (profile or entity_id.startswith("CLUSTER") or display_name != entity_id) else "Account" if any(bank_events) else "Phone",
                "profile": profile,
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
