"""
Migration API endpoints.
One-click migration from Google Workspace / Microsoft 365.
"""

from uuid import UUID
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from core.database import get_db
from core.security import get_current_user
from services.migration.oauth_service import oauth_service
from services.migration.orchestrator import MigrationOrchestrator, MigrationConfig
from core.config import settings


router = APIRouter(prefix="/migration", tags=["Migration"])


# ==================== REQUEST/RESPONSE MODELS ====================

class ConnectGoogleRequest(BaseModel):
    """Request to start Google OAuth"""
    redirect_uri: Optional[str] = None


class ConnectMicrosoftRequest(BaseModel):
    """Request to start Microsoft OAuth"""
    redirect_uri: Optional[str] = None


class ConnectIMAPRequest(BaseModel):
    """Request to connect via IMAP"""
    host: str
    port: int = 993
    username: str
    password: str
    use_ssl: bool = True


class StartMigrationRequest(BaseModel):
    """Request to start migration"""
    connection_id: UUID
    migrate_email: bool = True
    migrate_contacts: bool = True
    migrate_drive: bool = True
    email_folders: List[str] = []
    drive_folders: List[str] = []


class MigrationConnectionResponse(BaseModel):
    """Migration connection info"""
    id: UUID
    provider: str
    email: str
    name: Optional[str]
    created_at: str


class MigrationPreviewResponse(BaseModel):
    """Migration preview with counts"""
    email_count: int
    contact_count: int
    drive_file_count: int
    drive_size_bytes: int
    email_folders: List[str]


class MigrationJobResponse(BaseModel):
    """Migration job status"""
    id: UUID
    status: str
    progress_percent: int
    current_task: str

    email_status: str
    email_progress: int
    email_total: int
    email_processed: int

    contacts_status: str
    contacts_progress: int
    contacts_total: int
    contacts_processed: int

    drive_status: str
    drive_progress: int
    drive_total: int
    drive_processed: int
    bytes_transferred: int

    errors: List[dict]


# ==================== HELPER FUNCTIONS ====================

async def get_user_tenant_id(current_user: dict, db: AsyncSession) -> UUID:
    """Get tenant ID for current user"""
    user_id = current_user.get("user_id") or current_user.get("sub")

    result = await db.execute(
        text("""
            SELECT tenant_id FROM workspace.tenant_users
            WHERE user_id = CAST(:user_id AS uuid)
            LIMIT 1
        """),
        {"user_id": user_id}
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=400, detail="User not in any tenant")
    return row[0]


# ==================== OAUTH ENDPOINTS ====================

@router.post("/connect/google")
async def connect_google(
    request: ConnectGoogleRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get Google OAuth URL to connect account for migration.
    Returns URL for frontend to redirect user to Google consent screen.
    """
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=501,
            detail="Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."
        )

    tenant_id = await get_user_tenant_id(current_user, db)
    user_id = current_user.get("user_id") or current_user.get("sub")

    redirect_uri = request.redirect_uri or f"{settings.WORKSPACE_URL}/api/v1/migration/callback/google"

    auth_url = oauth_service.get_google_auth_url(
        tenant_id=str(tenant_id),
        user_id=user_id,
        redirect_uri=redirect_uri
    )

    return {"auth_url": auth_url}


@router.get("/callback/google")
async def google_callback(
    code: str,
    state: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Handle Google OAuth callback.
    Stores tokens and redirects to frontend.
    """
    # Validate state
    state_data = oauth_service.validate_state(state)
    if not state_data:
        raise HTTPException(status_code=400, detail="Invalid or expired state")

    tenant_id = state_data["tenant_id"]
    user_id = state_data["user_id"]

    # Exchange code for tokens
    redirect_uri = f"{settings.WORKSPACE_URL}/api/v1/migration/callback/google"
    tokens = await oauth_service.exchange_google_code(code, redirect_uri)

    # Get user info from Google
    from services.migration.providers.google_provider import GoogleMigrationProvider
    provider = GoogleMigrationProvider(tokens["access_token"])
    user_info = await provider.get_user_info()
    await provider.close()

    # Store connection
    await db.execute(
        text("""
            INSERT INTO workspace.migration_connections (
                tenant_id, user_id, provider, provider_email,
                access_token, refresh_token, token_expiry, scopes
            ) VALUES (
                CAST(:tenant_id AS uuid), CAST(:user_id AS uuid), 'google', :email,
                :access_token, :refresh_token, :token_expiry, :scopes
            )
            ON CONFLICT (tenant_id, provider, provider_email) DO UPDATE SET
                access_token = EXCLUDED.access_token,
                refresh_token = COALESCE(EXCLUDED.refresh_token, workspace.migration_connections.refresh_token),
                token_expiry = EXCLUDED.token_expiry,
                updated_at = NOW()
        """),
        {
            "tenant_id": tenant_id,
            "user_id": user_id,
            "email": user_info["email"],
            "access_token": oauth_service.encrypt_token(tokens["access_token"]),
            "refresh_token": oauth_service.encrypt_token(tokens["refresh_token"]) if tokens.get("refresh_token") else None,
            "token_expiry": None,  # Would calculate from expires_in
            "scopes": tokens.get("scope", []),
        }
    )
    await db.commit()

    # Redirect to frontend
    return RedirectResponse(
        url=f"{settings.WORKSPACE_URL}/admin/migration?connected=google&email={user_info['email']}"
    )


@router.post("/connect/microsoft")
async def connect_microsoft(
    request: ConnectMicrosoftRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get Microsoft OAuth URL to connect account for migration.
    """
    if not settings.MICROSOFT_CLIENT_ID:
        raise HTTPException(
            status_code=501,
            detail="Microsoft OAuth not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET."
        )

    tenant_id = await get_user_tenant_id(current_user, db)
    user_id = current_user.get("user_id") or current_user.get("sub")

    redirect_uri = request.redirect_uri or f"{settings.WORKSPACE_URL}/api/v1/migration/callback/microsoft"

    auth_url = oauth_service.get_microsoft_auth_url(
        tenant_id=str(tenant_id),
        user_id=user_id,
        redirect_uri=redirect_uri
    )

    return {"auth_url": auth_url}


@router.post("/connect/imap")
async def connect_imap(
    request: ConnectIMAPRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Connect via IMAP (for non-Google/Microsoft accounts)"""
    tenant_id = await get_user_tenant_id(current_user, db)
    user_id = current_user.get("user_id") or current_user.get("sub")

    # Test IMAP connection
    import imaplib
    try:
        if request.use_ssl:
            imap = imaplib.IMAP4_SSL(request.host, request.port)
        else:
            imap = imaplib.IMAP4(request.host, request.port)
        imap.login(request.username, request.password)
        imap.logout()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"IMAP connection failed: {str(e)}")

    # Store connection
    await db.execute(
        text("""
            INSERT INTO workspace.migration_connections (
                tenant_id, user_id, provider, provider_email,
                imap_host, imap_port, imap_username, imap_password, imap_use_ssl
            ) VALUES (
                CAST(:tenant_id AS uuid), CAST(:user_id AS uuid), 'imap', :email,
                :host, :port, :username, :password, :use_ssl
            )
            ON CONFLICT (tenant_id, provider, provider_email) DO UPDATE SET
                imap_host = EXCLUDED.imap_host,
                imap_port = EXCLUDED.imap_port,
                imap_password = EXCLUDED.imap_password,
                updated_at = NOW()
        """),
        {
            "tenant_id": str(tenant_id),
            "user_id": user_id,
            "email": request.username,
            "host": request.host,
            "port": request.port,
            "username": request.username,
            "password": oauth_service.encrypt_token(request.password),
            "use_ssl": request.use_ssl,
        }
    )
    await db.commit()

    return {"status": "connected", "email": request.username}


# ==================== CONNECTION MANAGEMENT ====================

@router.get("/connections", response_model=List[MigrationConnectionResponse])
async def list_connections(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List connected accounts for migration"""
    tenant_id = await get_user_tenant_id(current_user, db)

    result = await db.execute(
        text("""
            SELECT id, provider, provider_email, provider_name, created_at
            FROM workspace.migration_connections
            WHERE tenant_id = :tenant_id AND is_active = true
            ORDER BY created_at DESC
        """),
        {"tenant_id": str(tenant_id)}
    )

    connections = []
    for row in result.fetchall():
        connections.append(MigrationConnectionResponse(
            id=row.id,
            provider=row.provider,
            email=row.provider_email,
            name=row.provider_name,
            created_at=row.created_at.isoformat()
        ))

    return connections


@router.delete("/connections/{connection_id}")
async def delete_connection(
    connection_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Disconnect an account"""
    tenant_id = await get_user_tenant_id(current_user, db)

    await db.execute(
        text("""
            UPDATE workspace.migration_connections
            SET is_active = false, updated_at = NOW()
            WHERE id = :id AND tenant_id = :tenant_id
        """),
        {"id": str(connection_id), "tenant_id": str(tenant_id)}
    )
    await db.commit()

    return {"status": "disconnected"}


# ==================== MIGRATION PREVIEW ====================

@router.get("/preview/{connection_id}", response_model=MigrationPreviewResponse)
async def preview_migration(
    connection_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get migration preview with item counts"""
    orchestrator = MigrationOrchestrator(db)

    try:
        stats = await orchestrator.preview_migration(connection_id)

        return MigrationPreviewResponse(
            email_count=stats.email_count,
            contact_count=stats.contact_count,
            drive_file_count=stats.drive_file_count,
            drive_size_bytes=stats.drive_size_bytes,
            email_folders=stats.folders
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== MIGRATION EXECUTION ====================

@router.post("/start")
async def start_migration(
    request: StartMigrationRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Start one-click migration.
    Returns job ID for progress tracking.
    """
    tenant_id = await get_user_tenant_id(current_user, db)
    user_id = current_user.get("user_id") or current_user.get("sub")

    # Get user's Mailcow credentials for email import
    # Fetch from tenant_users table
    result = await db.execute(
        text("""
            SELECT u.email, tu.mail_password
            FROM workspace.tenant_users tu
            JOIN workspace.users u ON u.id = tu.user_id
            WHERE tu.user_id = CAST(:user_id AS uuid)
            LIMIT 1
        """),
        {"user_id": user_id}
    )
    user_row = result.fetchone()

    mailbox_email = user_row.email if user_row else current_user.get("email", "")
    mailbox_password = user_row.mail_password if user_row and user_row.mail_password else ""

    # Get Nextcloud credentials for drive import
    # In production, this would come from user provisioning
    nextcloud_user = mailbox_email.split("@")[0] if mailbox_email else ""
    nextcloud_password = mailbox_password  # Often same as mail password

    config = MigrationConfig(
        migrate_email=request.migrate_email,
        migrate_contacts=request.migrate_contacts,
        migrate_drive=request.migrate_drive,
        email_folders=request.email_folders,
        drive_folders=request.drive_folders,
    )

    orchestrator = MigrationOrchestrator(db)

    job_id = await orchestrator.start_migration(
        tenant_id=tenant_id,
        user_id=UUID(user_id),
        connection_id=request.connection_id,
        config=config,
        mailbox_email=mailbox_email,
        mailbox_password=mailbox_password,
        nextcloud_user=nextcloud_user,
        nextcloud_password=nextcloud_password
    )

    return {"job_id": job_id, "status": "started"}


@router.get("/jobs/{job_id}", response_model=MigrationJobResponse)
async def get_job_status(
    job_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get migration job progress (for polling)"""
    orchestrator = MigrationOrchestrator(db)

    # Try in-memory first (for real-time progress)
    progress = orchestrator.get_job_progress(job_id)

    if progress:
        return MigrationJobResponse(
            id=progress.job_id,
            status=progress.status,
            progress_percent=progress.progress_percent,
            current_task=progress.current_task,
            email_status=progress.email_status,
            email_progress=progress.email_progress,
            email_total=progress.email_total,
            email_processed=progress.email_processed,
            contacts_status=progress.contacts_status,
            contacts_progress=progress.contacts_progress,
            contacts_total=progress.contacts_total,
            contacts_processed=progress.contacts_processed,
            drive_status=progress.drive_status,
            drive_progress=progress.drive_progress,
            drive_total=progress.drive_total,
            drive_processed=progress.drive_processed,
            bytes_transferred=progress.bytes_transferred,
            errors=progress.errors
        )

    # Fall back to database
    result = await db.execute(
        text("SELECT * FROM workspace.migration_jobs WHERE id = :id"),
        {"id": str(job_id)}
    )
    row = result.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Job not found")

    return MigrationJobResponse(
        id=row.id,
        status=row.status,
        progress_percent=row.progress_percent,
        current_task=row.current_task or "",
        email_status=row.email_status,
        email_progress=row.email_progress,
        email_total=row.email_total,
        email_processed=row.email_processed,
        contacts_status=row.contacts_status,
        contacts_progress=row.contacts_progress,
        contacts_total=row.contacts_total,
        contacts_processed=row.contacts_processed,
        drive_status=row.drive_status,
        drive_progress=row.drive_progress,
        drive_total=row.drive_total,
        drive_processed=row.drive_processed,
        bytes_transferred=row.bytes_transferred,
        errors=row.errors or []
    )


@router.post("/jobs/{job_id}/cancel")
async def cancel_job(
    job_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Cancel a running migration job"""
    orchestrator = MigrationOrchestrator(db)

    cancelled = await orchestrator.cancel_job(job_id)

    if cancelled:
        return {"status": "cancelled"}
    else:
        raise HTTPException(status_code=400, detail="Job not found or not running")


@router.get("/jobs")
async def list_jobs(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List migration jobs for current tenant"""
    tenant_id = await get_user_tenant_id(current_user, db)

    result = await db.execute(
        text("""
            SELECT id, status, progress_percent, current_task, created_at, completed_at
            FROM workspace.migration_jobs
            WHERE tenant_id = :tenant_id
            ORDER BY created_at DESC
            LIMIT 20
        """),
        {"tenant_id": str(tenant_id)}
    )

    jobs = []
    for row in result.fetchall():
        jobs.append({
            "id": str(row.id),
            "status": row.status,
            "progress_percent": row.progress_percent,
            "current_task": row.current_task or "",
            "created_at": row.created_at.isoformat(),
            "completed_at": row.completed_at.isoformat() if row.completed_at else None
        })

    return {"jobs": jobs}
