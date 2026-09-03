from typing import Dict, Any, List
from graphdatascience import GraphDataScience
from app.core.config import settings

def get_gds_client() -> GraphDataScience:
    """Initialize and return the GraphDataScience client."""
    return GraphDataScience(
        settings.NEO4J_URI,
        auth=(settings.NEO4J_USERNAME, settings.NEO4J_PASSWORD)
    )

def project_and_compute_association_strength(gds: GraphDataScience, graph_name: str = "criminal_network"):
    """
    Project weighted monopartite graph via Cypher Projection.
    Links entities across CDR, Bank Transfers, Shared IPDR Sessions, and Social Links.
    Computes Association Strength C_ij / (S_i * S_j)
    """
    if gds.graph.exists(graph_name)["exists"]:
        gds.graph.drop(gds.graph.get(graph_name))
        
    node_query = """
    MATCH (e:Entity)
    RETURN id(e) AS id, labels(e) AS labels
    """
    
    relationship_query = """
    MATCH (e1:Entity)-[r:COMMUNICATED_WITH|TRANSFERRED_FUNDS_TO|SHARED_IP_WITH|INTERACTED_WITH]-(e2:Entity)
    WHERE id(e1) < id(e2)
    WITH e1, e2, count(r) AS C_ij
    MATCH (e1)-[r1]-(:Entity) WITH e1, e2, C_ij, count(r1) AS S_i
    MATCH (e2)-[r2]-(:Entity) WITH e1, e2, C_ij, S_i, count(r2) AS S_j
    WITH e1, e2, (toFloat(C_ij) / (toFloat(S_i) * toFloat(S_j))) AS association_strength
    RETURN id(e1) AS source, id(e2) AS target, 'CO_OFFENDING' AS type, association_strength AS weight
    """
    
    G, result = gds.graph.project.cypher(
        graph_name,
        node_query,
        relationship_query
    )
    return G

def run_gds_analytics(gds: GraphDataScience, G) -> Dict[str, Any]:
    """Execute GDS algorithms for Community Detection and Role Mining."""
    # 1. Louvain Community Detection
    gds.louvain.write(
        G,
        writeProperty="communityId",
        relationshipWeightProperty="weight",
        includeIntermediateCommunities=False
    )
    
    # 2. PageRank (Operational Leaders)
    gds.pageRank.write(
        G,
        writeProperty="pagerank",
        relationshipWeightProperty="weight",
        dampingFactor=0.85,
        maxIterations=50
    )
    
    # 3. Betweenness Centrality (Brokers / Gatekeepers)
    gds.betweenness.write(
        G,
        writeProperty="betweenness"
    )

    return {"status": "GDS Analytics executed successfully"}

def extract_community_subgraph(session, community_id: int) -> Dict[str, Any]:
    """Extracts a strict JSON data contract for a targeted syndicate subgraph."""
    
    query = """
    MATCH (e:Entity)
    WHERE e.communityId = $community_id
    WITH collect(e) AS members, count(e) AS total_members
    
    // Calculate node properties
    UNWIND members AS m
    WITH total_members, m,
         [(m)-[r:COMMUNICATED_WITH]-() | r] AS cdrs,
         [(m)-[r:TRANSFERRED_FUNDS_TO]-() | r] AS funds,
         [(m)-[r:SHARED_IP_WITH]-() | r] AS ips,
         [(m)-[r:INTERACTED_WITH]-() | r] AS social
    
    WITH total_members,
         sum(size(cdrs)) AS cdr_count,
         sum(size(funds)) AS fund_count,
         sum(size(ips)) AS ip_count,
         sum(size(social)) AS social_count,
         collect({
            entity_id: m.id,
            display_name: coalesce(m.name, m.primary_name, m.id),
            pagerank: coalesce(m.pagerank, 0.0),
            betweenness: coalesce(m.betweenness, 0.0),
            degree: size((m)--()),
            phone_numbers: m.known_phones,
            bank_accounts: m.known_accounts,
            ip_addresses: m.known_ips,
            social_handles: m.known_handles
         }) AS offenders
         
    // Now extract specific events (edges) within the community
    MATCH (e1:Entity)-[r]->(e2:Entity)
    WHERE e1.communityId = $community_id AND e2.communityId = $community_id
    WITH total_members, cdr_count, fund_count, ip_count, social_count, offenders, type(r) AS rel_type, r, e1, e2
    
    WITH total_members, cdr_count, fund_count, ip_count, social_count, offenders,
         collect(CASE WHEN rel_type = 'TRANSFERRED_FUNDS_TO' THEN {
            tx_id: elementId(r),
            sender_id: e1.id,
            receiver_id: e2.id,
            amount: coalesce(r.amount, 0.0),
            timestamp: r.timestamp,
            type: coalesce(r.method, 'UNKNOWN'),
            remarks: r.remarks
         } END) AS financial_transactions,
         collect(CASE WHEN rel_type = 'COMMUNICATED_WITH' THEN {
            call_id: elementId(r),
            caller_id: e1.id,
            callee_id: e2.id,
            timestamp: r.timestamp,
            duration_sec: coalesce(r.duration, 0),
            cell_tower_id: r.tower_id
         } END) AS communications_cdr,
         collect(CASE WHEN rel_type = 'SHARED_IP_WITH' THEN {
            session_id: elementId(r),
            entity_id: e1.id,
            dest_ip: r.dest_ip,
            dest_port: r.dest_port,
            timestamp: r.timestamp,
            bytes_transferred: coalesce(r.bytes, 0),
            vpn_or_proxy: coalesce(r.vpn_or_proxy, false)
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
    return record["payload"] if record else None
