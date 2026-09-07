"""
Fix Neo4j: Purge stale graph data, re-sync for the active case.
"""
print("Step 1: Purging all stale Neo4j nodes...", flush=True)
from neo4j import GraphDatabase
d = GraphDatabase.driver("bolt://127.0.0.1:7687", auth=("neo4j", "password123"), connection_timeout=10.0)

with d.session() as s:
    # First count what's there
    cnt = s.run("MATCH (n) RETURN count(n) AS c").single()["c"]
    print(f"  Found {cnt} stale nodes in Neo4j", flush=True)
    
    # Purge all stale data
    res = s.run("MATCH (n) DETACH DELETE n")
    summary = res.consume()
    print(f"  Purged: {summary.counters.nodes_deleted} nodes, {summary.counters.relationships_deleted} rels deleted", flush=True)

    # Verify empty
    cnt2 = s.run("MATCH (n) RETURN count(n) AS c").single()["c"]
    print(f"  Neo4j now has {cnt2} nodes (should be 0)", flush=True)

d.close()

print("\nStep 2: Finding active case with evidence...", flush=True)
from app.core.database import get_db_context
from app.models.postgres_models import CaseModel, EvidenceModel, GoldenProfileModel

target_case_id = None
with get_db_context() as db:
    cases = db.query(CaseModel).order_by(CaseModel.created_at.desc()).all()
    for c in cases:
        ev_count = db.query(EvidenceModel).filter_by(case_id=c.case_id).count()
        gp_count = db.query(GoldenProfileModel).filter_by(case_id=c.case_id).count()
        print(f"  {c.case_id} | Evidence: {ev_count} | Profiles: {gp_count}", flush=True)
        if ev_count > 0 and target_case_id is None:
            target_case_id = c.case_id

if not target_case_id:
    print("  No case with evidence found! Upload data first.", flush=True)
    import sys; sys.exit(0)

print(f"\nStep 3: Re-syncing graph for {target_case_id}...", flush=True)
import time
t0 = time.time()
from app.services.graph_sync import sync_mongo_to_neo4j
result = sync_mongo_to_neo4j(case_id=target_case_id)
elapsed = time.time() - t0
print(f"  Graph sync result: {result} ({elapsed:.2f}s)", flush=True)

print("\nStep 4: Verifying Neo4j graph...", flush=True)
d = GraphDatabase.driver("bolt://127.0.0.1:7687", auth=("neo4j", "password123"), connection_timeout=10.0)
with d.session() as s:
    r = s.run("MATCH (n) WHERE n.case_id = $cid RETURN count(n) AS c", {"cid": target_case_id})
    cnt = r.single()["c"]
    print(f"  Neo4j now has {cnt} nodes for {target_case_id}", flush=True)
    
    r2 = s.run("MATCH (n) WHERE n.case_id = $cid RETURN DISTINCT labels(n) AS lbl, count(*) AS cnt ORDER BY cnt DESC", {"cid": target_case_id})
    for rec in r2:
        print(f"    {rec['lbl']}: {rec['cnt']}", flush=True)
    
    r3 = s.run("MATCH (n)-[r]->(m) WHERE n.case_id = $cid RETURN DISTINCT type(r) AS t, count(*) AS cnt ORDER BY cnt DESC", {"cid": target_case_id})
    for rec in r3:
        print(f"    REL {rec['t']}: {rec['cnt']}", flush=True)
d.close()

print("\n=== NEO4J GRAPH FIX COMPLETE ===", flush=True)
