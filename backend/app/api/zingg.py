from typing import Optional
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from app.services.zingg_er import run_entity_resolution
from app.core.database import get_db
from app.models.iam_models import UserModel
from app.authorization.dependencies import require_permission, get_client_ip
from app.authorization.permissions import Permissions
from app.audit.audit_service import record_audit_event, AuditAction

router = APIRouter()

@router.post("/execute")
def execute_entity_resolution(
    case_id: Optional[str] = None,
    request: Request = None,
    current_user: UserModel = Depends(require_permission(Permissions.ENTITY_RESOLVE)),
    db: Session = Depends(get_db)
):
    """
    Run full Entity Resolution pipeline on canonical events for case_id.
    """
    result = run_entity_resolution(case_id=case_id)

    record_audit_event(
        action=AuditAction.ENTITY_RESOLVED,
        result="SUCCESS",
        user_id=current_user.id,
        actor=current_user.official_email,
        role=current_user.role.name if current_user.role else None,
        case_id=case_id,
        details={"case_id": case_id},
        ip_address=get_client_ip(request) if request else None,
        db=db
    )

    return result

