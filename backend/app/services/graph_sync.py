from app.core.db import db_client
from app.core.neo4j_client import neo4j_client


async def sync_mongo_to_neo4j():
    if not neo4j_client.is_connected:
        return {"status": "error", "message": "Neo4j not connected"}

    with neo4j_client.driver.session() as session:
        # ── Create constraints (idempotent) ───────────────────────
        for cypher in [
            "CREATE CONSTRAINT IF NOT EXISTS FOR (p:Person) REQUIRE p.golden_id IS UNIQUE",
            "CREATE CONSTRAINT IF NOT EXISTS FOR (ph:Phone) REQUIRE ph.number IS UNIQUE",
            "CREATE CONSTRAINT IF NOT EXISTS FOR (b:BankAccount) REQUIRE b.account_number IS UNIQUE",
            "CREATE CONSTRAINT IF NOT EXISTS FOR (i:IPAddress) REQUIRE i.address IS UNIQUE",
            "CREATE CONSTRAINT IF NOT EXISTS FOR (d:IMEI) REQUIRE d.imei_number IS UNIQUE",
            "CREATE CONSTRAINT IF NOT EXISTS FOR (t:CellTower) REQUIRE t.tower_id IS UNIQUE",
            "CREATE CONSTRAINT IF NOT EXISTS FOR (s:SocialAccount) REQUIRE s.handle IS UNIQUE",
        ]:
            try:
                session.run(cypher)
            except Exception:
                pass

        # ── 1. Golden Person nodes (rich, denormalized) ───────────
        profiles = await db_client.golden_col.find({}).to_list(None)
        for p in profiles:
            cluster_id = p["z_cluster_id"]
            session.run("""
                MERGE (person:Person {golden_id: $cluster_id})
                SET person.name        = $primary_name,
                    person.risk_score  = $risk_score,
                    person.aliases     = $aliases,
                    person.phones      = $phones,
                    person.emails      = $emails,
                    person.addresses   = $addresses,
                    person.national_ids= $national_ids,
                    person.method      = $method,
                    person.last_updated= $last_updated
            """, {
                "cluster_id"  : cluster_id,
                "primary_name": p.get("primary_name", "Unknown"),
                "risk_score"  : p.get("risk_score", 0.0),
                "aliases"     : p.get("known_aliases", []),
                "phones"      : p.get("known_phones", []),
                "emails"      : p.get("associated_emails", []),
                "addresses"   : p.get("known_addresses", []),
                "national_ids": p.get("national_ids", []),
                "method"      : p.get("method", "deterministic"),
                "last_updated": p.get("last_updated", ""),
            })

            # ── Phone nodes ───────────────────────────────────────
            for phone in p.get("known_phones", []):
                if phone and phone.lower() not in ("nan", "none", ""):
                    session.run("""
                        MERGE (ph:Phone {number: $phone})
                        MERGE (p:Person {golden_id: $cluster_id})
                        MERGE (p)-[:OWNS_PHONE]->(ph)
                    """, {"cluster_id": cluster_id, "phone": phone})

            # ── Bank Account nodes ────────────────────────────────
            for acc in p.get("known_accounts", []):
                if acc and acc.lower() not in ("nan", "none", ""):
                    session.run("""
                        MERGE (ba:BankAccount {account_number: $acc})
                        SET ba.holder = $name
                        MERGE (p:Person {golden_id: $cluster_id})
                        MERGE (p)-[:OWNS_ACCOUNT]->(ba)
                    """, {"cluster_id": cluster_id, "acc": acc,
                          "name": p.get("primary_name")})

            # ── Social Account nodes ──────────────────────────────
            for sh in p.get("social_handles", []):
                handle   = sh.get("handle", "")
                platform = sh.get("platform", "")
                if handle:
                    session.run("""
                        MERGE (s:SocialAccount {handle: $handle})
                        SET s.platform = $platform
                        MERGE (p:Person {golden_id: $cluster_id})
                        MERGE (p)-[:USES_HANDLE]->(s)
                    """, {"cluster_id": cluster_id,
                          "handle": handle, "platform": platform})

        # ── 2. Telecom / Network telemetry (IMEI, Tower, IP) ─────
        events = await db_client.events_col.find({}).to_list(None)

        for ev in events:
            cluster_id = ev.get("z_cluster_id")

            telemetry = ev.get("telemetry", {})
            financial  = ev.get("financial", {})
            identity   = ev.get("normalized_identity", {})
            timestamp  = ev.get("timestamp", "")
            phone      = identity.get("phone")

            def empty(val):
                return not val or str(val).lower() in ("nan", "none", "")

            # IMEI → Phone
            imei = telemetry.get("imei")
            if not empty(imei) and not empty(phone):
                session.run("""
                    MERGE (ph:Phone {number: $phone})
                    MERGE (i:IMEI {imei_number: $imei})
                    MERGE (ph)-[r:USED_DEVICE]->(i)
                    SET r.last_seen = $timestamp
                """, {"phone": phone, "imei": str(imei), "timestamp": timestamp})

            # CellTower → Phone
            tower = telemetry.get("cell_tower_id")
            if not empty(tower) and not empty(phone):
                session.run("""
                    MERGE (t:CellTower {tower_id: $tower})
                    SET t.lat     = $lat,
                        t.lng     = $lng,
                        t.address = $address
                    MERGE (ph:Phone {number: $phone})
                    MERGE (ph)-[r:PINGED_TOWER]->(t)
                    SET r.last_seen = $timestamp,
                        r.duration  = $duration
                """, {
                    "tower"  : str(tower),
                    "lat"    : telemetry.get("lat"),
                    "lng"    : telemetry.get("lng"),
                    "address": telemetry.get("address", ""),
                    "phone"  : phone,
                    "timestamp": timestamp,
                    "duration": telemetry.get("duration_seconds", "")
                })

            # Logical IP Routing based on Domain
            ip = telemetry.get("assigned_ip")
            domain = ev.get("domain")
            
            if not empty(ip):
                session.run("MERGE (i:IPAddress {address: $ip})", {"ip": str(ip)})
                
                if domain == "NETWORK" and not empty(phone):
                    session.run("""
                        MERGE (i:IPAddress {address: $ip})
                        MERGE (ph:Phone {number: $phone})
                        MERGE (ph)-[r:ASSIGNED_IP]->(i)
                        SET r.last_seen = $timestamp
                    """, {"ip": str(ip), "phone": phone, "timestamp": timestamp})
                    
                elif domain == "SOCIAL" and not empty(identity.get("social_handle")):
                    handle = identity.get("social_handle")
                    platform = identity.get("social_platform", "")
                    session.run("""
                        MERGE (i:IPAddress {address: $ip})
                        MERGE (s:SocialAccount {handle: $handle})
                        SET s.platform = $platform
                        MERGE (s)-[r:LOGGED_IN_FROM]->(i)
                        SET r.last_seen = $timestamp
                    """, {"ip": str(ip), "handle": str(handle), "platform": platform, "timestamp": timestamp})
                    
                elif cluster_id:
                    # Fallback to person if domain is generic and person is known
                    session.run("""
                        MERGE (i:IPAddress {address: $ip})
                        MERGE (p:Person {golden_id: $cluster_id})
                        MERGE (p)-[r:LOGGED_IN_FROM]->(i)
                        SET r.last_seen = $timestamp
                    """, {"cluster_id": cluster_id, "ip": str(ip), "timestamp": timestamp})

            # Bank transaction counterparty link
            acc    = financial.get("account_number")
            cp_acc = financial.get("counterparty")
            if not empty(acc) and not empty(cp_acc):
                session.run("""
                    MERGE (ba:BankAccount {account_number: $acc})
                    MERGE (cp:BankAccount {account_number: $cp})
                    MERGE (ba)-[r:TRANSACTED_WITH]->(cp)
                    SET r.amount = $amount,
                        r.txn_type = $txn_type,
                        r.timestamp = $timestamp,
                        r.channel = $channel
                """, {
                    "acc": str(acc), 
                    "cp": str(cp_acc),
                    "amount": financial.get("amount", ""),
                    "txn_type": financial.get("txn_type", ""),
                    "timestamp": timestamp,
                    "channel": financial.get("channel", "")
                })

        
        # Trigger anomaly engine automatically after sync!
        from app.services.anomaly_engine import run_anomaly_detection
        try:
            # We use delay to let it run in the background (Celery)
            run_anomaly_detection.delay()
            print("Auto-triggered anomaly engine job.")
        except Exception as e:
            print("Failed to auto-trigger anomaly engine:", e)

    return {"status": "success", "message": "Graph sync and anomaly detection triggered successfully"}
