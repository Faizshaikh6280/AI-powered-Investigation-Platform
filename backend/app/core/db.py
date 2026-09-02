from motor.motor_asyncio import AsyncIOMotorClient
import pymongo
from app.core.config import settings

class MongoDB:
    client: AsyncIOMotorClient = None
    db = None
    events_col = None
    golden_col = None

db_client = MongoDB()

async def init_mongo():
    try:
        db_client.client = AsyncIOMotorClient(settings.MONGO_URI, serverSelectionTimeoutMS=5000)
        db_client.db = db_client.client[settings.MONGO_DB_NAME]
        db_client.events_col = db_client.db["normalized_events"]
        db_client.golden_col = db_client.db["golden_profiles"]

        # Create indexes
        await db_client.events_col.create_index([("telemetry.lat", pymongo.ASCENDING), ("telemetry.lng", pymongo.ASCENDING)])
        await db_client.events_col.create_index("z_cluster_id")
        await db_client.events_col.create_index("normalized_identity.phone")
        
        await db_client.golden_col.create_index("z_cluster_id", unique=True)
        
        print("[MongoDB] Async Connection Initialized & Indexes Verified")
    except Exception as e:
        print(f"[MongoDB] Connection Error: {e}")
