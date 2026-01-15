"""
Bheem Workspace - Bulk User Import API
CSV upload with validation, preview, and background processing
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import csv
import io
import uuid
import re

from core.database import get_db
from core.security import get_current_user, require_tenant_admin
from services.passport_client import get_passport_client
from integrations.notify import notify_client
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/users", tags=["Admin - Bulk Import"])

# In-memory job storage (use Redis in production)
import_jobs: Dict[str, 'ImportJob'] = {}


class ImportJob:
    """Import job tracking"""
    def __init__(self, job_id: str, tenant_id: str, total_users: int, created_by: str):
        self.job_id = job_id
        self.tenant_id = tenant_id
        self.status = "pending"
        self.total_users = total_users
        self.processed = 0
        self.success_count = 0
        self.error_count = 0
        self.errors: List[Dict] = []
        self.created_by = created_by
        self.created_at = datetime.utcnow()
        self.started_at: Optional[datetime] = None
        self.completed_at: Optional[datetime] = None

    def to_dict(self) -> Dict:
        return {
            "job_id": self.job_id,
            "tenant_id": self.tenant_id,
            "status": self.status,
            "total_users": self.total_users,
            "processed": self.processed,
            "success_count": self.success_count,
            "error_count": self.error_count,
            "errors": self.errors[:50],  # Limit errors returned
            "progress_percent": int((self.processed / self.total_users) * 100) if self.total_users > 0 else 0,
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None
        }


class UserImportRow(BaseModel):
    """Validated user import row"""
    email: str
    first_name: str
    last_name: str
    department: Optional[str] = None
    job_title: Optional[str] = None
    role: str = "member"
    org_unit: Optional[str] = None
    phone: Optional[str] = None

    @validator('email')
    def validate_email(cls, v):
        email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_regex, v):
            raise ValueError(f'Invalid email format: {v}')
        return v.lower().strip()

    @validator('role')
    def validate_role(cls, v):
        valid_roles = ['admin', 'manager', 'member']
        if v.lower() not in valid_roles:
            raise ValueError(f'Role must be one of: {", ".join(valid_roles)}')
        return v.lower()

    @validator('first_name', 'last_name')
    def validate_name(cls, v):
        if not v or len(v.strip()) < 1:
            raise ValueError('Name cannot be empty')
        return v.strip()


class ImportPreviewResponse(BaseModel):
    """Preview response before import"""
    total_rows: int
    valid_rows: int
    invalid_rows: int
    preview: List[Dict]
    columns_detected: List[str]
    warnings: List[str]


class ImportJobResponse(BaseModel):
    """Import job status response"""
    job_id: str
    status: str
    total_users: int
    processed: int
    success_count: int
    error_count: int
    progress_percent: int
    errors: List[Dict]
    created_at: str
    completed_at: Optional[str]


@router.get("/import/template")
async def get_import_template(
    current_user: dict = Depends(require_tenant_admin())
):
    """
    Get CSV template for bulk user import.
    Download this template and fill with user data.
    """
    template_content = """email,first_name,last_name,department,job_title,role,org_unit,phone
john.doe@company.com,John,Doe,Engineering,Software Developer,member,/Engineering/Backend,+1234567890
jane.smith@company.com,Jane,Smith,Human Resources,HR Manager,manager,/HR,+1234567891
admin.user@company.com,Admin,User,IT,System Administrator,admin,/IT,+1234567892"""

    return {
        "template": template_content,
        "filename": "user_import_template.csv",
        "columns": [
            {"name": "email", "required": True, "description": "User's email address (must be unique)"},
            {"name": "first_name", "required": True, "description": "User's first name"},
            {"name": "last_name", "required": True, "description": "User's last name"},
            {"name": "department", "required": False, "description": "Department name"},
            {"name": "job_title", "required": False, "description": "Job title/position"},
            {"name": "role", "required": False, "description": "Workspace role: admin, manager, or member (default: member)"},
            {"name": "org_unit", "required": False, "description": "Organizational unit path (e.g., /Engineering/Backend)"},
            {"name": "phone", "required": False, "description": "Phone number"}
        ],
        "limits": {
            "max_users_per_import": 500,
            "max_file_size_mb": 5
        }
    }


@router.get("/import/template/download")
async def download_import_template(
    current_user: dict = Depends(require_tenant_admin())
):
    """Download CSV template file"""
    template_content = """email,first_name,last_name,department,job_title,role,org_unit,phone
john.doe@company.com,John,Doe,Engineering,Software Developer,member,/Engineering/Backend,+1234567890
jane.smith@company.com,Jane,Smith,Human Resources,HR Manager,manager,/HR,+1234567891
admin.user@company.com,Admin,User,IT,System Administrator,admin,/IT,+1234567892"""

    return StreamingResponse(
        io.BytesIO(template_content.encode('utf-8')),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=user_import_template.csv"}
    )


@router.post("/import/preview")
async def preview_import(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
):
    """
    Preview CSV file before importing.
    Validates all rows and returns preview with errors.
    """
    # Validate file type
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be CSV format (.csv)")

    # Read file content
    content = await file.read()

    # Check file size (5MB limit)
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 5MB")

    # Parse CSV
    try:
        csv_text = content.decode('utf-8-sig')  # Handle BOM
        reader = csv.DictReader(io.StringIO(csv_text))
        headers = [h.strip().lower() for h in (reader.fieldnames or [])]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")

    # Validate required columns
    required_columns = ['email', 'first_name', 'last_name']
    missing_columns = [col for col in required_columns if col not in headers]
    if missing_columns:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required columns: {', '.join(missing_columns)}"
        )

    # Get existing emails in tenant to check duplicates
    tenant_id = current_user.get("tenant_id")
    existing_result = await db.execute(text("""
        SELECT email FROM workspace.tenant_users
        WHERE tenant_id = CAST(:tenant_id AS uuid)
    """), {"tenant_id": tenant_id})
    existing_emails = {row.email.lower() for row in existing_result.fetchall()}

    # Parse and validate rows
    rows = list(csv.DictReader(io.StringIO(csv_text)))

    if len(rows) > 500:
        raise HTTPException(status_code=400, detail="Maximum 500 users per import. Please split into multiple files.")

    if len(rows) == 0:
        raise HTTPException(status_code=400, detail="CSV file is empty (no data rows)")

    preview = []
    valid_count = 0
    invalid_count = 0
    warnings = []
    seen_emails = set()

    for i, row in enumerate(rows[:100]):  # Preview first 100
        # Normalize keys
        normalized_row = {k.strip().lower(): v.strip() if v else '' for k, v in row.items()}

        row_data = {
            "row_number": i + 2,  # +2 for header and 0-index
            "email": normalized_row.get('email', ''),
            "first_name": normalized_row.get('first_name', ''),
            "last_name": normalized_row.get('last_name', ''),
            "department": normalized_row.get('department', ''),
            "job_title": normalized_row.get('job_title', ''),
            "role": normalized_row.get('role', 'member'),
            "org_unit": normalized_row.get('org_unit', ''),
            "valid": True,
            "errors": []
        }

        # Validate email
        email = row_data["email"].lower()
        if not email:
            row_data["valid"] = False
            row_data["errors"].append("Email is required")
        elif not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email):
            row_data["valid"] = False
            row_data["errors"].append("Invalid email format")
        elif email in existing_emails:
            row_data["valid"] = False
            row_data["errors"].append("Email already exists in workspace")
        elif email in seen_emails:
            row_data["valid"] = False
            row_data["errors"].append("Duplicate email in CSV")
        else:
            seen_emails.add(email)

        # Validate names
        if not row_data["first_name"]:
            row_data["valid"] = False
            row_data["errors"].append("First name is required")
        if not row_data["last_name"]:
            row_data["valid"] = False
            row_data["errors"].append("Last name is required")

        # Validate role
        if row_data["role"] and row_data["role"].lower() not in ['admin', 'manager', 'member']:
            row_data["valid"] = False
            row_data["errors"].append("Role must be admin, manager, or member")

        if row_data["valid"]:
            valid_count += 1
        else:
            invalid_count += 1

        preview.append(row_data)

    # Add warnings
    if len(rows) > 100:
        warnings.append(f"Showing first 100 of {len(rows)} rows")

    admin_count = sum(1 for r in preview if r.get("role", "").lower() == "admin")
    if admin_count > 5:
        warnings.append(f"Warning: {admin_count} users will be added as admins")

    return ImportPreviewResponse(
        total_rows=len(rows),
        valid_rows=valid_count,
        invalid_rows=invalid_count,
        preview=preview,
        columns_detected=headers,
        warnings=warnings
    )


@router.post("/import/csv")
async def import_users_csv(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    send_invites: bool = Query(True, description="Send invitation emails to new users"),
    skip_duplicates: bool = Query(True, description="Skip duplicate emails instead of failing"),
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
):
    """
    Bulk import users from CSV file.

    - Validates all rows before processing
    - Processes in background for large files
    - Returns job_id to track progress
    - Optionally sends invitation emails
    """
    tenant_id = current_user.get("tenant_id")
    user_id = current_user.get("id") or current_user.get("user_id")

    if not tenant_id:
        raise HTTPException(status_code=400, detail="User not associated with a workspace")

    # Validate file
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be CSV format")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum 5MB")

    # Parse CSV
    try:
        csv_text = content.decode('utf-8-sig')
        reader = csv.DictReader(io.StringIO(csv_text))
        rows = list(reader)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid CSV format: {str(e)}")

    if not rows:
        raise HTTPException(status_code=400, detail="CSV file is empty")

    if len(rows) > 500:
        raise HTTPException(status_code=400, detail="Maximum 500 users per import")

    # Validate required columns
    headers = [h.strip().lower() for h in (reader.fieldnames or [])]
    required_columns = ['email', 'first_name', 'last_name']
    missing = [col for col in required_columns if col not in headers]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required columns: {', '.join(missing)}")

    # Create job
    job_id = str(uuid.uuid4())
    job = ImportJob(
        job_id=job_id,
        tenant_id=tenant_id,
        total_users=len(rows),
        created_by=user_id
    )
    import_jobs[job_id] = job

    # Save job to database
    await db.execute(text("""
        INSERT INTO workspace.import_jobs (id, tenant_id, job_type, status, total_items, created_by, created_at)
        VALUES (CAST(:job_id AS uuid), CAST(:tenant_id AS uuid), 'users', 'pending', :total, CAST(:created_by AS uuid), NOW())
    """), {
        "job_id": job_id,
        "tenant_id": tenant_id,
        "total": len(rows),
        "created_by": user_id
    })
    await db.commit()

    # Process in background
    background_tasks.add_task(
        _process_import,
        job_id=job_id,
        rows=rows,
        tenant_id=tenant_id,
        send_invites=send_invites,
        skip_duplicates=skip_duplicates
    )

    logger.info(f"Started bulk import job {job_id} for tenant {tenant_id} with {len(rows)} users")

    return {
        "job_id": job_id,
        "status": "pending",
        "total_users": len(rows),
        "message": f"Import started. Processing {len(rows)} users in background.",
        "check_status_url": f"/api/v1/admin/users/import/{job_id}"
    }


async def _process_import(
    job_id: str,
    rows: List[Dict],
    tenant_id: str,
    send_invites: bool,
    skip_duplicates: bool
):
    """Background task to process bulk import"""
    from core.database import async_session_maker

    job = import_jobs.get(job_id)
    if not job:
        logger.error(f"Import job {job_id} not found")
        return

    job.status = "processing"
    job.started_at = datetime.utcnow()

    passport = get_passport_client()

    async with async_session_maker() as db:
        # Get existing emails
        existing_result = await db.execute(text("""
            SELECT email FROM workspace.tenant_users
            WHERE tenant_id = CAST(:tenant_id AS uuid)
        """), {"tenant_id": tenant_id})
        existing_emails = {row.email.lower() for row in existing_result.fetchall()}

        # Get tenant info for invite emails
        tenant_result = await db.execute(text("""
            SELECT name, slug FROM workspace.tenants WHERE id = CAST(:tenant_id AS uuid)
        """), {"tenant_id": tenant_id})
        tenant = tenant_result.fetchone()
        tenant_name = tenant.name if tenant else "Bheem Workspace"

        for i, row in enumerate(rows):
            try:
                # Normalize row
                normalized = {k.strip().lower(): v.strip() if v else '' for k, v in row.items()}

                email = normalized.get('email', '').lower()
                first_name = normalized.get('first_name', '')
                last_name = normalized.get('last_name', '')
                department = normalized.get('department') or None
                job_title = normalized.get('job_title') or None
                role = normalized.get('role', 'member').lower()
                org_unit = normalized.get('org_unit') or None
                phone = normalized.get('phone') or None

                # Validate
                if not email or not first_name or not last_name:
                    raise ValueError("Missing required fields: email, first_name, or last_name")

                if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email):
                    raise ValueError(f"Invalid email format: {email}")

                if role not in ['admin', 'manager', 'member']:
                    role = 'member'

                # Check duplicate
                if email in existing_emails:
                    if skip_duplicates:
                        job.errors.append({
                            "row": i + 2,
                            "email": email,
                            "error": "Skipped - email already exists",
                            "skipped": True
                        })
                        job.processed += 1
                        continue
                    else:
                        raise ValueError(f"Email already exists: {email}")

                # Create user in Passport
                try:
                    passport_user = await passport.register(
                        username=email,
                        password=None,  # Auto-generate, user will reset
                        role="Customer",
                        company_code="BHM001"
                    )
                    passport_user_id = passport_user.get("id")
                except Exception as pe:
                    # If passport fails, create local user ID
                    passport_user_id = str(uuid.uuid4())
                    logger.warning(f"Passport registration failed for {email}, using local ID: {pe}")

                # Add user to tenant
                user_id = str(uuid.uuid4())
                full_name = f"{first_name} {last_name}"

                await db.execute(text("""
                    INSERT INTO workspace.tenant_users
                    (id, tenant_id, user_id, email, name, role, department, job_title, phone, is_active, created_at)
                    VALUES (
                        CAST(:id AS uuid),
                        CAST(:tenant_id AS uuid),
                        CAST(:passport_user_id AS uuid),
                        :email,
                        :name,
                        :role,
                        :department,
                        :job_title,
                        :phone,
                        TRUE,
                        NOW()
                    )
                """), {
                    "id": user_id,
                    "tenant_id": tenant_id,
                    "passport_user_id": passport_user_id,
                    "email": email,
                    "name": full_name,
                    "role": role,
                    "department": department,
                    "job_title": job_title,
                    "phone": phone
                })

                existing_emails.add(email)

                # Send invite email
                if send_invites:
                    try:
                        await notify_client.send_workspace_invite(
                            to=email,
                            name=first_name,
                            workspace_name=tenant_name,
                            invite_url=f"https://workspace.bheem.cloud/invite?tenant={tenant_id}"
                        )
                    except Exception as ne:
                        logger.warning(f"Failed to send invite to {email}: {ne}")

                job.success_count += 1

            except Exception as e:
                job.error_count += 1
                job.errors.append({
                    "row": i + 2,
                    "email": row.get('email', 'unknown'),
                    "error": str(e)
                })
                logger.error(f"Import error row {i + 2}: {e}")

            job.processed += 1

            # Commit every 50 users
            if job.processed % 50 == 0:
                await db.commit()

        # Final commit
        await db.commit()

        # Update job in database
        await db.execute(text("""
            UPDATE workspace.import_jobs
            SET status = :status,
                processed_items = :processed,
                success_count = :success,
                error_count = :errors,
                completed_at = NOW()
            WHERE id = CAST(:job_id AS uuid)
        """), {
            "job_id": job_id,
            "status": "completed",
            "processed": job.processed,
            "success": job.success_count,
            "errors": job.error_count
        })
        await db.commit()

    job.status = "completed"
    job.completed_at = datetime.utcnow()
    logger.info(f"Import job {job_id} completed: {job.success_count} success, {job.error_count} errors")


@router.get("/import/{job_id}")
async def get_import_status(
    job_id: str,
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
):
    """Get status of an import job"""
    tenant_id = current_user.get("tenant_id")

    # Check in-memory first
    job = import_jobs.get(job_id)
    if job:
        if job.tenant_id != tenant_id:
            raise HTTPException(status_code=403, detail="Access denied")
        return job.to_dict()

    # Check database
    result = await db.execute(text("""
        SELECT id, status, total_items, processed_items, success_count, error_count,
               errors, created_at, started_at, completed_at
        FROM workspace.import_jobs
        WHERE id = CAST(:job_id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
    """), {"job_id": job_id, "tenant_id": tenant_id})

    db_job = result.fetchone()
    if not db_job:
        raise HTTPException(status_code=404, detail="Import job not found")

    return {
        "job_id": str(db_job.id),
        "status": db_job.status,
        "total_users": db_job.total_items,
        "processed": db_job.processed_items or 0,
        "success_count": db_job.success_count or 0,
        "error_count": db_job.error_count or 0,
        "progress_percent": int((db_job.processed_items / db_job.total_items) * 100) if db_job.total_items else 0,
        "errors": db_job.errors or [],
        "created_at": db_job.created_at.isoformat() if db_job.created_at else None,
        "completed_at": db_job.completed_at.isoformat() if db_job.completed_at else None
    }


@router.get("/import/jobs")
async def list_import_jobs(
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
):
    """List all import jobs for the tenant"""
    tenant_id = current_user.get("tenant_id")

    result = await db.execute(text("""
        SELECT id, status, total_items, processed_items, success_count, error_count,
               created_at, completed_at
        FROM workspace.import_jobs
        WHERE tenant_id = CAST(:tenant_id AS uuid) AND job_type = 'users'
        ORDER BY created_at DESC
        LIMIT :limit OFFSET :offset
    """), {"tenant_id": tenant_id, "limit": limit, "offset": offset})

    jobs = result.fetchall()

    return {
        "jobs": [
            {
                "job_id": str(j.id),
                "status": j.status,
                "total_users": j.total_items,
                "success_count": j.success_count or 0,
                "error_count": j.error_count or 0,
                "created_at": j.created_at.isoformat() if j.created_at else None,
                "completed_at": j.completed_at.isoformat() if j.completed_at else None
            }
            for j in jobs
        ],
        "count": len(jobs)
    }


@router.post("/export/csv")
async def export_users_csv(
    include_inactive: bool = Query(False),
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
):
    """Export all tenant users to CSV"""
    tenant_id = current_user.get("tenant_id")

    query = """
        SELECT email, name, role, department, job_title, phone, is_active, created_at
        FROM workspace.tenant_users
        WHERE tenant_id = CAST(:tenant_id AS uuid)
    """
    if not include_inactive:
        query += " AND is_active = TRUE"
    query += " ORDER BY name"

    result = await db.execute(text(query), {"tenant_id": tenant_id})
    users = result.fetchall()

    # Build CSV
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['email', 'first_name', 'last_name', 'role', 'department', 'job_title', 'phone', 'status', 'joined_at'])

    for user in users:
        name_parts = (user.name or '').split(' ', 1)
        first_name = name_parts[0] if name_parts else ''
        last_name = name_parts[1] if len(name_parts) > 1 else ''

        writer.writerow([
            user.email,
            first_name,
            last_name,
            user.role,
            user.department or '',
            user.job_title or '',
            user.phone or '',
            'active' if user.is_active else 'inactive',
            user.created_at.strftime('%Y-%m-%d') if user.created_at else ''
        ])

    csv_content = output.getvalue()
    filename = f"users_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"

    return {
        "csv_content": csv_content,
        "filename": filename,
        "total_users": len(users),
        "exported_at": datetime.utcnow().isoformat()
    }


@router.get("/export/csv/download")
async def download_users_csv(
    include_inactive: bool = Query(False),
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
):
    """Download users as CSV file"""
    result = await export_users_csv(include_inactive, current_user, db)

    return StreamingResponse(
        io.BytesIO(result["csv_content"].encode('utf-8')),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={result['filename']}"}
    )
