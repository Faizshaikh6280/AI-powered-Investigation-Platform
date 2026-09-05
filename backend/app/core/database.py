import logging
from contextlib import contextmanager
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, scoped_session
from app.core.config import settings

logger = logging.getLogger("investigation.database")

# SQLAlchemy base for declarative ORM models
Base = declarative_base()

# Configure engine with connection pooling suitable for concurrent API & worker access
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    echo=False
)

SessionFactory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db_session = scoped_session(SessionFactory)

def get_db():
    """FastAPI dependency yielding an active SQLAlchemy session."""
    db = SessionFactory()
    try:
        yield db
    finally:
        db.close()

@contextmanager
def get_db_context():
    """Context manager for standalone scripts, workers, and background jobs."""
    db = SessionFactory()
    try:
        yield db
        db.commit()
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()

def init_postgres():
    """Idempotently initialize all PostgreSQL tables and auto-migrate missing columns."""
    try:
        # Import models so they are registered with Base.metadata
        import app.models.postgres_models  # noqa: F401
        Base.metadata.create_all(bind=engine)

        # Ensure all columns exist in anomaly_findings (in case table was created by older schema)
        from sqlalchemy import text
        migration_statements = [
            "ALTER TABLE anomaly_findings ADD COLUMN IF NOT EXISTS category VARCHAR(64) DEFAULT 'GENERAL';",
            "ALTER TABLE anomaly_findings ADD COLUMN IF NOT EXISTS pattern_type VARCHAR(64);",
            "ALTER TABLE anomaly_findings ADD COLUMN IF NOT EXISTS what_happened TEXT;",
            "ALTER TABLE anomaly_findings ADD COLUMN IF NOT EXISTS why_unusual TEXT;",
            "ALTER TABLE anomaly_findings ADD COLUMN IF NOT EXISTS why_relevant TEXT;",
            "ALTER TABLE anomaly_findings ADD COLUMN IF NOT EXISTS primary_entities JSON DEFAULT '[]'::json;",
            "ALTER TABLE anomaly_findings ADD COLUMN IF NOT EXISTS related_entities JSON DEFAULT '[]'::json;",
            "ALTER TABLE anomaly_findings ADD COLUMN IF NOT EXISTS time_range JSON DEFAULT '{}'::json;",
            "ALTER TABLE anomaly_findings ADD COLUMN IF NOT EXISTS locations JSON DEFAULT '[]'::json;",
            "ALTER TABLE anomaly_findings ADD COLUMN IF NOT EXISTS supporting_observations JSON DEFAULT '[]'::json;",
            "ALTER TABLE anomaly_findings ADD COLUMN IF NOT EXISTS supporting_signals JSON DEFAULT '[]'::json;",
            "ALTER TABLE anomaly_findings ADD COLUMN IF NOT EXISTS supporting_events JSON DEFAULT '[]'::json;",
            "ALTER TABLE anomaly_findings ADD COLUMN IF NOT EXISTS graph_context JSON DEFAULT '{}'::json;",
            "ALTER TABLE anomaly_findings ADD COLUMN IF NOT EXISTS timeline_context JSON DEFAULT '{}'::json;",
            "ALTER TABLE anomaly_findings ADD COLUMN IF NOT EXISTS spatial_context JSON DEFAULT '{}'::json;",
            "ALTER TABLE anomaly_findings ADD COLUMN IF NOT EXISTS detectors JSON DEFAULT '[]'::json;",
            "ALTER TABLE anomaly_findings ADD COLUMN IF NOT EXISTS detector_summary JSON DEFAULT '{}'::json;",
            "ALTER TABLE anomaly_findings ADD COLUMN IF NOT EXISTS evidence_quality VARCHAR(32) DEFAULT 'MEDIUM';",
            "ALTER TABLE anomaly_findings ADD COLUMN IF NOT EXISTS case_relevance VARCHAR(32) DEFAULT 'MEDIUM';",
            "ALTER TABLE anomaly_findings ADD COLUMN IF NOT EXISTS relevance_reasons JSON DEFAULT '[]'::json;",
            "ALTER TABLE anomaly_findings ADD COLUMN IF NOT EXISTS technical_details JSON DEFAULT '{}'::json;",
            "ALTER TABLE anomaly_findings ADD COLUMN IF NOT EXISTS provenance JSON DEFAULT '{}'::json;",
            "ALTER TABLE anomaly_findings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();"
        ]
        with engine.begin() as conn:
            for stmt in migration_statements:
                conn.execute(text(stmt))

        logger.info("[PostgreSQL] Tables verified and migrations executed successfully.")
    except Exception as e:
        logger.warning(f"[PostgreSQL] Warning during table initialization: {e}")
