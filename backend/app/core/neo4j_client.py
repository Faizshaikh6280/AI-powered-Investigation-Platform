from neo4j import GraphDatabase
from app.core.config import settings

class Neo4jClient:
    def __init__(self):
        self.driver = None
        self.is_connected = False
        try:
            self.driver = GraphDatabase.driver(settings.NEO4J_URI, auth=(settings.NEO4J_USERNAME, settings.NEO4J_PASSWORD), max_connection_lifetime=200, keep_alive=True)
            self.driver.verify_connectivity()
            self.is_connected = True
            print("[Neo4j] Connected to Cloud AuraDB")
            self.init_schema()
        except Exception as e:
            print(f"[Neo4j] Connection Failed: {e}")

    def init_schema(self):
        if not self.is_connected: return
        statements = [
            "CREATE CONSTRAINT person_cluster_id IF NOT EXISTS FOR (p:Person) REQUIRE p.golden_id IS UNIQUE",
            "CREATE CONSTRAINT phone_number_id IF NOT EXISTS FOR (ph:Phone) REQUIRE ph.number IS UNIQUE",
            "CREATE CONSTRAINT account_id IF NOT EXISTS FOR (b:BankAccount) REQUIRE b.account_number IS UNIQUE",
            "CREATE CONSTRAINT ip_address_id IF NOT EXISTS FOR (ip:IPAddress) REQUIRE ip.address IS UNIQUE",
            "CREATE CONSTRAINT imei_id IF NOT EXISTS FOR (i:IMEI) REQUIRE i.imei_number IS UNIQUE",
            "CREATE CONSTRAINT tower_id IF NOT EXISTS FOR (t:CellTower) REQUIRE t.tower_id IS UNIQUE"
        ]
        with self.driver.session() as session:
            for stmt in statements:
                try:
                    session.run(stmt)
                except Exception as e:
                    print(f"Constraint err: {e}")

neo4j_client = Neo4jClient()
