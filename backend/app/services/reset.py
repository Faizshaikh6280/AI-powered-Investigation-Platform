"""
Clear Neo4j graph and re-run full pipeline cleanly.
"""
from app.core.neo4j_client import neo4j_client
from app.core.db import db_client


async def clear_and_reset():
    # Clear Neo4j
    if neo4j_client.is_connected:
        with neo4j_client.driver.session() as session:
            session.run("MATCH (n) DETACH DELETE n")
    # Clear MongoDB collections
    await db_client.events_col.delete_many({})
    await db_client.golden_col.delete_many({})
    return {"status": "cleared"}
