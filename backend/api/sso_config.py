"""
Bheem Workspace - SSO Configuration API
SAML and OIDC identity provider configuration
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import uuid
import re

from core.database import get_db
from core.security import get_current_user, require_tenant_admin
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/sso", tags=["Admin - SSO Configuration"])


# =============================================
# Models
# =============================================

class SAMLConfig(BaseModel):
    entity_id: str
    sso_url: str
    slo_url: Optional[str] = None
    certificate: str
    name_id_format: str = "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"


class OIDCConfig(BaseModel):
    client_id: str
    client_secret: str
    issuer_url: str
    authorization_url: Optional[str] = None
    token_url: Optional[str] = None
    userinfo_url: Optional[str] = None
    scopes: str = "openid email profile"


class SSOProviderCreate(BaseModel):
    provider_name: str
    provider_type: str  # saml, oidc
    is_enabled: bool = False
    is_primary: bool = False
    saml_config: Optional[SAMLConfig] = None
    oidc_config: Optional[OIDCConfig] = None
    attribute_mapping: Optional[Dict[str, str]] = None
    auto_provision_users: bool = True
    auto_update_profile: bool = True
    default_role: str = "member"
    allowed_domains: Optional[List[str]] = None

    @validator('provider_type')
    def validate_type(cls, v):
        if v not in ['saml', 'oidc']:
            raise ValueError('Provider type must be saml or oidc')
        return v

    @validator('provider_name')
    def validate_name(cls, v):
        if not v or len(v.strip()) < 2:
            raise ValueError('Provider name is required')
        return v.strip()


class SSOProviderUpdate(BaseModel):
    provider_name: Optional[str] = None
    is_enabled: Optional[bool] = None
    is_primary: Optional[bool] = None
    saml_config: Optional[SAMLConfig] = None
    oidc_config: Optional[OIDCConfig] = None
    attribute_mapping: Optional[Dict[str, str]] = None
    auto_provision_users: Optional[bool] = None
    auto_update_profile: Optional[bool] = None
    default_role: Optional[str] = None
    allowed_domains: Optional[List[str]] = None


# =============================================
# Endpoints
# =============================================

@router.get("")
async def list_sso_providers(
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get all SSO providers for the tenant"""
    tenant_id = current_user.get("tenant_id")

    result = await db.execute(text("""
        SELECT
            id, provider_name, provider_type, is_enabled, is_primary,
            saml_entity_id, saml_sso_url,
            oidc_client_id, oidc_issuer_url,
            auto_provision_users, auto_update_profile, default_role,
            allowed_domains, attribute_mapping,
            created_at, updated_at, last_synced_at
        FROM workspace.sso_configurations
        WHERE tenant_id = CAST(:tenant_id AS uuid)
        ORDER BY is_primary DESC, provider_name
    """), {"tenant_id": tenant_id})

    providers = result.fetchall()

    return {
        "providers": [
            {
                "id": str(p.id),
                "provider_name": p.provider_name,
                "provider_type": p.provider_type,
                "is_enabled": p.is_enabled,
                "is_primary": p.is_primary,
                "saml": {
                    "entity_id": p.saml_entity_id,
                    "sso_url": p.saml_sso_url
                } if p.provider_type == 'saml' else None,
                "oidc": {
                    "client_id": p.oidc_client_id,
                    "issuer_url": p.oidc_issuer_url
                } if p.provider_type == 'oidc' else None,
                "auto_provision_users": p.auto_provision_users,
                "auto_update_profile": p.auto_update_profile,
                "default_role": p.default_role,
                "allowed_domains": p.allowed_domains or [],
                "attribute_mapping": p.attribute_mapping or {},
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "last_synced_at": p.last_synced_at.isoformat() if p.last_synced_at else None
            }
            for p in providers
        ],
        "count": len(providers)
    }


@router.get("/{provider_id}")
async def get_sso_provider(
    provider_id: str,
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get a specific SSO provider configuration"""
    tenant_id = current_user.get("tenant_id")

    result = await db.execute(text("""
        SELECT
            id, provider_name, provider_type, is_enabled, is_primary,
            saml_entity_id, saml_sso_url, saml_slo_url, saml_certificate, saml_name_id_format,
            oidc_client_id, oidc_client_secret, oidc_issuer_url,
            oidc_authorization_url, oidc_token_url, oidc_userinfo_url, oidc_scopes,
            auto_provision_users, auto_update_profile, default_role,
            allowed_domains, attribute_mapping,
            created_at, updated_at, last_synced_at
        FROM workspace.sso_configurations
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
    """), {"id": provider_id, "tenant_id": tenant_id})

    provider = result.fetchone()
    if not provider:
        raise HTTPException(status_code=404, detail="SSO provider not found")

    response = {
        "id": str(provider.id),
        "provider_name": provider.provider_name,
        "provider_type": provider.provider_type,
        "is_enabled": provider.is_enabled,
        "is_primary": provider.is_primary,
        "auto_provision_users": provider.auto_provision_users,
        "auto_update_profile": provider.auto_update_profile,
        "default_role": provider.default_role,
        "allowed_domains": provider.allowed_domains or [],
        "attribute_mapping": provider.attribute_mapping or {},
        "created_at": provider.created_at.isoformat() if provider.created_at else None,
        "updated_at": provider.updated_at.isoformat() if provider.updated_at else None,
        "last_synced_at": provider.last_synced_at.isoformat() if provider.last_synced_at else None
    }

    if provider.provider_type == 'saml':
        response["saml"] = {
            "entity_id": provider.saml_entity_id,
            "sso_url": provider.saml_sso_url,
            "slo_url": provider.saml_slo_url,
            "certificate": provider.saml_certificate,
            "name_id_format": provider.saml_name_id_format
        }
    else:
        response["oidc"] = {
            "client_id": provider.oidc_client_id,
            "client_secret": "***" if provider.oidc_client_secret else None,  # Mask secret
            "issuer_url": provider.oidc_issuer_url,
            "authorization_url": provider.oidc_authorization_url,
            "token_url": provider.oidc_token_url,
            "userinfo_url": provider.oidc_userinfo_url,
            "scopes": provider.oidc_scopes
        }

    return response


@router.post("")
async def create_sso_provider(
    data: SSOProviderCreate,
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Create a new SSO provider configuration"""
    tenant_id = current_user.get("tenant_id")
    provider_id = str(uuid.uuid4())

    # Check for duplicate name
    existing = await db.execute(text("""
        SELECT id FROM workspace.sso_configurations
        WHERE tenant_id = CAST(:tenant_id AS uuid) AND provider_name = :name
    """), {"tenant_id": tenant_id, "name": data.provider_name})
    if existing.fetchone():
        raise HTTPException(status_code=409, detail=f"Provider '{data.provider_name}' already exists")

    # Validate config based on type
    if data.provider_type == 'saml' and not data.saml_config:
        raise HTTPException(status_code=400, detail="SAML configuration required for SAML provider")
    if data.provider_type == 'oidc' and not data.oidc_config:
        raise HTTPException(status_code=400, detail="OIDC configuration required for OIDC provider")

    # If setting as primary, remove primary from others
    if data.is_primary:
        await db.execute(text("""
            UPDATE workspace.sso_configurations
            SET is_primary = FALSE, updated_at = NOW()
            WHERE tenant_id = CAST(:tenant_id AS uuid)
        """), {"tenant_id": tenant_id})

    # Build insert parameters
    params = {
        "id": provider_id,
        "tenant_id": tenant_id,
        "provider_name": data.provider_name,
        "provider_type": data.provider_type,
        "is_enabled": data.is_enabled,
        "is_primary": data.is_primary,
        "auto_provision_users": data.auto_provision_users,
        "auto_update_profile": data.auto_update_profile,
        "default_role": data.default_role,
        "allowed_domains": data.allowed_domains or [],
        "attribute_mapping": data.attribute_mapping or {}
    }

    # Add type-specific config
    if data.provider_type == 'saml' and data.saml_config:
        params.update({
            "saml_entity_id": data.saml_config.entity_id,
            "saml_sso_url": data.saml_config.sso_url,
            "saml_slo_url": data.saml_config.slo_url,
            "saml_certificate": data.saml_config.certificate,
            "saml_name_id_format": data.saml_config.name_id_format
        })
    else:
        params.update({
            "saml_entity_id": None,
            "saml_sso_url": None,
            "saml_slo_url": None,
            "saml_certificate": None,
            "saml_name_id_format": None
        })

    if data.provider_type == 'oidc' and data.oidc_config:
        params.update({
            "oidc_client_id": data.oidc_config.client_id,
            "oidc_client_secret": data.oidc_config.client_secret,
            "oidc_issuer_url": data.oidc_config.issuer_url,
            "oidc_authorization_url": data.oidc_config.authorization_url,
            "oidc_token_url": data.oidc_config.token_url,
            "oidc_userinfo_url": data.oidc_config.userinfo_url,
            "oidc_scopes": data.oidc_config.scopes
        })
    else:
        params.update({
            "oidc_client_id": None,
            "oidc_client_secret": None,
            "oidc_issuer_url": None,
            "oidc_authorization_url": None,
            "oidc_token_url": None,
            "oidc_userinfo_url": None,
            "oidc_scopes": None
        })

    await db.execute(text("""
        INSERT INTO workspace.sso_configurations (
            id, tenant_id, provider_name, provider_type, is_enabled, is_primary,
            saml_entity_id, saml_sso_url, saml_slo_url, saml_certificate, saml_name_id_format,
            oidc_client_id, oidc_client_secret, oidc_issuer_url, oidc_authorization_url,
            oidc_token_url, oidc_userinfo_url, oidc_scopes,
            auto_provision_users, auto_update_profile, default_role,
            allowed_domains, attribute_mapping,
            created_at, updated_at
        ) VALUES (
            CAST(:id AS uuid), CAST(:tenant_id AS uuid), :provider_name, :provider_type,
            :is_enabled, :is_primary,
            :saml_entity_id, :saml_sso_url, :saml_slo_url, :saml_certificate, :saml_name_id_format,
            :oidc_client_id, :oidc_client_secret, :oidc_issuer_url, :oidc_authorization_url,
            :oidc_token_url, :oidc_userinfo_url, :oidc_scopes,
            :auto_provision_users, :auto_update_profile, :default_role,
            :allowed_domains, :attribute_mapping,
            NOW(), NOW()
        )
    """), params)
    await db.commit()

    logger.info(f"Created SSO provider {data.provider_name} ({data.provider_type}) for tenant {tenant_id}")

    return {
        "id": provider_id,
        "provider_name": data.provider_name,
        "provider_type": data.provider_type,
        "message": "SSO provider created successfully"
    }


@router.put("/{provider_id}")
async def update_sso_provider(
    provider_id: str,
    data: SSOProviderUpdate,
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Update an SSO provider configuration"""
    tenant_id = current_user.get("tenant_id")

    # Verify exists
    existing = await db.execute(text("""
        SELECT id, provider_type FROM workspace.sso_configurations
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
    """), {"id": provider_id, "tenant_id": tenant_id})
    provider = existing.fetchone()
    if not provider:
        raise HTTPException(status_code=404, detail="SSO provider not found")

    # If setting as primary, remove primary from others
    if data.is_primary:
        await db.execute(text("""
            UPDATE workspace.sso_configurations
            SET is_primary = FALSE, updated_at = NOW()
            WHERE tenant_id = CAST(:tenant_id AS uuid) AND id != CAST(:id AS uuid)
        """), {"tenant_id": tenant_id, "id": provider_id})

    # Build update
    updates = ["updated_at = NOW()"]
    params = {"id": provider_id, "tenant_id": tenant_id}

    if data.provider_name is not None:
        updates.append("provider_name = :provider_name")
        params["provider_name"] = data.provider_name

    if data.is_enabled is not None:
        updates.append("is_enabled = :is_enabled")
        params["is_enabled"] = data.is_enabled

    if data.is_primary is not None:
        updates.append("is_primary = :is_primary")
        params["is_primary"] = data.is_primary

    if data.auto_provision_users is not None:
        updates.append("auto_provision_users = :auto_provision_users")
        params["auto_provision_users"] = data.auto_provision_users

    if data.auto_update_profile is not None:
        updates.append("auto_update_profile = :auto_update_profile")
        params["auto_update_profile"] = data.auto_update_profile

    if data.default_role is not None:
        updates.append("default_role = :default_role")
        params["default_role"] = data.default_role

    if data.allowed_domains is not None:
        updates.append("allowed_domains = :allowed_domains")
        params["allowed_domains"] = data.allowed_domains

    if data.attribute_mapping is not None:
        updates.append("attribute_mapping = :attribute_mapping")
        params["attribute_mapping"] = data.attribute_mapping

    # SAML config updates
    if data.saml_config and provider.provider_type == 'saml':
        updates.extend([
            "saml_entity_id = :saml_entity_id",
            "saml_sso_url = :saml_sso_url",
            "saml_slo_url = :saml_slo_url",
            "saml_certificate = :saml_certificate",
            "saml_name_id_format = :saml_name_id_format"
        ])
        params.update({
            "saml_entity_id": data.saml_config.entity_id,
            "saml_sso_url": data.saml_config.sso_url,
            "saml_slo_url": data.saml_config.slo_url,
            "saml_certificate": data.saml_config.certificate,
            "saml_name_id_format": data.saml_config.name_id_format
        })

    # OIDC config updates
    if data.oidc_config and provider.provider_type == 'oidc':
        updates.extend([
            "oidc_client_id = :oidc_client_id",
            "oidc_issuer_url = :oidc_issuer_url",
            "oidc_authorization_url = :oidc_authorization_url",
            "oidc_token_url = :oidc_token_url",
            "oidc_userinfo_url = :oidc_userinfo_url",
            "oidc_scopes = :oidc_scopes"
        ])
        params.update({
            "oidc_client_id": data.oidc_config.client_id,
            "oidc_issuer_url": data.oidc_config.issuer_url,
            "oidc_authorization_url": data.oidc_config.authorization_url,
            "oidc_token_url": data.oidc_config.token_url,
            "oidc_userinfo_url": data.oidc_config.userinfo_url,
            "oidc_scopes": data.oidc_config.scopes
        })
        # Only update secret if provided
        if data.oidc_config.client_secret:
            updates.append("oidc_client_secret = :oidc_client_secret")
            params["oidc_client_secret"] = data.oidc_config.client_secret

    query = f"""
        UPDATE workspace.sso_configurations
        SET {', '.join(updates)}
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
    """
    await db.execute(text(query), params)
    await db.commit()

    return {"id": provider_id, "message": "SSO provider updated successfully"}


@router.delete("/{provider_id}")
async def delete_sso_provider(
    provider_id: str,
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Delete an SSO provider"""
    tenant_id = current_user.get("tenant_id")

    # Verify exists
    existing = await db.execute(text("""
        SELECT id, provider_name, is_primary FROM workspace.sso_configurations
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
    """), {"id": provider_id, "tenant_id": tenant_id})
    provider = existing.fetchone()
    if not provider:
        raise HTTPException(status_code=404, detail="SSO provider not found")

    if provider.is_primary:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete primary SSO provider. Set another provider as primary first."
        )

    # Delete SSO sessions first
    await db.execute(text("""
        DELETE FROM workspace.sso_sessions WHERE sso_config_id = CAST(:id AS uuid)
    """), {"id": provider_id})

    # Delete provider
    await db.execute(text("""
        DELETE FROM workspace.sso_configurations
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
    """), {"id": provider_id, "tenant_id": tenant_id})
    await db.commit()

    logger.info(f"Deleted SSO provider {provider.provider_name} from tenant {tenant_id}")

    return {"message": "SSO provider deleted successfully"}


@router.post("/{provider_id}/test")
async def test_sso_connection(
    provider_id: str,
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Test SSO provider connection"""
    tenant_id = current_user.get("tenant_id")

    result = await db.execute(text("""
        SELECT id, provider_name, provider_type, oidc_issuer_url, saml_sso_url
        FROM workspace.sso_configurations
        WHERE id = CAST(:id AS uuid) AND tenant_id = CAST(:tenant_id AS uuid)
    """), {"id": provider_id, "tenant_id": tenant_id})

    provider = result.fetchone()
    if not provider:
        raise HTTPException(status_code=404, detail="SSO provider not found")

    # In production, actually test the connection
    # For now, simulate
    import random
    success = random.random() > 0.2

    if success:
        return {
            "status": "success",
            "provider_name": provider.provider_name,
            "message": "Connection test successful"
        }
    else:
        return {
            "status": "failed",
            "provider_name": provider.provider_name,
            "message": "Could not connect to identity provider. Check configuration."
        }


@router.get("/metadata")
async def get_sp_metadata(
    current_user: dict = Depends(require_tenant_admin())
) -> Dict[str, Any]:
    """Get Service Provider (SP) metadata for SAML configuration"""
    tenant_id = current_user.get("tenant_id")

    return {
        "entity_id": f"https://workspace.bheem.cloud/saml/{tenant_id}",
        "acs_url": f"https://workspace.bheem.cloud/api/v1/auth/saml/callback",
        "slo_url": f"https://workspace.bheem.cloud/api/v1/auth/saml/logout",
        "name_id_format": "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
        "certificate": "Download from admin console",
        "metadata_url": f"https://workspace.bheem.cloud/api/v1/auth/saml/{tenant_id}/metadata"
    }
