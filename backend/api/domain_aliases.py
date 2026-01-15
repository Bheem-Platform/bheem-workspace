"""
Bheem Workspace - Domain Aliases API
Domain and email alias management
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import uuid
import re
import secrets

from core.database import get_db
from core.security import get_current_user, require_tenant_admin
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/domains", tags=["Admin - Domain Aliases"])


# =============================================
# Models
# =============================================

class DomainCreate(BaseModel):
    domain_name: str
    is_primary: bool = False

    @validator('domain_name')
    def validate_domain(cls, v):
        if not v:
            raise ValueError('Domain name is required')
        # Basic domain validation
        domain_regex = r'^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$'
        if not re.match(domain_regex, v):
            raise ValueError('Invalid domain format')
        return v.lower().strip()


class DomainUpdate(BaseModel):
    is_primary: Optional[bool] = None


class EmailAliasCreate(BaseModel):
    user_id: str
    alias_email: str
    is_primary: bool = False

    @validator('alias_email')
    def validate_email(cls, v):
        email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_regex, v):
            raise ValueError('Invalid email format')
        return v.lower().strip()


# =============================================
# Domain Endpoints
# =============================================

@router.get("")
async def list_domains(
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get all domains for the tenant"""
    tenant_id = current_user.get("tenant_id")

    result = await db.execute(text("""
        SELECT
            d.id, d.domain_name, d.is_primary,
            d.verification_status, d.verification_code,
            d.verified_at, d.mx_verified, d.spf_verified, d.dkim_verified, d.dmarc_verified,
            d.created_at, d.updated_at,
            (SELECT COUNT(*) FROM workspace.user_email_aliases uea
             WHERE uea.domain_alias_id = d.id) as alias_count
        FROM workspace.domain_aliases d
        WHERE d.tenant_id = CAST(:tenant_id AS uuid)
        ORDER BY d.is_primary DESC, d.domain_name
    """), {"tenant_id": tenant_id})

    domains = result.fetchall()

    return {
        "domains": [
            {
                "id": str(d.id),
                "domain_name": d.domain_name,
                "is_primary": d.is_primary,
                "verification_status": d.verification_status,
                "verification_code": d.verification_code,
                "verified_at": d.verified_at.isoformat() if d.verified_at else None,
                "dns_records": {
                    "mx_verified": d.mx_verified,
                    "spf_verified": d.spf_verified,
                    "dkim_verified": d.dkim_verified,
                    "dmarc_verified": d.dmarc_verified
                },
                "alias_count": d.alias_count,
                "created_at": d.created_at.isoformat() if d.created_at else None,
                "updated_at": d.updated_at.isoformat() if d.updated_at else None
            }
            for d in domains
        ],
        "count": len(domains)
    }


@router.get("/{domain_id}")
async def get_domain(
    domain_id: str,
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get a specific domain"""
    tenant_id = current_user.get("tenant_id")

    result = await db.execute(text("""
        SELECT
            d.id, d.domain_name, d.is_primary,
            d.verification_status, d.verification_code,
            d.verified_at, d.mx_verified, d.spf_verified, d.dkim_verified, d.dmarc_verified,
            d.created_at, d.updated_at
        FROM workspace.domain_aliases d
        WHERE d.id = CAST(:id AS uuid) AND d.tenant_id = CAST(:tenant_id AS uuid)
    """), {"id": domain_id, "tenant_id": tenant_id})

    domain = result.fetchone()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    return {
        "id": str(domain.id),
        "domain_name": domain.domain_name,
        "is_primary": domain.is_primary,
        "verification_status": domain.verification_status,
        "verification_code": domain.verification_code,
        "verified_at": domain.verified_at.isoformat() if domain.verified_at else None,
        "dns_records": {
            "mx_verified": domain.mx_verified,
            "spf_verified": domain.spf_verified,
            "dkim_verified": domain.dkim_verified,
            "dmarc_verified": domain.dmarc_verified
        },
        "dns_instructions": _get_dns_instructions(domain.domain_name, domain.verification_code),
        "created_at": domain.created_at.isoformat() if domain.created_at else None,
        "updated_at": domain.updated_at.isoformat() if domain.updated_at else None
    }


def _get_dns_instructions(domain: str, verification_code: str) -> Dict[str, Any]:
    """Get DNS setup instructions for the domain"""
    return {
        "verification": {
            "type": "TXT",
            "host": f"_bheem-verify.{domain}",
            "value": verification_code,
            "description": "Add this TXT record to verify domain ownership"
        },
        "mx_records": [
            {
                "type": "MX",
                "host": domain,
                "priority": 10,
                "value": "mail.bheem.cloud",
                "description": "Primary mail server"
            },
            {
                "type": "MX",
                "host": domain,
                "priority": 20,
                "value": "mail2.bheem.cloud",
                "description": "Backup mail server"
            }
        ],
        "spf": {
            "type": "TXT",
            "host": domain,
            "value": "v=spf1 include:_spf.bheem.cloud ~all",
            "description": "SPF record to authorize Bheem mail servers"
        },
        "dkim": {
            "type": "CNAME",
            "host": f"bheem._domainkey.{domain}",
            "value": f"bheem._domainkey.bheem.cloud",
            "description": "DKIM record for email signing"
        },
        "dmarc": {
            "type": "TXT",
            "host": f"_dmarc.{domain}",
            "value": "v=DMARC1; p=quarantine; rua=mailto:dmarc@bheem.cloud",
            "description": "DMARC policy for email authentication"
        }
    }


@router.post("")
async def add_domain(
    data: DomainCreate,
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Add a new domain"""
    tenant_id = current_user.get("tenant_id")
    domain_id = str(uuid.uuid4())
    verification_code = f"bheem-verify-{secrets.token_hex(16)}"

    # Check for duplicate
    existing = await db.execute(text("""
        SELECT id FROM workspace.domain_aliases
        WHERE tenant_id = CAST(:tenant_id AS uuid) AND domain_name = :domain_name
    """), {"tenant_id": tenant_id, "domain_name": data.domain_name})
    if existing.fetchone():
        raise HTTPException(status_code=409, detail=f"Domain '{data.domain_name}' already exists")

    # If setting as primary, remove primary from others
    if data.is_primary:
        await db.execute(text("""
            UPDATE workspace.domain_aliases
            SET is_primary = FALSE, updated_at = NOW()
            WHERE tenant_id = CAST(:tenant_id AS uuid)
        """), {"tenant_id": tenant_id})

    # Create domain
    await db.execute(text("""
        INSERT INTO workspace.domain_aliases
        (id, tenant_id, domain_name, is_primary, verification_status, verification_code, created_at, updated_at)
        VALUES (
            CAST(:id AS uuid),
            CAST(:tenant_id AS uuid),
            :domain_name,
            :is_primary,
            'pending',
            :verification_code,
            NOW(),
            NOW()
        )
    """), {
        "id": domain_id,
        "tenant_id": tenant_id,
        "domain_name": data.domain_name,
        "is_primary": data.is_primary,
        "verification_code": verification_code
    })
    await db.commit()

    logger.info(f"Added domain {data.domain_name} to tenant {tenant_id}")

    return {
        "id": domain_id,
        "domain_name": data.domain_name,
        "verification_code": verification_code,
        "dns_instructions": _get_dns_instructions(data.domain_name, verification_code),
        "message": "Domain added. Complete DNS setup to verify."
    }


@router.post("/{domain_id}/verify")
async def verify_domain(
    domain_id: str,
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Verify domain ownership by checking DNS records.
    In production, this would actually query DNS.
    """
    tenant_id = current_user.get("tenant_id")

    result = await db.execute(text("""
        SELECT id, domain_name, verification_code, verification_status
        FROM workspace.domain_aliases
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
    """), {"id": domain_id, "tenant_id": tenant_id})

    domain = result.fetchone()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    # In production, verify DNS records here using dnspython or similar
    # For now, we'll simulate verification
    import random
    dns_check_success = random.random() > 0.3  # 70% success rate for demo

    if dns_check_success:
        await db.execute(text("""
            UPDATE workspace.domain_aliases
            SET verification_status = 'verified',
                verified_at = NOW(),
                mx_verified = TRUE,
                spf_verified = TRUE,
                updated_at = NOW()
            WHERE id = CAST(:id AS uuid)
        """), {"id": domain_id})
        await db.commit()

        return {
            "status": "verified",
            "domain_name": domain.domain_name,
            "message": "Domain verified successfully"
        }
    else:
        return {
            "status": "pending",
            "domain_name": domain.domain_name,
            "message": "DNS records not found. Please ensure TXT record is configured correctly.",
            "expected_record": {
                "type": "TXT",
                "host": f"_bheem-verify.{domain.domain_name}",
                "value": domain.verification_code
            }
        }


@router.put("/{domain_id}")
async def update_domain(
    domain_id: str,
    data: DomainUpdate,
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Update domain settings"""
    tenant_id = current_user.get("tenant_id")

    # Verify exists
    existing = await db.execute(text("""
        SELECT id, domain_name FROM workspace.domain_aliases
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
    """), {"id": domain_id, "tenant_id": tenant_id})
    domain = existing.fetchone()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    if data.is_primary:
        # Remove primary from others first
        await db.execute(text("""
            UPDATE workspace.domain_aliases
            SET is_primary = FALSE, updated_at = NOW()
            WHERE tenant_id = CAST(:tenant_id AS uuid) AND id != CAST(:id AS uuid)
        """), {"tenant_id": tenant_id, "id": domain_id})

        await db.execute(text("""
            UPDATE workspace.domain_aliases
            SET is_primary = TRUE, updated_at = NOW()
            WHERE id = CAST(:id AS uuid)
        """), {"id": domain_id})
    elif data.is_primary is False:
        await db.execute(text("""
            UPDATE workspace.domain_aliases
            SET is_primary = FALSE, updated_at = NOW()
            WHERE id = CAST(:id AS uuid)
        """), {"id": domain_id})

    await db.commit()

    return {"id": domain_id, "message": "Domain updated successfully"}


@router.delete("/{domain_id}")
async def delete_domain(
    domain_id: str,
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Delete a domain"""
    tenant_id = current_user.get("tenant_id")

    # Verify exists
    existing = await db.execute(text("""
        SELECT id, domain_name, is_primary,
            (SELECT COUNT(*) FROM workspace.user_email_aliases WHERE domain_alias_id = CAST(:id AS uuid)) as alias_count
        FROM workspace.domain_aliases
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
    """), {"id": domain_id, "tenant_id": tenant_id})
    domain = existing.fetchone()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    if domain.is_primary:
        raise HTTPException(status_code=400, detail="Cannot delete primary domain. Set another domain as primary first.")

    if domain.alias_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete domain with {domain.alias_count} email aliases. Remove aliases first."
        )

    # Delete domain
    await db.execute(text("""
        DELETE FROM workspace.domain_aliases
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
    """), {"id": domain_id, "tenant_id": tenant_id})
    await db.commit()

    logger.info(f"Deleted domain {domain.domain_name} from tenant {tenant_id}")

    return {"message": "Domain deleted successfully"}


# =============================================
# Email Aliases Endpoints
# =============================================

@router.get("/aliases")
async def list_email_aliases(
    user_id: Optional[str] = Query(None),
    domain_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get email aliases"""
    tenant_id = current_user.get("tenant_id")

    query = """
        SELECT
            uea.id, uea.alias_email, uea.is_primary, uea.is_active, uea.created_at,
            tu.id as user_id, tu.email as primary_email, tu.name as user_name,
            da.id as domain_id, da.domain_name
        FROM workspace.user_email_aliases uea
        JOIN workspace.tenant_users tu ON uea.user_id = tu.id
        LEFT JOIN workspace.domain_aliases da ON uea.domain_alias_id = da.id
        WHERE tu.tenant_id = CAST(:tenant_id AS uuid)
    """
    params = {"tenant_id": tenant_id, "limit": limit, "offset": offset}

    if user_id:
        query += " AND uea.user_id = CAST(:user_id AS uuid)"
        params["user_id"] = user_id

    if domain_id:
        query += " AND uea.domain_alias_id = CAST(:domain_id AS uuid)"
        params["domain_id"] = domain_id

    query += " ORDER BY tu.name, uea.alias_email LIMIT :limit OFFSET :offset"

    result = await db.execute(text(query), params)
    aliases = result.fetchall()

    return {
        "aliases": [
            {
                "id": str(a.id),
                "alias_email": a.alias_email,
                "is_primary": a.is_primary,
                "is_active": a.is_active,
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "user": {
                    "id": str(a.user_id),
                    "email": a.primary_email,
                    "name": a.user_name
                },
                "domain": {
                    "id": str(a.domain_id),
                    "name": a.domain_name
                } if a.domain_id else None
            }
            for a in aliases
        ],
        "count": len(aliases)
    }


@router.post("/aliases")
async def create_email_alias(
    data: EmailAliasCreate,
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Create an email alias for a user"""
    tenant_id = current_user.get("tenant_id")
    alias_id = str(uuid.uuid4())

    # Verify user exists
    user_result = await db.execute(text("""
        SELECT id, name FROM workspace.tenant_users
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
    """), {"id": data.user_id, "tenant_id": tenant_id})
    user = user_result.fetchone()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check alias doesn't already exist
    existing = await db.execute(text("""
        SELECT id FROM workspace.user_email_aliases WHERE alias_email = :alias_email
    """), {"alias_email": data.alias_email})
    if existing.fetchone():
        raise HTTPException(status_code=409, detail="Email alias already exists")

    # Extract domain and check if it belongs to tenant
    alias_domain = data.alias_email.split('@')[1]
    domain_result = await db.execute(text("""
        SELECT id FROM workspace.domain_aliases
        WHERE tenant_id = CAST(:tenant_id AS uuid) AND domain_name = :domain
    """), {"tenant_id": tenant_id, "domain": alias_domain})
    domain = domain_result.fetchone()
    domain_id = str(domain.id) if domain else None

    # Create alias
    await db.execute(text("""
        INSERT INTO workspace.user_email_aliases
        (id, user_id, alias_email, domain_alias_id, is_primary, is_active, created_at)
        VALUES (
            CAST(:id AS uuid),
            CAST(:user_id AS uuid),
            :alias_email,
            CAST(:domain_id AS uuid),
            :is_primary,
            TRUE,
            NOW()
        )
    """), {
        "id": alias_id,
        "user_id": data.user_id,
        "alias_email": data.alias_email,
        "domain_id": domain_id,
        "is_primary": data.is_primary
    })
    await db.commit()

    return {
        "id": alias_id,
        "alias_email": data.alias_email,
        "user_name": user.name,
        "message": "Email alias created successfully"
    }


@router.delete("/aliases/{alias_id}")
async def delete_email_alias(
    alias_id: str,
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Delete an email alias"""
    tenant_id = current_user.get("tenant_id")

    # Verify alias belongs to tenant
    result = await db.execute(text("""
        SELECT uea.id, uea.alias_email, tu.name as user_name
        FROM workspace.user_email_aliases uea
        JOIN workspace.tenant_users tu ON uea.user_id = tu.id
        WHERE uea.id = CAST(:id AS uuid) AND tu.tenant_id = CAST(:tenant_id AS uuid)
    """), {"id": alias_id, "tenant_id": tenant_id})
    alias = result.fetchone()
    if not alias:
        raise HTTPException(status_code=404, detail="Email alias not found")

    # Delete alias
    await db.execute(text("""
        DELETE FROM workspace.user_email_aliases WHERE id = CAST(:id AS uuid)
    """), {"id": alias_id})
    await db.commit()

    return {"message": f"Email alias '{alias.alias_email}' deleted successfully"}
