from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.neo4j_client import neo4j_client
from app.core.database import get_db
from app.models.iam_models import UserModel, CaseMemberModel
from app.authorization.dependencies import require_permission
from app.authorization.permissions import Permissions
from app.authorization.roles import Roles

router = APIRouter()

def extract_label(labels, props):
    return (
        props.get("name") or 
        props.get("holder") or 
        props.get("number") or 
        props.get("handle") or 
        props.get("account_number") or 
        props.get("address") or 
        props.get("imei_number") or 
        props.get("tower_id") or 
        "Unknown"
    )

def build_canonical_graph(target_case_id: str):
    from app.core.database import get_db_context
    from app.models.postgres_models import GoldenProfileModel
    from app.processing.canonical_reader import canonical_reader

    nodes = {}
    edges = []

    with get_db_context() as db:
        profiles = db.query(GoldenProfileModel).filter_by(case_id=target_case_id).all()
        for p in profiles:
            p_id = f"person_{p.z_cluster_id}"
            nodes[p_id] = {
                "id": p_id,
                "label": p.primary_name or "Unknown Person",
                "type": "Person",
                "riskScore": p.risk_score or 0.0,
                "properties": {
                    "golden_id": p.z_cluster_id,
                    "name": p.primary_name,
                    "risk_score": p.risk_score,
                    "aliases": p.known_aliases or [],
                    "case_id": target_case_id
                }
            }
            # Phone edges
            for ph in (p.known_phones or []):
                if ph and str(ph).lower() not in ("nan", "none", ""):
                    ph_id = f"phone_{ph}"
                    if ph_id not in nodes:
                        nodes[ph_id] = {
                            "id": ph_id,
                            "label": str(ph),
                            "type": "Phone",
                            "properties": {"number": str(ph), "case_id": target_case_id}
                        }
                    edges.append({
                        "id": f"e_{p_id}_{ph_id}",
                        "source": p_id,
                        "target": ph_id,
                        "relationship": "OWNS_PHONE",
                        "properties": {}
                    })
            # Account edges
            for acc in (p.known_accounts or []):
                if acc and str(acc).lower() not in ("nan", "none", ""):
                    acc_id = f"acc_{acc}"
                    if acc_id not in nodes:
                        nodes[acc_id] = {
                            "id": acc_id,
                            "label": str(acc),
                            "type": "BankAccount",
                            "properties": {"account_number": str(acc), "holder": p.primary_name, "case_id": target_case_id}
                        }
                    edges.append({
                        "id": f"e_{p_id}_{acc_id}",
                        "source": p_id,
                        "target": acc_id,
                        "relationship": "OWNS_ACCOUNT",
                        "properties": {}
                    })
            # Social handles
            for sh in (p.social_handles or []):
                h = sh.get("handle") if isinstance(sh, dict) else str(sh)
                if h:
                    sh_id = f"social_{h}"
                    if sh_id not in nodes:
                        nodes[sh_id] = {
                            "id": sh_id,
                            "label": str(h),
                            "type": "SocialAccount",
                            "properties": {"handle": str(h), "case_id": target_case_id}
                        }
                    edges.append({
                        "id": f"e_{p_id}_{sh_id}",
                        "source": p_id,
                        "target": sh_id,
                        "relationship": "USES_HANDLE",
                        "properties": {}
                    })

        # NFC Evidence Acquisitions
        try:
            from app.models.nfc_evidence_models import NFCEvidenceAcquisitionModel
            nfc_items = db.query(NFCEvidenceAcquisitionModel).filter_by(case_id=target_case_id).all()
            for item in nfc_items:
                ev_node_id = f"evidence_{item.evidence_id}"
                nodes[ev_node_id] = {
                    "id": ev_node_id,
                    "label": f"NFC Evidence ({item.acquisition_id})",
                    "type": "Evidence",
                    "riskScore": 0.4,
                    "properties": {
                        "evidence_id": item.evidence_id,
                        "acquisition_id": item.acquisition_id,
                        "source_type": "NFC",
                        "sha256": item.raw_sha256,
                        "records": item.record_count,
                        "case_id": target_case_id
                    }
                }
                # Extracted Phone/Email edges
                for ident in (item.derived_identifiers or []):
                    field = ident.get("field")
                    val = ident.get("value")
                    if not val:
                        continue
                    if field == "phone":
                        ph_node_id = f"phone_{val}"
                        if ph_node_id not in nodes:
                            nodes[ph_node_id] = {
                                "id": ph_node_id,
                                "label": str(val),
                                "type": "Phone",
                                "properties": {"number": str(val), "case_id": target_case_id}
                            }
                        edges.append({
                            "id": f"e_{ev_node_id}_{ph_node_id}",
                            "source": ev_node_id,
                            "target": ph_node_id,
                            "relationship": "NFC_EVIDENCE_CONTAINS_PHONE",
                            "properties": {}
                        })
                    elif field == "email":
                        em_node_id = f"email_{val}"
                        if em_node_id not in nodes:
                            nodes[em_node_id] = {
                                "id": em_node_id,
                                "label": str(val),
                                "type": "Email",
                                "properties": {"address": str(val), "case_id": target_case_id}
                            }
                        edges.append({
                            "id": f"e_{ev_node_id}_{em_node_id}",
                            "source": ev_node_id,
                            "target": em_node_id,
                            "relationship": "NFC_EVIDENCE_CONTAINS_EMAIL",
                            "properties": {}
                        })

                # Entity linkage
                er_res = item.entity_resolution_result or {}
                matched_cid = er_res.get("matched_cluster_id")
                tier = er_res.get("match_tier")
                if matched_cid:
                    target_p_id = f"person_{matched_cid}"
                    if target_p_id in nodes:
                        rel_name = "NFC_EVIDENCE_MATCHED_ENTITY" if tier == "MATCHED" else "NFC_EVIDENCE_SUGGESTS_ENTITY"
                        edges.append({
                            "id": f"e_{ev_node_id}_{target_p_id}",
                            "source": ev_node_id,
                            "target": target_p_id,
                            "relationship": rel_name,
                            "properties": {"confidence": er_res.get("confidence", 0.0)}
                        })
        except Exception as nfc_err:
            logger.warning(f"Error loading NFC graph nodes: {nfc_err}")

    try:
        events = canonical_reader.read_all_events(case_id=target_case_id, limit=3000)
        seen_edges = set()
        for ev in events:
            telemetry = ev.get("telemetry", {})
            financial = ev.get("financial", {})
            identity = ev.get("normalized_identity", {})

            from_acc = financial.get("account_number") or ev.get("attributes", {}).get("from_account")
            to_acc = financial.get("counterparty") or ev.get("attributes", {}).get("to_account")
            if from_acc and to_acc:
                f_id = f"acc_{from_acc}"
                t_id = f"acc_{to_acc}"
                if f_id not in nodes:
                    nodes[f_id] = {"id": f_id, "label": str(from_acc), "type": "BankAccount", "properties": {"account_number": str(from_acc)}}
                if t_id not in nodes:
                    nodes[t_id] = {"id": t_id, "label": str(to_acc), "type": "BankAccount", "properties": {"account_number": str(to_acc)}}
                edge_k = (f_id, t_id, "TRANSACTED_WITH")
                if edge_k not in seen_edges:
                    seen_edges.add(edge_k)
                    edges.append({
                        "id": f"e_tx_{len(edges)}",
                        "source": f_id,
                        "target": t_id,
                        "relationship": "TRANSACTED_WITH",
                        "properties": {"amount": financial.get("amount_inr", 0), "timestamp": ev.get("timestamp")}
                    })

            phone = identity.get("phone")
            imei = telemetry.get("imei") or ev.get("attributes", {}).get("imei")
            tower = telemetry.get("cell_tower_id") or ev.get("attributes", {}).get("cell_id")
            ip = telemetry.get("assigned_ip") or ev.get("attributes", {}).get("ip")

            if phone:
                ph_id = f"phone_{phone}"
                if ph_id not in nodes:
                    nodes[ph_id] = {"id": ph_id, "label": str(phone), "type": "Phone", "properties": {"number": str(phone)}}
                if imei:
                    im_id = f"imei_{imei}"
                    if im_id not in nodes:
                        nodes[im_id] = {"id": im_id, "label": str(imei), "type": "IMEI", "properties": {"imei_number": str(imei)}}
                    edge_k = (ph_id, im_id, "USED_DEVICE")
                    if edge_k not in seen_edges:
                        seen_edges.add(edge_k)
                        edges.append({
                            "id": f"e_im_{len(edges)}",
                            "source": ph_id,
                            "target": im_id,
                            "relationship": "USED_DEVICE",
                            "properties": {}
                        })
                if tower:
                    tw_id = f"tower_{tower}"
                    if tw_id not in nodes:
                        nodes[tw_id] = {"id": tw_id, "label": str(tower), "type": "CellTower", "properties": {"tower_id": str(tower)}}
                    edge_k = (ph_id, tw_id, "PINGED_TOWER")
                    if edge_k not in seen_edges:
                        seen_edges.add(edge_k)
                        edges.append({
                            "id": f"e_tw_{len(edges)}",
                            "source": ph_id,
                            "target": tw_id,
                            "relationship": "PINGED_TOWER",
                            "properties": {}
                        })
                if ip:
                    ip_id = f"ip_{ip}"
                    if ip_id not in nodes:
                        nodes[ip_id] = {"id": ip_id, "label": str(ip), "type": "IPAddress", "properties": {"address": str(ip)}}
                    edge_k = (ph_id, ip_id, "ASSIGNED_IP")
                    if edge_k not in seen_edges:
                        seen_edges.add(edge_k)
                        edges.append({
                            "id": f"e_ip_{len(edges)}",
                            "source": ph_id,
                            "target": ip_id,
                            "relationship": "ASSIGNED_IP",
                            "properties": {}
                        })
    except Exception:
        pass

    return {"nodes": list(nodes.values()), "edges": edges}

@router.get("/topology")
def get_graph_topology(
    case_id: Optional[str] = None,
    current_user: UserModel = Depends(require_permission(Permissions.GRAPH_VIEW)),
    db: Session = Depends(get_db)
):
    target_case_id = case_id
    if not target_case_id:
        from app.models.postgres_models import CaseModel
        c = db.query(CaseModel).order_by(CaseModel.created_at.desc()).first()
        if not c:
            return {"nodes": [], "edges": []}
        target_case_id = c.case_id

    # Check case membership if scoped investigator
    role_name = current_user.role.name if current_user.role else ""
    if role_name not in (Roles.SYSTEM_ADMIN, Roles.SUPERINTENDENT, Roles.AUDITOR):
        is_member = db.query(CaseMemberModel).filter_by(
            case_id=target_case_id, user_id=current_user.id, active=True
        ).first()
        if not is_member and role_name != Roles.IPS_OFFICER:
            raise HTTPException(status_code=403, detail=f"Access denied: Not assigned to case {target_case_id}")

    # If Neo4j is connected, synchronize and query native Cypher graph
    if neo4j_client.ensure_connected():
        try:
            with neo4j_client.driver.session() as session:
                check_res = session.run(
                    "MATCH (n) WHERE n.case_id = $case_id OR $case_id IN coalesce(n.case_ids, []) RETURN count(n) AS cnt",
                    {"case_id": target_case_id}
                ).single()
                cnt = check_res["cnt"] if check_res else 0
                if cnt == 0:
                    from app.services.graph_sync import sync_mongo_to_neo4j
                    sync_mongo_to_neo4j(case_id=target_case_id)

            query = """
            MATCH (n) WHERE NOT 'Anomaly' IN labels(n) AND (n.case_id = $case_id OR $case_id IN coalesce(n.case_ids, []))
            OPTIONAL MATCH (n)-[r]->(m) WHERE NOT 'Anomaly' IN labels(m) AND (m.case_id = $case_id OR $case_id IN coalesce(m.case_ids, []))
            RETURN 
                id(n) AS source_id, 
                labels(n) AS source_labels, 
                properties(n) AS source_props,
                id(m) AS target_id,
                labels(m) AS target_labels,
                properties(m) AS target_props,
                type(r) AS rel_type,
                id(r) AS rel_id,
                properties(r) AS rel_props
            LIMIT 2500
            """
            nodes = {}
            edges = []
            with neo4j_client.driver.session() as session:
                result = session.run(query, {"case_id": target_case_id})
                for record in result:
                    s_id = record["source_id"]
                    if s_id not in nodes:
                        nodes[s_id] = {
                            "id": str(s_id),
                            "label": extract_label(record["source_labels"], record["source_props"]),
                            "type": record["source_labels"][0] if record["source_labels"] else "Unknown",
                            "riskScore": record["source_props"].get("risk_score", 0.0),
                            "properties": record["source_props"]
                        }
                    t_id = record["target_id"]
                    if t_id is not None:
                        if t_id not in nodes:
                            nodes[t_id] = {
                                "id": str(t_id),
                                "label": extract_label(record["target_labels"], record["target_props"]),
                                "type": record["target_labels"][0] if record["target_labels"] else "Unknown",
                                "riskScore": record["target_props"].get("risk_score", 0.0),
                                "properties": record["target_props"]
                            }
                        edges.append({
                            "id": f'e_{record["rel_id"]}',
                            "source": str(s_id),
                            "target": str(t_id),
                            "relationship": record["rel_type"],
                            "properties": record["rel_props"] or {}
                        })
            if nodes:
                return {"nodes": list(nodes.values()), "edges": edges}
        except Exception as e:
            import logging
            logging.getLogger("investigation.graph").warning(f"[GraphTopology] Neo4j query failed for {target_case_id}, falling back to canonical: {e}")

    # Fallback to direct PostgreSQL & Canonical Parquet graph construction
    return build_canonical_graph(target_case_id)

@router.post("/sync")
def sync_graph(
    case_id: Optional[str] = None,
    current_user: UserModel = Depends(require_permission(Permissions.GRAPH_VIEW))
):
    from app.services.graph_sync import sync_mongo_to_neo4j
    return sync_mongo_to_neo4j(case_id=case_id)


