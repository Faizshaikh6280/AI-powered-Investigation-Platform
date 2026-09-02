import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # PostgreSQL Configuration
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql://postgres:postgres123@localhost:5432/investigation_db"
    )

    # MinIO / S3 Object Storage Configuration
    MINIO_ENDPOINT: str = os.getenv("MINIO_ENDPOINT", "localhost:9000")
    MINIO_ACCESS_KEY: str = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    MINIO_SECRET_KEY: str = os.getenv("MINIO_SECRET_KEY", "minioadmin123")
    MINIO_SECURE: bool = os.getenv("MINIO_SECURE", "false").lower() in ("true", "1", "yes")
    MINIO_BUCKET_EVIDENCE: str = os.getenv("MINIO_BUCKET_EVIDENCE", "raw-evidence")
    MINIO_BUCKET_WAREHOUSE: str = os.getenv("MINIO_BUCKET_WAREHOUSE", "iceberg-warehouse")

    # Encryption Configuration (Master Key for AES-256-GCM authenticated encryption)
    # Default 32-byte hex-encoded key for development; override in production via ENV
    ENCRYPTION_MASTER_KEY: str = os.getenv(
        "ENCRYPTION_MASTER_KEY",
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    )

    # Neo4j Graph Database
    NEO4J_URI: str = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    NEO4J_USERNAME: str = os.getenv("NEO4J_USERNAME", os.getenv("NEO4J_USER", "neo4j"))
    NEO4J_PASSWORD: str = os.getenv("NEO4J_PASSWORD", "password123")

    # Celery & Redis
    REDIS_URI: str = os.getenv("REDIS_URI", "redis://localhost:6379/0")
    ZINGG_URL: str = os.getenv("ZINGG_URL", "http://localhost:8001")

    # Optional Mongo settings retained for potential future external connectors
    MONGO_URI: str = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    MONGO_DB_NAME: str = os.getenv("MONGO_DB_NAME", "investigative_platform")

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
