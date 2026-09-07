"""
FastAPI Security Dependencies for Authentication and Fine-Grained Authorization.
Enforces session validation, RBAC, case scoping, and audit logging for denied attempts.
"""

import os
from typing import Optional, List, Callable
from fastapi import Request, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.iam_models import UserModel, RoleModel
from app.auth.session import validate_session, SESSION_COOKIE_NAME
from app.authorization.policy import authorize, PolicyDecision
from app.audit.audit_service import record_audit_event, AuditAction

SERVICE_TOKEN = os.getenv("SERVICE_TOKEN", "trace_internal_service_key_2026")

def get_client_ip(request: Request) -> Optional[str]:
    """Resolves client IP from X-Forwarded-For or direct connection."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None

def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
) -> Optional[UserModel]:
    """
    Extracts and validates the current user identity from:
    1. HttpOnly cookie (SESSION_COOKIE_NAME)
    2. Authorization header ('Bearer <token>')
    3. X-Service-Token header (Internal automated worker key for system jobs)
    """
    # 1. Check HttpOnly cookie
    raw_token = request.cookies.get(SESSION_COOKIE_NAME)

    # 2. Check Authorization header
    if not raw_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            raw_token = auth_header[7:].strip()

    # 3. Check internal service token
    service_token_header = request.headers.get("X-Service-Token")
    if service_token_header and service_token_header == SERVICE_TOKEN:
        # Resolve or return system administrative user
        system_user = db.query(UserModel).filter_by(employee_id="EMP-SYSTEM").first()
        if not system_user:
            admin_role = db.query(RoleModel).filter_by(name="SYSTEM_ADMIN").first()
            if admin_role:
                system_user = db.query(UserModel).filter_by(role_id=admin_role.id).first()
        return system_user

    if not raw_token:
        return None

    return validate_session(db, raw_token)


def require_authenticated_user(
    request: Request,
    user: Optional[UserModel] = Depends(get_current_user)
) -> UserModel:
    """Enforces that the request comes from an authenticated, active user."""
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in to access this resource."
        )
    if user.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is {user.status.lower()}. Access denied."
        )
    return user


def require_permission(permission: str) -> Callable:
    """Dependency factory requiring a specific fine-grained permission."""
    def _dependency(
        request: Request,
        user: UserModel = Depends(require_authenticated_user),
        db: Session = Depends(get_db)
    ) -> UserModel:
        decision = authorize(user=user, action=permission, db=db)
        if not decision.allowed:
            record_audit_event(
                action=AuditAction.POLICY_DENIED,
                result="DENIED",
                user_id=user.id,
                actor=user.official_email,
                role=user.role.name if user.role else None,
                reason=decision.reason,
                ip_address=get_client_ip(request),
                user_agent=request.headers.get("User-Agent"),
                details={"required_permission": permission},
                request_id=request.headers.get("X-Request-ID"),
                correlation_id=request.headers.get("X-Correlation-ID"),
                db=db
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: Insufficient privileges for action '{permission}'."
            )
        return user
    return _dependency


def require_case_access(permission: str) -> Callable:
    """
    Dependency factory requiring both the action permission and access to the target case dossier.
    Resolves case_id from path parameters, query parameters, or payload hints.
    """
    def _dependency(
        request: Request,
        user: UserModel = Depends(require_authenticated_user),
        db: Session = Depends(get_db)
    ) -> UserModel:
        # Resolve case_id
        case_id = request.path_params.get("case_id") or request.query_params.get("case_id")
        
        decision = authorize(
            user=user,
            action=permission,
            case_id=case_id,
            db=db
        )

        if not decision.allowed:
            record_audit_event(
                action=AuditAction.ACCESS_DENIED,
                result="DENIED",
                user_id=user.id,
                actor=user.official_email,
                role=user.role.name if user.role else None,
                case_id=case_id,
                reason=decision.reason,
                ip_address=get_client_ip(request),
                user_agent=request.headers.get("User-Agent"),
                details={"permission": permission, "case_id": case_id},
                request_id=request.headers.get("X-Request-ID"),
                correlation_id=request.headers.get("X-Correlation-ID"),
                db=db
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You are not authorized to perform this action on this case dossier."
            )
        return user
    return _dependency
