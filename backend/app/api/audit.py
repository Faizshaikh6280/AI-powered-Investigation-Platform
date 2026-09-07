"""
Audit Trail Inspection and Certified Export Router.
Allows compliance officers and auditors to query the tamper-evident audit store.
Any export action is itself recorded in the audit trail.
"""

import io
import csv
import json
import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.models.postgres_models import AuditLogModel
from app.models.iam_models import UserModel
from app.authorization.dependencies import require_permission, get_client_ip
from app.authorization.permissions import Permissions
from app.audit.audit_service import record_audit_event, AuditAction

router = APIRouter(prefix="/audit", tags=["Audit Trail"])

@router.get("/logs")
def list_audit_logs(
    case_id: Optional[str] = None,
    actor: Optional[str] = None,
    role: Optional[str] = None,
    action: Optional[str] = None,
    result: Optional[str] = None,
    resource_type: Optional[str] = None,
    unit_id: Optional[str] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: UserModel = Depends(require_permission(Permissions.AUDIT_VIEW)),
    db: Session = Depends(get_db)
):
    """
    Retrieves filtered tamper-evident audit records.
    Accessible to auditors, superintendents, and system administrators.
    """
    query = db.query(AuditLogModel)

    if case_id:
        query = query.filter(AuditLogModel.case_id == case_id)
    if actor:
        query = query.filter(AuditLogModel.actor.ilike(f"%{actor}%"))
    if role:
        query = query.filter(AuditLogModel.role == role)
    if action:
        query = query.filter(AuditLogModel.action == action)
    if result:
        query = query.filter(AuditLogModel.result == result.upper())
    if resource_type:
        query = query.filter(AuditLogModel.resource_type == resource_type)
    if unit_id:
        query = query.filter(AuditLogModel.unit_id == unit_id)
    if start_time:
        try:
            dt_start = datetime.datetime.fromisoformat(start_time.replace("Z", "+00:00"))
            query = query.filter(AuditLogModel.timestamp >= dt_start)
        except Exception:
            pass
    if end_time:
        try:
            dt_end = datetime.datetime.fromisoformat(end_time.replace("Z", "+00:00"))
            query = query.filter(AuditLogModel.timestamp <= dt_end)
        except Exception:
            pass
    if search:
        query = query.filter(
            (AuditLogModel.actor.ilike(f"%{search}%")) |
            (AuditLogModel.action.ilike(f"%{search}%")) |
            (AuditLogModel.case_id.ilike(f"%{search}%")) |
            (AuditLogModel.reason.ilike(f"%{search}%"))
        )

    total = query.count()
    logs = query.order_by(desc(AuditLogModel.timestamp)).offset(offset).limit(limit).all()

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "logs": [
            {
                "id": l.id,
                "audit_id": l.audit_id or f"AUD-{l.id}",
                "timestamp": l.timestamp.isoformat() if l.timestamp else None,
                "user_id": l.user_id,
                "actor": l.actor,
                "role": l.role,
                "organization_id": l.organization_id,
                "unit_id": l.unit_id,
                "case_id": l.case_id,
                "evidence_id": l.evidence_id,
                "action": l.action,
                "resource_type": l.resource_type,
                "resource_id": l.resource_id,
                "result": l.result or "SUCCESS",
                "reason": l.reason,
                "ip_address": l.ip_address,
                "user_agent": l.user_agent,
                "details": l.details or {},
                "request_id": l.request_id,
                "correlation_id": l.correlation_id
            }
            for l in logs
        ]
    }


@router.get("/logs/{audit_id}")
def get_audit_log_detail(
    audit_id: str,
    current_user: UserModel = Depends(require_permission(Permissions.AUDIT_VIEW)),
    db: Session = Depends(get_db)
):
    """Retrieves complete forensic detail for a single audit event."""
    log = (
        db.query(AuditLogModel)
        .filter((AuditLogModel.audit_id == audit_id) | (AuditLogModel.id.cast(db.bind.dialect.type_descriptor(db.query(AuditLogModel.id).type)) == audit_id))
        .first()
    )
    if not log:
        raise HTTPException(status_code=404, detail="Audit record not found.")

    return {
        "id": log.id,
        "audit_id": log.audit_id or f"AUD-{log.id}",
        "timestamp": log.timestamp.isoformat() if log.timestamp else None,
        "user_id": log.user_id,
        "actor": log.actor,
        "role": log.role,
        "organization_id": log.organization_id,
        "unit_id": log.unit_id,
        "case_id": log.case_id,
        "evidence_id": log.evidence_id,
        "action": log.action,
        "resource_type": log.resource_type,
        "resource_id": log.resource_id,
        "result": log.result or "SUCCESS",
        "reason": log.reason,
        "ip_address": log.ip_address,
        "user_agent": log.user_agent,
        "details": log.details or {},
        "request_id": log.request_id,
        "correlation_id": log.correlation_id
    }


@router.get("/export")
def export_audit_logs(
    request: Request,
    format: str = Query("csv", pattern="^(csv|json)$"),
    case_id: Optional[str] = None,
    action: Optional[str] = None,
    current_user: UserModel = Depends(require_permission(Permissions.AUDIT_EXPORT)),
    db: Session = Depends(get_db)
):
    """
    Exports audit records with cryptographic chain of custody references.
    This sensitive operation is strictly audited.
    """
    query = db.query(AuditLogModel)
    if case_id:
        query = query.filter(AuditLogModel.case_id == case_id)
    if action:
        query = query.filter(AuditLogModel.action == action)

    records = query.order_by(desc(AuditLogModel.timestamp)).limit(5000).all()

    # Record the export itself in the audit store
    record_audit_event(
        action=AuditAction.AUDIT_EXPORTED,
        result="SUCCESS",
        user_id=current_user.id,
        actor=current_user.official_email,
        role=current_user.role.name if current_user.role else None,
        case_id=case_id,
        details={"record_count": len(records), "format": format},
        ip_address=get_client_ip(request),
        db=db
    )

    if format == "json":
        return [
            {
                "audit_id": r.audit_id or f"AUD-{r.id}",
                "timestamp": r.timestamp.isoformat() if r.timestamp else None,
                "actor": r.actor,
                "role": r.role,
                "action": r.action,
                "case_id": r.case_id,
                "result": r.result,
                "reason": r.reason,
                "ip_address": r.ip_address,
                "request_id": r.request_id,
                "details": r.details or {}
            }
            for r in records
        ]

    # Return CSV
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Audit ID", "Timestamp (UTC)", "Actor", "Role", "Action",
        "Case ID", "Resource Type", "Resource ID", "Result", "Reason", "IP Address", "Request ID"
    ])
    for r in records:
        writer.writerow([
            r.audit_id or f"AUD-{r.id}",
            r.timestamp.isoformat() if r.timestamp else "",
            r.actor,
            r.role or "",
            r.action,
            r.case_id or "",
            r.resource_type or "",
            r.resource_id or "",
            r.result or "SUCCESS",
            r.reason or "",
            r.ip_address or "",
            r.request_id or ""
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=trace_certified_audit_trail.csv"}
    )
