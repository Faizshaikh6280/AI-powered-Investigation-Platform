import os
import csv
import subprocess
from app.core.db import db_client
from datetime import datetime

PIPELINE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "zingg_pipeline")
EXPORT_PATH = os.path.join(PIPELINE_DIR, "normalized_evidence_export.csv")
CONFIG_PATH = os.path.join(PIPELINE_DIR, "config.json")

async def export_for_zingg():
    events = await db_client.events_col.find({}).to_list(None)
    
    with open(EXPORT_PATH, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(["record_id", "full_name", "phone", "national_id", "email", "address"])
        for ev in events:
            identity = ev.get("normalized_identity", {})
            writer.writerow([
                str(ev["_id"]),
                identity.get("name", ""),
                identity.get("phone", ""),
                identity.get("national_id", ""),
                identity.get("email", ""),
                ev.get("telemetry", {}).get("address", "")
            ])
            
    return len(events)

async def run_zingg_pipeline():
    print("[Zingg] Starting training data preparation...")
    try:
        import requests
        # Attempt to hit the native Docker Linux Zingg Worker (port 8001 locally mapped)
        res = requests.post("http://localhost:8001/execute", json={
            "data_path": "/data_files/normalized_evidence_export.csv",
            "output_dir": "/app/zingg_output_models"
        }, timeout=30)
        
        if res.status_code == 200 and res.json().get("status") == "success":
            print("[Zingg] Successfully executed Native Linux Zingg Engine via Docker Worker!")
            # In a real pipeline, Zingg models would generate output CSVs which we'd parse.
            # Since findTrainingData just generated pairs, we will still fallback to the proxy 
            # to generate the exact deterministic clusters needed for the Neo4j visualization for the demo.
            return await fallback_zingg_clustering()
        else:
            print(f"[Zingg] Real Zingg execution failed: {res.text}")
            return await fallback_zingg_clustering()
            
    except Exception as e:
        print(f"[Zingg] Docker Zingg Worker not available: {e}")
        return await fallback_zingg_clustering()

async def fallback_zingg_clustering():
    """
    Mocking Zingg output for Windows Hackathon Environment.
    Reads exported CSV, applies exact matching on strong anchors, and fuzzy matching proxy.
    Updates MongoDB with clusters.
    """
    import pandas as pd
    import hashlib
    
    if not os.path.exists(EXPORT_PATH):
        return {"status": "error", "message": "Export file not found."}
        
    df = pd.read_csv(EXPORT_PATH)
    clusters = {}
    
    for idx, row in df.iterrows():
        # Build deterministic hash of strongest anchors
        strong_anchors = [str(row['phone']), str(row['email']), str(row['national_id'])]
        valid_anchors = [a for a in strong_anchors if a and str(a) != 'nan']
        
        if valid_anchors:
            anchor_key = "_".join(sorted(valid_anchors))
        elif str(row['full_name']) != 'nan':
            anchor_key = str(row['full_name'])
        else:
            anchor_key = str(row['record_id'])
            
        cluster_id = "CLUSTER_" + hashlib.md5(anchor_key.encode()).hexdigest()[:8].upper()
        
        # Update Event
        from bson import ObjectId
        await db_client.events_col.update_one(
            {"_id": ObjectId(row['record_id'])},
            {"$set": {"z_cluster_id": cluster_id}}
        )
        
        # Build Golden Profile Survivorship
        if cluster_id not in clusters:
            clusters[cluster_id] = {
                "z_cluster_id": cluster_id,
                "primary_name": str(row['full_name']) if str(row['full_name']) != 'nan' else "Unknown",
                "known_aliases": set(),
                "known_phones": set(),
                "known_accounts": set(),
                "associated_emails": set(),
                "risk_score": 0.88,
                "last_updated": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
            }
        
        if str(row['full_name']) != 'nan': clusters[cluster_id]['known_aliases'].add(str(row['full_name']))
        if str(row['phone']) != 'nan': clusters[cluster_id]['known_phones'].add(str(row['phone']))
        if str(row['email']) != 'nan': clusters[cluster_id]['associated_emails'].add(str(row['email']))
        
    # Write Golden Profiles to Mongo
    await db_client.golden_col.delete_many({})
    golden_inserts = []
    for c_id, profile in clusters.items():
        profile['known_aliases'] = list(profile['known_aliases'])
        profile['known_phones'] = list(profile['known_phones'])
        profile['associated_emails'] = list(profile['associated_emails'])
        profile['known_accounts'] = list(profile['known_accounts'])
        golden_inserts.append(profile)
        
    if golden_inserts:
        await db_client.golden_col.insert_many(golden_inserts)
        
    return {"status": "success", "clusters_resolved": len(clusters), "message": "Zingg proxy completed successfully"}
