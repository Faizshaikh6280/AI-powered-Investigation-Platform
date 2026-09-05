import logging
from typing import Dict, Any, List, Optional
import networkx as nx

from app.core.config import settings
from app.core.neo4j_client import neo4j_client

logger = logging.getLogger("investigation.gds_engine")

_graph_cache: Dict[str, Any] = {}

def get_gds_client() -> Any:
    """Returns GDS client if available, else None."""
    try:
        from graphdatascience import GraphDataScience
        return GraphDataScience(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USERNAME, settings.NEO4J_PASSWORD)
        )
    except Exception as e:
        logger.info(f"GraphDataScience library not available ({e}), using NetworkX engine.")
        return None

def project_and_compute_association_strength(gds: Any = None, graph_name: str = "criminal_network"):
    """
    Projects the investigation graph into memory.
    Uses NetworkX as reliable default/fallback.
    """
    if not neo4j_client.ensure_connected():
        return {"status": "error", "message": "Neo4j not connected", "nodes": 0, "relationships": 0}

    with neo4j_client.driver.session() as session:
        # Fetch non-anomaly nodes
        n_res = session.run("MATCH (n) WHERE NOT 'Anomaly' IN labels(n) RETURN id(n) AS id, labels(n) AS labels, coalesce(n.name, n.primary_name, n.number, n.account_number, n.handle, id(n)) AS name")
        nodes = [(r["id"], {"labels": r["labels"], "name": str(r["name"])}) for r in n_res]

        # Fetch relationships
        r_res = session.run("MATCH (n)-[r]->(m) WHERE NOT 'Anomaly' IN labels(n) AND NOT 'Anomaly' IN labels(m) RETURN id(n) AS source, id(m) AS target, type(r) AS type, coalesce(r.amount, 1.0) AS weight")
        edges = [(r["source"], r["target"], {"type": r["type"], "weight": float(r["weight"] or 1.0)}) for r in r_res]

    G = nx.Graph()
    G.add_nodes_from(nodes)
    G.add_edges_from(edges)
    _graph_cache[graph_name] = G

    logger.info(f"Projected graph {graph_name} with {G.number_of_nodes()} nodes and {G.number_of_edges()} relationships.")
    return {
        "status": "success",
        "message": f"Graph {graph_name} projected with {G.number_of_nodes()} nodes and {G.number_of_edges()} relationships.",
        "nodes": G.number_of_nodes(),
        "relationships": G.number_of_edges()
    }

def run_gds_analytics(gds: Any = None, G: Any = None, graph_name: str = "criminal_network") -> Dict[str, Any]:
    """Execute community detection, PageRank, and Betweenness centrality."""
    if graph_name not in _graph_cache and G is None:
        project_and_compute_association_strength(graph_name=graph_name)

    g = G or _graph_cache.get(graph_name)
    if not g or g.number_of_nodes() == 0:
        return {"status": "success", "communities": []}

    try:
        try:
            communities = list(nx.community.louvain_communities(g, seed=42))
        except Exception:
            communities = list(nx.community.greedy_modularity_communities(g))
    except Exception:
        communities = [set(g.nodes())]

    try:
        pr = nx.pagerank(g)
    except Exception:
        pr = {n: 1.0 / max(1, len(g)) for n in g.nodes()}

    try:
        bc = nx.betweenness_centrality(g)
    except Exception:
        bc = {n: 0.0 for n in g.nodes()}

    # Write back to Neo4j
    if neo4j_client.ensure_connected():
        with neo4j_client.driver.session() as session:
            for comm_idx, comm in enumerate(communities):
                for node_id in comm:
                    session.run(
                        "MATCH (n) WHERE id(n) = $id SET n.communityId = $comm_id, n.pagerank = $pr, n.betweenness = $bc",
                        {"id": node_id, "comm_id": comm_idx, "pr": float(pr.get(node_id, 0.0)), "bc": float(bc.get(node_id, 0.0))}
                    )

    community_stats = [
        {"communityId": idx, "size": len(c)}
        for idx, c in enumerate(communities)
    ]
    community_stats.sort(key=lambda x: x["size"], reverse=True)
    return {"status": "success", "communities": community_stats[:10]}

def extract_community_subgraph(session, community_id: int) -> Dict[str, Any]:
    """Extracts a strict JSON data contract for a targeted syndicate subgraph."""
    query = """
    MATCH (m)
    WHERE m.communityId = $community_id AND NOT 'Anomaly' IN labels(m)
    WITH collect(m) AS members, count(m) AS total_members

    UNWIND members AS m
    WITH total_members, m,
         [(m)-[r:COMMUNICATED_WITH]-() | r] AS cdrs,
         [(m)-[r:TRANSACTED_WITH]-() | r] AS funds,
         [(m)-[r:ASSIGNED_IP]-() | r] AS ips,
         [(m)-[r:USES_HANDLE]-() | r] AS social

    WITH total_members,
         sum(size(cdrs)) AS cdr_count,
         sum(size(funds)) AS fund_count,
         sum(size(ips)) AS ip_count,
         sum(size(social)) AS social_count,
         collect({
            entity_id: str(id(m)),
            display_name: coalesce(m.name, m.primary_name, m.number, m.account_number, m.handle, str(id(m))),
            pagerank: coalesce(m.pagerank, 0.0),
            betweenness: coalesce(m.betweenness, 0.0),
            degree: size((m)--()),
            phone_numbers: coalesce(m.phones, []),
            bank_accounts: coalesce(m.known_accounts, []),
            ip_addresses: [],
            social_handles: coalesce(m.social_handles, [])
         }) AS offenders

    OPTIONAL MATCH (e1)-[r]->(e2)
    WHERE e1.communityId = $community_id AND e2.communityId = $community_id
      AND NOT 'Anomaly' IN labels(e1) AND NOT 'Anomaly' IN labels(e2)
    WITH total_members, cdr_count, fund_count, ip_count, social_count, offenders, type(r) AS rel_type, r, e1, e2

    WITH total_members, cdr_count, fund_count, ip_count, social_count, offenders,
         collect(CASE WHEN rel_type IN ['TRANSACTED_WITH', 'TRANSFERRED_FUNDS_TO'] THEN {
            tx_id: str(id(r)),
            sender_id: str(id(e1)),
            receiver_id: str(id(e2)),
            amount: coalesce(r.amount, 0.0),
            timestamp: coalesce(r.timestamp, ''),
            type: coalesce(r.txn_type, 'TRANSFER'),
            remarks: coalesce(r.channel, '')
         } END) AS financial_transactions,
         collect(CASE WHEN rel_type IN ['COMMUNICATED_WITH', 'PINGED_TOWER', 'USED_DEVICE'] THEN {
            call_id: str(id(r)),
            caller_id: str(id(e1)),
            callee_id: str(id(e2)),
            timestamp: coalesce(r.last_seen, r.timestamp, ''),
            duration_sec: coalesce(r.duration, 0),
            cell_tower_id: coalesce(r.tower_id, '')
         } END) AS communications_cdr,
         collect(CASE WHEN rel_type IN ['ASSIGNED_IP', 'LOGGED_IN_FROM', 'SHARED_IP_WITH'] THEN {
            session_id: str(id(r)),
            entity_id: str(id(e1)),
            dest_ip: coalesce(r.dest_ip, ''),
            dest_port: 0,
            timestamp: coalesce(r.last_seen, r.timestamp, ''),
            bytes_transferred: 0,
            vpn_or_proxy: false
         } END) AS digital_ipdr

    RETURN {
        group_id: $community_id,
        metrics_summary: {
            total_members: total_members,
            total_events: cdr_count + fund_count + ip_count + social_count,
            cdr_event_count: cdr_count,
            financial_event_count: fund_count,
            ipdr_event_count: ip_count,
            social_event_count: social_count
        },
        offenders: offenders,
        financial_transactions: [x IN financial_transactions WHERE x IS NOT NULL],
        communications_cdr: [x IN communications_cdr WHERE x IS NOT NULL],
        digital_ipdr: [x IN digital_ipdr WHERE x IS NOT NULL]
    } AS payload
    """
    result = session.run(query, community_id=community_id)
    record = result.single()
    return record["payload"] if record else {"group_id": community_id, "offenders": [], "metrics_summary": {}}
