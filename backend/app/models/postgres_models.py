import datetime
from sqlalchemy import (
    Column, String, Integer, BigInteger, Float, DateTime, Text, JSON, ForeignKey, Index, Boolean
)
from sqlalchemy.orm import relationship
from app.core.database import Base

def utcnow():
    return datetime.datetime.now(datetime.timezone.utc)

class CaseModel(Base):
    """Investigation Case metadata registry."""
    __tablename__ = "cases"

    case_id = Column(String(64), primary_key=True, index=True)
    case_reference = Column(String(64), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)  # Written case context / investigator notes
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    created_by = Column(String(128), default="INVESTIGATOR_LEAD", nullable=False)
    status = Column(String(32), default="ACTIVE", index=True, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    # Relationships
    evidence_items = relationship("EvidenceModel", back_populates="case", cascade="all, delete-orphan")


class EvidenceModel(Base):
    """Raw evidence registration, checksums, and processing lifecycle metadata."""
    __tablename__ = "evidence"

    evidence_id = Column(String(64), primary_key=True, index=True)
    case_id = Column(String(64), ForeignKey("cases.case_id", ondelete="CASCADE"), nullable=False, index=True)
    original_filename = Column(String(255), nullable=False)
    mime_type = Column(String(128), nullable=True)
    file_size = Column(BigInteger, nullable=False)
    sha256 = Column(String(64), nullable=False, index=True)
    
    # Encryption parameters (algorithm, nonce, key reference) - never plaintext keys
    encryption_metadata = Column(JSON, nullable=True)
    storage_path = Column(String(512), nullable=False)  # S3/MinIO key (e.g. cases/CASE-001/evidence/EV-001/original/data.enc)
    
    received_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    received_by = Column(String(128), default="SYSTEM", nullable=False)
    
    # Observable Processing Status
    processing_status = Column(String(64), default="RECEIVED", index=True, nullable=False)
    
    # Source Detection Information
    detected_source_type = Column(String(32), default="UNKNOWN", index=True, nullable=True)
    detected_source_confidence = Column(Float, default=0.0, nullable=True)
    detector_version = Column(String(32), default="v1.0.0", nullable=True)
    parser_version = Column(String(32), default="v1.0.0", nullable=True)
    schema_version = Column(String(32), default="v1.0.0", nullable=True)
    
    # Pipeline Timings
    processing_started_at = Column(DateTime(timezone=True), nullable=True)
    processing_completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Ingestion & Quality Metrics
    record_count = Column(Integer, default=0)
    valid_record_count = Column(Integer, default=0)
    invalid_record_count = Column(Integer, default=0)
    duplicate_record_count = Column(Integer, default=0)
    quality_score = Column(Float, default=100.0)
    
    error_info = Column(Text, nullable=True)
    provenance_info = Column(JSON, nullable=True)

    # Relationships
    case = relationship("CaseModel", back_populates="evidence_items")
    quarantine_records = relationship("QuarantineRecordModel", back_populates="evidence", cascade="all, delete-orphan")


class QuarantineRecordModel(Base):
    """Preserves invalid/malformed records with explicit reasons for provenance."""
    __tablename__ = "quarantine_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    evidence_id = Column(String(64), ForeignKey("evidence.evidence_id", ondelete="CASCADE"), nullable=False, index=True)
    row_index = Column(Integer, nullable=False)
    reason = Column(String(255), nullable=False)
    raw_payload = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    evidence = relationship("EvidenceModel", back_populates="quarantine_records")


class DataQualityReportModel(Base):
    """Evidence and Case level data quality metrics and missing field summaries."""
    __tablename__ = "data_quality_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    evidence_id = Column(String(64), nullable=False, index=True)
    case_id = Column(String(64), nullable=False, index=True)
    total_records = Column(Integer, default=0)
    valid_records = Column(Integer, default=0)
    invalid_records = Column(Integer, default=0)
    duplicate_records = Column(Integer, default=0)
    missing_field_ratios = Column(JSON, nullable=True)
    quality_score = Column(Float, default=100.0)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class GoldenProfileModel(Base):
    """
    Resolved canonical entity profiles (PostgreSQL replacement for MongoDB golden_profiles).
    Stores deduplicated, synthesized real-world identities produced by Entity Resolution (Zingg/Union-Find).
    """
    __tablename__ = "golden_profiles"

    z_cluster_id = Column(String(64), primary_key=True, index=True)  # e.g., "CLUSTER_001"
    primary_name = Column(String(255), nullable=False, index=True)
    known_aliases = Column(JSON, default=list, nullable=False)       # List of alias strings
    known_phones = Column(JSON, default=list, nullable=False)        # E.164 phone numbers
    known_accounts = Column(JSON, default=list, nullable=False)      # Bank account numbers
    associated_emails = Column(JSON, default=list, nullable=False)   # Email addresses
    known_addresses = Column(JSON, default=list, nullable=False)     # Physical addresses
    national_ids = Column(JSON, default=list, nullable=False)        # Aadhar / Govt IDs
    social_handles = Column(JSON, default=list, nullable=False)      # Array of {handle, platform}
    risk_score = Column(Float, default=0.3, nullable=False)
    method = Column(String(64), default="zingg_docker", nullable=False)
    last_updated = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)


class AuditLogModel(Base):
    """Tamper-evident audit log for chain of custody and investigative actions."""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(String(64), nullable=True, index=True)
    evidence_id = Column(String(64), nullable=True, index=True)
    actor = Column(String(128), default="SYSTEM", nullable=False)
    action = Column(String(128), nullable=False, index=True)
    details = Column(JSON, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class AnomalyFindingModel(Base):
    """
    Unified multi-engine anomaly finding registry.
    Combines behavioral, statistical, deterministic rules, network topology,
    spatio-temporal, financial, social, and cross-domain anomaly findings.
    """
    __tablename__ = "anomaly_findings"

    finding_id = Column(String(64), primary_key=True, index=True)
    case_id = Column(String(64), ForeignKey("cases.case_id", ondelete="CASCADE"), nullable=False, index=True)
    entity_id = Column(String(128), nullable=False, index=True)
    entity_type = Column(String(64), nullable=False, index=True)
    fingerprint = Column(String(64), index=True, nullable=False)

    title = Column(String(255), nullable=False)
    severity = Column(String(32), default="MEDIUM", index=True, nullable=False)  # LOW, MEDIUM, HIGH, CRITICAL
    unified_score = Column(Float, default=0.0, index=True, nullable=False)
    confidence = Column(Float, default=1.0, nullable=False)
    investigative_priority = Column(String(32), default="MEDIUM", index=True, nullable=False)

    domain = Column(String(64), nullable=False, index=True)
    primary_detector_type = Column(String(64), nullable=False, index=True)
    contributing_detectors = Column(JSON, default=list, nullable=False)

    signals = Column(JSON, default=list, nullable=False)
    explanation = Column(Text, nullable=True)
    metrics = Column(JSON, default=dict, nullable=False)

    evidence_refs = Column(JSON, default=list, nullable=False)
    canonical_event_refs = Column(JSON, default=list, nullable=False)
    graph_refs = Column(JSON, default=list, nullable=False)
    model_metadata = Column(JSON, default=dict, nullable=False)

    status = Column(String(32), default="DETECTED", index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class AnomalyRunModel(Base):
    """Execution lifecycle and audit state for anomaly analysis runs."""
    __tablename__ = "anomaly_runs"

    run_id = Column(String(64), primary_key=True, index=True)
    case_id = Column(String(64), ForeignKey("cases.case_id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(32), default="QUEUED", index=True, nullable=False)  # QUEUED, RUNNING, COMPLETED, PARTIAL_FAILURE, FAILED
    current_stage = Column(String(64), default="QUEUED", nullable=False)
    started_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    detectors_executed = Column(JSON, default=list, nullable=False)
    detectors_failed = Column(JSON, default=list, nullable=False)
    total_findings = Column(Integer, default=0, nullable=False)
    summary_stats = Column(JSON, default=dict, nullable=False)
    error_message = Column(Text, nullable=True)


class DetectorRegistryModel(Base):
    """Metadata registry of all anomaly detectors and configuration profiles."""
    __tablename__ = "detector_registry"

    detector_id = Column(String(64), primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    version = Column(String(32), default="v1.0.0", nullable=False)
    detector_type = Column(String(64), nullable=False, index=True)
    domain = Column(String(64), nullable=False, index=True)
    enabled = Column(Boolean, default=True, nullable=False)
    description = Column(Text, nullable=True)
    config = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
