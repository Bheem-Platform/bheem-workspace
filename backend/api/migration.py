"""
Bheem Workspace - Data Migration API
Import data from Google Workspace, Outlook, and other sources.
"""
from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user, require_tenant_admin
from core.logging import get_logger
from services.migration_service import migration_service, MigrationJob

logger = get_logger("bheem.api.migration")

router = APIRouter(prefix="/migration", tags=["Data Migration"])


# Request/Response Models
class MigrationJobResponse(BaseModel):
    job_id: str
    tenant_id: str
    user_id: str
    source: str
    data_type: str
    status: str
    progress: int
    total_items: int
    processed_items: int
    errors: List[str] = []
    error_count: int = 0
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None


class CSVMappingRequest(BaseModel):
    """Column mapping for CSV imports."""
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    organization: Optional[str] = None
    job_title: Optional[str] = None


class ImportSupportedFormats(BaseModel):
    """Supported import formats."""
    google: Dict[str, List[str]] = {
        "email": ["mbox"],
        "calendar": ["ics"],
        "contacts": ["csv", "vcf"],
        "documents": ["zip"]
    }
    outlook: Dict[str, List[str]] = {
        "email": ["eml", "zip"],
        "calendar": ["ics"],
        "contacts": ["csv"]
    }
    generic: Dict[str, List[str]] = {
        "contacts": ["csv", "vcf"],
        "calendar": ["ics"]
    }


@router.get("/formats", response_model=ImportSupportedFormats)
async def get_supported_formats():
    """Get list of supported import formats."""
    return ImportSupportedFormats()


@router.get("/jobs", response_model=List[MigrationJobResponse])
async def list_migration_jobs(
    current_user: dict = Depends(get_current_user)
):
    """List all migration jobs for the current user."""
    user_id = current_user.get("user_id") or current_user.get("sub")
    jobs = migration_service.get_user_jobs(user_id)
    return [MigrationJobResponse(**job.to_dict()) for job in jobs]


@router.get("/jobs/{job_id}", response_model=MigrationJobResponse)
async def get_migration_job(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get status of a migration job."""
    job = migration_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Migration job not found")

    user_id = current_user.get("user_id") or current_user.get("sub")
    if job.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    return MigrationJobResponse(**job.to_dict())


@router.post("/import/google", response_model=MigrationJobResponse)
async def import_from_google(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    data_type: str = Form(..., description="Type of data: email, calendar, contacts, documents"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Import data from Google Takeout export.

    Upload a Google Takeout ZIP file or individual files:
    - **email**: Upload .mbox files or Takeout ZIP containing Mail folder
    - **calendar**: Upload .ics files or Takeout ZIP containing Calendar folder
    - **contacts**: Upload .csv or .vcf files or Takeout ZIP containing Contacts
    - **documents**: Upload Takeout ZIP containing Drive folder

    Returns a job ID to track import progress.
    """
    # Validate data_type
    valid_types = ["email", "calendar", "contacts", "documents"]
    if data_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid data_type. Must be one of: {', '.join(valid_types)}"
        )

    # Validate file size (max 500MB)
    max_size = 500 * 1024 * 1024
    content = await file.read()
    if len(content) > max_size:
        raise HTTPException(
            status_code=400,
            detail="File too large. Maximum size is 500MB"
        )

    user_id = current_user.get("user_id") or current_user.get("sub")
    tenant_id = current_user.get("tenant_id")

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="No workspace associated with user"
        )

    # Create migration job
    job = migration_service.create_job(
        tenant_id=tenant_id,
        user_id=user_id,
        source="google",
        data_type=data_type
    )

    # Run import in background
    background_tasks.add_task(
        migration_service.import_google_takeout,
        job,
        content,
        db
    )

    logger.info(f"Started Google import job {job.job_id} for user {user_id}")
    return MigrationJobResponse(**job.to_dict())


@router.post("/import/outlook", response_model=MigrationJobResponse)
async def import_from_outlook(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    data_type: str = Form(..., description="Type of data: email, calendar, contacts"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Import data from Outlook/Microsoft 365 export.

    Upload exported files:
    - **email**: Upload .eml files or ZIP containing emails
    - **calendar**: Upload .ics file exported from Outlook
    - **contacts**: Upload .csv file exported from Outlook

    Note: PST files are not directly supported. Please export to .eml or .csv format first.

    Returns a job ID to track import progress.
    """
    # Validate data_type
    valid_types = ["email", "calendar", "contacts"]
    if data_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid data_type. Must be one of: {', '.join(valid_types)}"
        )

    # Validate file size (max 500MB)
    max_size = 500 * 1024 * 1024
    content = await file.read()
    if len(content) > max_size:
        raise HTTPException(
            status_code=400,
            detail="File too large. Maximum size is 500MB"
        )

    user_id = current_user.get("user_id") or current_user.get("sub")
    tenant_id = current_user.get("tenant_id")

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="No workspace associated with user"
        )

    # Create migration job
    job = migration_service.create_job(
        tenant_id=tenant_id,
        user_id=user_id,
        source="outlook",
        data_type=data_type
    )

    # Run import in background
    background_tasks.add_task(
        migration_service.import_outlook_export,
        job,
        content,
        db
    )

    logger.info(f"Started Outlook import job {job.job_id} for user {user_id}")
    return MigrationJobResponse(**job.to_dict())


@router.post("/import/csv", response_model=MigrationJobResponse)
async def import_from_csv(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    data_type: str = Form("contacts", description="Type of data (currently only contacts supported)"),
    name_column: Optional[str] = Form(None, description="Column name for contact name"),
    email_column: Optional[str] = Form(None, description="Column name for email"),
    phone_column: Optional[str] = Form(None, description="Column name for phone"),
    organization_column: Optional[str] = Form(None, description="Column name for organization"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Import data from a generic CSV file with custom column mapping.

    Specify which columns in your CSV map to which fields.
    If not specified, the system will try to auto-detect common column names.
    """
    if data_type != "contacts":
        raise HTTPException(
            status_code=400,
            detail="CSV import currently only supports contacts"
        )

    # Validate file size (max 50MB for CSV)
    max_size = 50 * 1024 * 1024
    content = await file.read()
    if len(content) > max_size:
        raise HTTPException(
            status_code=400,
            detail="File too large. Maximum size is 50MB for CSV"
        )

    # Build column mapping
    mapping = {}
    if name_column:
        mapping["name"] = name_column
    if email_column:
        mapping["email"] = email_column
    if phone_column:
        mapping["phone"] = phone_column
    if organization_column:
        mapping["organization"] = organization_column

    # Auto-detect common columns if no mapping provided
    if not mapping:
        import csv
        import io
        csv_text = content.decode("utf-8")
        reader = csv.DictReader(io.StringIO(csv_text))
        headers = reader.fieldnames or []

        # Common column name mappings
        name_variations = ["name", "full name", "fullname", "display name", "contact name"]
        email_variations = ["email", "e-mail", "email address", "e-mail address", "mail"]
        phone_variations = ["phone", "telephone", "mobile", "cell", "phone number"]
        org_variations = ["organization", "organisation", "company", "employer"]

        for header in headers:
            h_lower = header.lower()
            if h_lower in name_variations:
                mapping["name"] = header
            elif h_lower in email_variations:
                mapping["email"] = header
            elif h_lower in phone_variations:
                mapping["phone"] = header
            elif h_lower in org_variations:
                mapping["organization"] = header

    user_id = current_user.get("user_id") or current_user.get("sub")
    tenant_id = current_user.get("tenant_id")

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="No workspace associated with user"
        )

    # Create migration job
    job = migration_service.create_job(
        tenant_id=tenant_id,
        user_id=user_id,
        source="csv",
        data_type=data_type
    )

    # Run import in background
    background_tasks.add_task(
        migration_service.import_csv,
        job,
        content,
        mapping,
        db
    )

    logger.info(f"Started CSV import job {job.job_id} for user {user_id}")
    return MigrationJobResponse(**job.to_dict())


@router.delete("/jobs/{job_id}")
async def cancel_migration_job(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Cancel a pending or running migration job."""
    job = migration_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Migration job not found")

    user_id = current_user.get("user_id") or current_user.get("sub")
    if job.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    if job.status in ["completed", "failed"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel job with status: {job.status}"
        )

    job.status = "cancelled"
    job.completed_at = datetime.utcnow()

    return {"message": "Migration job cancelled", "job_id": job_id}


@router.get("/preview/csv")
async def preview_csv(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Preview CSV file structure to help with column mapping.
    Returns first 5 rows and detected column names.
    """
    import csv
    import io

    content = await file.read()
    csv_text = content.decode("utf-8")

    reader = csv.DictReader(io.StringIO(csv_text))
    headers = reader.fieldnames or []

    # Get first 5 rows
    rows = []
    for i, row in enumerate(reader):
        if i >= 5:
            break
        rows.append(row)

    # Suggest mappings
    suggestions = {}
    name_variations = ["name", "full name", "fullname", "display name"]
    email_variations = ["email", "e-mail", "email address"]
    phone_variations = ["phone", "telephone", "mobile"]
    org_variations = ["organization", "organisation", "company"]

    for header in headers:
        h_lower = header.lower()
        if h_lower in name_variations:
            suggestions["name"] = header
        elif h_lower in email_variations:
            suggestions["email"] = header
        elif h_lower in phone_variations:
            suggestions["phone"] = header
        elif h_lower in org_variations:
            suggestions["organization"] = header

    return {
        "columns": headers,
        "preview_rows": rows,
        "suggested_mapping": suggestions,
        "total_columns": len(headers)
    }
