import logging
from app.core.neo4j_client import neo4j_client
from app.core.database import get_db_context
from app.models.postgres_models import GoldenProfileModel
from app.processing.canonical_reader import canonical_reader

logger = logging.getLogger("investigation.graph_sync")

async def sync_mongo_to_neo4j():
    """
    Synchronizes canonical events and resolved golden profiles into Neo4j property graph.
    Data source:
      - Golden Profiles from PostgreSQL golden_profiles table
      - Operational Telemetry & Transactions from MinIO Parquet Canonical Warehouse
    Completely zero MongoDB dependency.
    """
    if not neo4j_client.ensure_connected():
        return {"status": "error", "message": "Neo4j not connected"}

    with neo4j_client.driver.session() as session:
        # ── 1. Create Constraints (Idempotent) ───────────────────────
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

        # ── 2. Sync Golden Person Nodes from PostgreSQL ──────────────
        with get_db_context() as db:
            profiles = db.query(GoldenProfileModel).all()
            profile_dicts = [{
                "z_cluster_id": p.z_cluster_id,
                "primary_name": p.primary_name,
                "risk_score": p.risk_score,
                "known_aliases": p.known_aliases or [],
                "known_phones": p.known_phones or [],
                "associated_emails": p.associated_emails or [],
                "known_addresses": p.known_addresses or [],
                "national_ids": p.national_ids or [],
                "known_accounts": p.known_accounts or [],
                "social_handles": p.social_handles or [],
                "method": p.method,
                "last_updated": p.last_updated.isoformat() if p.last_updated else ""
            } for p in profiles]

        for p in profile_dicts:
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

            # Phone nodes and OWNS_PHONE relationships
            for phone in p.get("known_phones", []):
                if phone and str(phone).lower() not in ("nan", "none", ""):
                    session.run("""
                        MERGE (ph:Phone {number: $phone})
                        MERGE (p:Person {golden_id: $cluster_id})
                        MERGE (p)-[:OWNS_PHONE]->(ph)
                    """, {"cluster_id": cluster_id, "phone": str(phone).strip()})

            # Bank Account nodes and OWNS_ACCOUNT relationships
            for acc in p.get("known_accounts", []):
                if acc and str(acc).lower() not in ("nan", "none", ""):
                    session.run("""
                        MERGE (ba:BankAccount {account_number: $acc})
                        SET ba.holder = $name
                        MERGE (p:Person {golden_id: $cluster_id})
                        MERGE (p)-[:OWNS_ACCOUNT]->(ba)
                    """, {"cluster_id": cluster_id, "acc": str(acc).strip(), "name": p.get("primary_name")})

            # Social Account nodes and USES_HANDLE relationships
            for sh in p.get("social_handles", []):
                handle = sh.get("handle", "")
                platform = sh.get("platform", "")
                if handle:
                    session.run("""
                        MERGE (s:SocialAccount {handle: $handle})
                        SET s.platform = $platform
                        MERGE (p:Person {golden_id: $cluster_id})
                        MERGE (p)-[:USES_HANDLE]->(s)
                    """, {"cluster_id": cluster_id, "handle": str(handle).strip(), "platform": platform})

        # ── 3. Sync Operational Telemetry & Transactions from MinIO Parquet Warehouse ──
        events = canonical_reader.read_all_events()

        def is_empty(val):
            return not val or str(val).lower() in ("nan", "none", "")

        for ev in events:
            cluster_id = ev.get("z_cluster_id")
            telemetry = ev.get("telemetry", {})
            financial = ev.get("financial", {})
            identity = ev.get("normalized_identity") or ev.get("entities") or {}
            timestamp = ev.get("timestamp", "")
            phone = identity.get("phone")
            event_type = ev.get("event_type", "")
            attributes = ev.get("attributes") or {}

            # Call Detail Records (CALLED)
            called = attributes.get("called_number")
            if (event_type == "CALL" or called) and not is_empty(phone) and not is_empty(called):
                session.run("""
                    MERGE (p1:Phone {number: $phone})
                    MERGE (p2:Phone {number: $called})
                    MERGE (p1)-[r:CALLED]->(p2)
                    SET r.last_seen = $timestamp,
                        r.duration  = $duration,
                        r.call_id   = $call_id
                """, {
                    "phone": str(phone).strip(),
                    "called": str(called).strip(),
                    "timestamp": timestamp,
                    "duration": telemetry.get("duration_seconds", 0),
                    "call_id": attributes.get("call_id", "")
                })

            # IMEI → Phone (USED_DEVICE)
            imei = telemetry.get("imei")
            if not is_empty(imei) and not is_empty(phone):
                session.run("""
                    MERGE (ph:Phone {number: $phone})
                    MERGE (i:IMEI {imei_number: $imei})
                    MERGE (ph)-[r:USED_DEVICE]->(i)
                    SET r.last_seen = $timestamp
                """, {"phone": phone, "imei": str(imei), "timestamp": timestamp})

            # CellTower → Phone (PINGED_TOWER)
            tower = telemetry.get("cell_tower_id")
            if not is_empty(tower) and not is_empty(phone):
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
                    "tower": str(tower),
                    "lat": telemetry.get("lat"),
                    "lng": telemetry.get("lng"),
                    "address": telemetry.get("address", ""),
                    "phone": phone,
                    "timestamp": timestamp,
                    "duration": telemetry.get("duration_seconds", "")
                })

            # Logical IP Routing based on Domain
            ip = telemetry.get("assigned_ip")
            domain = ev.get("domain") or ev.get("source_type")

            if not is_empty(ip):
                session.run("MERGE (i:IPAddress {address: $ip})", {"ip": str(ip)})

                if domain == "NETWORK" and not is_empty(phone):
                    session.run("""
                        MERGE (i:IPAddress {address: $ip})
                        MERGE (ph:Phone {number: $phone})
                        MERGE (ph)-[r:ASSIGNED_IP]->(i)
                        SET r.last_seen = $timestamp
                    """, {"ip": str(ip), "phone": phone, "timestamp": timestamp})

                elif domain == "SOCIAL" and not is_empty(identity.get("social_handle")):
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
                    session.run("""
                        MERGE (i:IPAddress {address: $ip})
                        MERGE (p:Person {golden_id: $cluster_id})
                        MERGE (p)-[r:LOGGED_IN_FROM]->(i)
                        SET r.last_seen = $timestamp
                    """, {"cluster_id": cluster_id, "ip": str(ip), "timestamp": timestamp})

            # Financial Transactions between Bank Accounts (TRANSACTED_WITH)
            acc = financial.get("account_number")
            cp_acc = financial.get("counterparty")
            if not is_empty(acc) and not is_empty(cp_acc):
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
                    "amount": financial.get("amount_inr", 0.0),
                    "txn_type": financial.get("txn_type", "TRANSFER"),
                    "timestamp": timestamp,
                    "channel": financial.get("channel", "TRANSFER")
                })

        logger.info(f"[GraphSync] Synced {len(profile_dicts)} Golden Persons and {len(events)} events to Neo4j.")

        # Trigger Anomaly Detection automatically after sync
        from app.services.anomaly_engine import run_anomaly_detection
        try:
            run_anomaly_detection.delay()
            logger.info("Auto-triggered anomaly engine job via Celery.")
        except Exception as e:
            logger.warning(f"Celery queueing unavailable ({e}), running anomaly engine directly...")
            try:
                run_anomaly_detection()
            except Exception as ex:
                logger.error(f"Failed to run anomaly engine directly: {ex}")

    return {"status": "success", "message": "Graph sync and anomaly detection triggered successfully"}
