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
    """Idempotently initialize all PostgreSQL tables."""
    try:
        # Import models so they are registered with Base.metadata
        import app.models.postgres_models  # noqa: F401
        Base.metadata.create_all(bind=engine)
        logger.info("[PostgreSQL] Tables verified and created successfully.")
    except Exception as e:
        logger.warning(f"[PostgreSQL] Warning during table initialization: {e}")
