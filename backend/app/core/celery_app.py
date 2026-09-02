from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "investigative_platform",
    broker=settings.REDIS_URI,
    backend=settings.REDIS_URI,
    include=["app.services.anomaly_engine"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)
