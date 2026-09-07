import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # PostgreSQL Configuration
    DATABASE_URL: str = "postgresql://postgres:postgres123@localhost:5432/investigation_db"

    # MinIO / S3 Object Storage Configuration
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin123"
    MINIO_SECURE: bool = False
    MINIO_BUCKET_EVIDENCE: str = "raw-evidence"
    MINIO_BUCKET_WAREHOUSE: str = "iceberg-warehouse"

    # Encryption Configuration
    ENCRYPTION_MASTER_KEY: str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

    # Neo4j Graph Database
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USERNAME: str = "neo4j"
    NEO4J_PASSWORD: str = "password123"

    # Celery & Redis
    REDIS_URI: str = "redis://localhost:6379/0"
    ZINGG_URL: str = "http://localhost:8001"

    # Optional Mongo
    MONGO_URI: str = "mongodb://localhost:27017"
    MONGO_DB_NAME: str = "investigative_platform"

    # LLM Settings
    LLM_PROVIDER: str = "local"
    LLM_MODEL: str = "qwen2.5:7b-instruct"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    GOOGLE_API_KEY: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
