"""
Enterprise-grade tamper-evident audit logging service.
Records all security, identity, case access, evidence, and analytical events.
"""

import uuid
import datetime
import logging
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from app.core.database import get_db_context
from app.models.postgres_models import AuditLogModel

logger = logging.getLogger("investigation.audit")

def utcnow():
    return datetime.datetime.now(datetime.timezone.utc)

class AuditAction:
    # Auth Actions
    LOGIN_SUCCESS = "LOGIN_SUCCESS"
    LOGIN_FAILURE = "LOGIN_FAILURE"
    MFA_SUCCESS = "MFA_SUCCESS"
    MFA_FAILURE = "MFA_FAILURE"
    LOGOUT = "LOGOUT"
    PASSWORD_CHANGE = "PASSWORD_CHANGE"
    PASSWORD_RESET_REQUEST = "PASSWORD_RESET_REQUEST"
    PASSWORD_RESET_CONFIRM = "PASSWORD_RESET_CONFIRM"
    SESSION_CREATED = "SESSION_CREATED"
    SESSION_REVOKED = "SESSION_REVOKED"

    # User Actions
    USER_INVITED = "USER_INVITED"
    USER_ACTIVATED = "USER_ACTIVATED"
    USER_UPDATED = "USER_UPDATED"
    USER_DISABLED = "USER_DISABLED"
    USER_ENABLED = "USER_ENABLED"
    ROLE_CHANGED = "ROLE_CHANGED"
    UNIT_CHANGED = "UNIT_CHANGED"

    # Case Actions
    CASE_CREATED = "CASE_CREATED"
    CASE_VIEWED = "CASE_VIEWED"
    CASE_UPDATED = "CASE_UPDATED"
    CASE_ASSIGNED = "CASE_ASSIGNED"
    CASE_CLOSED = "CASE_CLOSED"
    CASE_DELETED = "CASE_DELETED"
    CASE_ACCESS_REVOKED = "CASE_ACCESS_REVOKED"

    # Evidence Actions
    EVIDENCE_VIEWED = "EVIDENCE_VIEWED"
    EVIDENCE_UPLOADED = "EVIDENCE_UPLOADED"
    EVIDENCE_DOWNLOADED = "EVIDENCE_DOWNLOADED"
    EVIDENCE_EXPORTED = "EVIDENCE_EXPORTED"
    EVIDENCE_ACCESS_DENIED = "EVIDENCE_ACCESS_DENIED"
    INTEGRITY_VERIFIED = "INTEGRITY_VERIFIED"

    # Entity Resolution Actions
    ENTITY_VIEWED = "ENTITY_VIEWED"
    ENTITY_RESOLVED = "ENTITY_RESOLVED"
    ENTITY_MERGED = "ENTITY_MERGED"
    ENTITY_SPLIT = "ENTITY_SPLIT"

    # Findings Actions
    FINDING_CREATED = "FINDING_CREATED"
    FINDING_UPDATED = "FINDING_UPDATED"
    FINDING_APPROVED = "FINDING_APPROVED"
    FINDING_CLOSED = "FINDING_CLOSED"

    # Reports Actions
    REPORT_CREATED = "REPORT_CREATED"
    REPORT_VIEWED = "REPORT_VIEWED"
    REPORT_APPROVED = "REPORT_APPROVED"
    REPORT_EXPORTED = "REPORT_EXPORTED"

    # NFC Authentication Actions
    NFC_AUTH_INITIATED = "NFC_AUTH_INITIATED"
    NFC_AUTH_CARD_VALIDATED = "NFC_AUTH_CARD_VALIDATED"
    NFC_AUTH_FAILED = "NFC_AUTH_FAILED"
    NFC_PIN_FAILED = "NFC_PIN_FAILED"
    NFC_AUTH_SUCCESS = "NFC_AUTH_SUCCESS"
    NFC_CARD_ISSUED = "NFC_CARD_ISSUED"
    NFC_CARD_ACTIVATED = "NFC_CARD_ACTIVATED"
    NFC_CARD_REVOKED = "NFC_CARD_REVOKED"
    NFC_CARD_SUSPENDED = "NFC_CARD_SUSPENDED"
    NFC_CARD_REPLACED = "NFC_CARD_REPLACED"

    # NFC Evidence Acquisition Actions
    NFC_EVIDENCE_SCAN_STARTED = "NFC_EVIDENCE_SCAN_STARTED"
    NFC_EVIDENCE_CARD_DETECTED = "NFC_EVIDENCE_CARD_DETECTED"
    NFC_EVIDENCE_ACQUIRED = "NFC_EVIDENCE_ACQUIRED"
    NFC_EVIDENCE_HASHED = "NFC_EVIDENCE_HASHED"
    NFC_EVIDENCE_STORED = "NFC_EVIDENCE_STORED"
    NFC_EVIDENCE_PARSE_STARTED = "NFC_EVIDENCE_PARSE_STARTED"
    NFC_EVIDENCE_PARSE_COMPLETED = "NFC_EVIDENCE_PARSE_COMPLETED"
    NFC_ENTITY_MATCH = "NFC_ENTITY_MATCH"
    NFC_ENTITY_NO_MATCH = "NFC_ENTITY_NO_MATCH"
    NFC_ENTITY_AMBIGUOUS_MATCH = "NFC_ENTITY_AMBIGUOUS_MATCH"
    NFC_GRAPH_UPDATED = "NFC_GRAPH_UPDATED"
    NFC_CORRELATION_COMPLETED = "NFC_CORRELATION_COMPLETED"
    NFC_FINDING_CREATED = "NFC_FINDING_CREATED"
    NFC_EVIDENCE_ACCESS_DENIED = "NFC_EVIDENCE_ACCESS_DENIED"

    # Security & Policy Actions
    ACCESS_DENIED = "ACCESS_DENIED"
    POLICY_DENIED = "POLICY_DENIED"
    SUSPICIOUS_AUTH_EVENT = "SUSPICIOUS_AUTH_EVENT"
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"
    AUDIT_EXPORTED = "AUDIT_EXPORTED"


def sanitize_details(details: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Ensures sensitive credentials, plaintext passwords, or raw secrets are NEVER logged."""
    if not details:
        return {}
    sanitized = {}
    redacted_keys = {"password", "token", "secret", "raw_token", "hash", "code", "totp", "pin", "nfc", "credential"}
    for k, v in details.items():
        if any(r in k.lower() for r in redacted_keys):
            sanitized[k] = "[REDACTED]"
        elif isinstance(v, dict):
            sanitized[k] = sanitize_details(v)
        else:
            sanitized[k] = v
    return sanitized


def record_audit_event(
    action: str,
    result: str = "SUCCESS",  # SUCCESS, DENIED, FAILED
    user_id: Optional[str] = None,
    actor: str = "SYSTEM",
    role: Optional[str] = None,
    organization_id: Optional[str] = None,
    unit_id: Optional[str] = None,
    case_id: Optional[str] = None,
    evidence_id: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    reason: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    request_id: Optional[str] = None,
    correlation_id: Optional[str] = None,
    db: Optional[Session] = None
) -> str:
    """
    Appends a new audit record to the tamper-evident log store.
    Returns the generated audit_id.
    """
    audit_id = f"AUD-{uuid.uuid4().hex[:12].upper()}"
    clean_details = sanitize_details(details)

    def _persist(session: Session):
        entry = AuditLogModel(
            audit_id=audit_id,
            timestamp=utcnow(),
            user_id=user_id,
            actor=actor or "SYSTEM",
            role=role,
            organization_id=organization_id,
            unit_id=unit_id,
            case_id=case_id,
            evidence_id=evidence_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            result=result,
            reason=reason,
            ip_address=ip_address,
            user_agent=user_agent[:500] if user_agent else None,
            details=clean_details,
            request_id=request_id,
            correlation_id=correlation_id
        )
        session.add(entry)
        session.commit()

    try:
        if db:
            _persist(db)
        else:
            with get_db_context() as session:
                _persist(session)
    except Exception as e:
        logger.error(f"[Audit Log Failure] Could not persist audit log {action} for {actor}: {e}")

    return audit_id
