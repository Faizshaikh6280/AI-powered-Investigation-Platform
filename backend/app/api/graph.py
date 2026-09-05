from typing import Optional
from fastapi import APIRouter
from app.core.neo4j_client import neo4j_client

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

@router.get("/topology")
async def get_graph_topology(case_id: Optional[str] = None):
    if not neo4j_client.ensure_connected():
        return {"nodes": [], "edges": []}

    target_case_id = case_id
    if not target_case_id:
        from app.core.database import get_db_context
        from app.models.postgres_models import CaseModel
        with get_db_context() as db:
            c = db.query(CaseModel).order_by(CaseModel.created_at.desc()).first()
            if not c:
                return {"nodes": [], "edges": []}
            target_case_id = c.case_id

    # If target_case_id is resolved, verify whether Neo4j contains nodes for this case.
    # If not yet populated, dynamically sync from the canonical warehouse and golden profiles.
    with neo4j_client.driver.session() as session:
        check_res = session.run(
            "MATCH (n) WHERE n.case_id = $case_id OR $case_id IN coalesce(n.case_ids, []) RETURN count(n) AS cnt",
            {"case_id": target_case_id}
        ).single()
        cnt = check_res["cnt"] if check_res else 0
        if cnt == 0:
            from app.services.graph_sync import sync_mongo_to_neo4j
            await sync_mongo_to_neo4j(case_id=target_case_id)

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
    LIMIT 2000
    """
    params = {"case_id": target_case_id}
    
    nodes = {}
    edges = []

    with neo4j_client.driver.session() as session:
        result = session.run(query, params)
        for record in result:
            s_id = record["source_id"]
            if s_id not in nodes:
                nodes[s_id] = {
                    "id": str(s_id),
                    "label": extract_label(record["source_labels"], record["source_props"]),
                    "type": record["source_labels"][0] if record["source_labels"] else "Unknown",
                    "properties": record["source_props"]
                }
                
            t_id = record["target_id"]
            if t_id is not None:
                if t_id not in nodes:
                    nodes[t_id] = {
                        "id": str(t_id),
                        "label": extract_label(record["target_labels"], record["target_props"]),
                        "type": record["target_labels"][0] if record["target_labels"] else "Unknown",
                        "properties": record["target_props"]
                    }
                edges.append({
                    "id": f'e_{record["rel_id"]}',
                    "source": str(s_id),
                    "target": str(t_id),
                    "relationship": record["rel_type"],
                    "properties": record["rel_props"] or {}
                })
                
    return {"nodes": list(nodes.values()), "edges": edges}

@router.post("/sync")
async def sync_graph(case_id: Optional[str] = None):
    from app.services.graph_sync import sync_mongo_to_neo4j
    return await sync_mongo_to_neo4j(case_id=case_id)

