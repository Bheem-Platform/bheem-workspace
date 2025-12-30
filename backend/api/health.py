"""
Bheem Workspace - Health Check API
Monitors service health and dependencies
"""
from fastapi import APIRouter, Depends
from typing import Dict, Any, List
from datetime import datetime
import asyncio
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from core.database import get_db
from core.config import settings
from core.security import get_current_user, require_superadmin

router = APIRouter(tags=["Health"])


async def check_database(db: AsyncSession) -> Dict[str, Any]:
    """Check database connectivity"""
    try:
        start = datetime.utcnow()
        await db.execute(text("SELECT 1"))
        latency = (datetime.utcnow() - start).total_seconds() * 1000
        return {
            "status": "healthy",
            "latency_ms": round(latency, 2),
            "message": "Database connection OK"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "latency_ms": None,
            "message": str(e)
        }


async def check_livekit() -> Dict[str, Any]:
    """Check LiveKit (Bheem Meet) connectivity"""
    try:
        # LiveKit uses WebSocket, so we just verify the URL is configured
        if not settings.LIVEKIT_URL:
            return {
                "status": "unconfigured",
                "latency_ms": None,
                "message": "LiveKit URL not configured"
            }
        return {
            "status": "healthy",
            "latency_ms": None,
            "message": "LiveKit configured",
            "url": settings.LIVEKIT_URL
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "latency_ms": None,
            "message": str(e)
        }


async def check_nextcloud() -> Dict[str, Any]:
    """Check Nextcloud (Bheem Docs) connectivity"""
    try:
        if not settings.NEXTCLOUD_URL:
            return {
                "status": "unconfigured",
                "latency_ms": None,
                "message": "Nextcloud URL not configured"
            }

        start = datetime.utcnow()
        async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
            response = await client.get(f"{settings.NEXTCLOUD_URL}/status.php")
            latency = (datetime.utcnow() - start).total_seconds() * 1000

            if response.status_code == 200:
                return {
                    "status": "healthy",
                    "latency_ms": round(latency, 2),
                    "message": "Nextcloud connection OK"
                }
            else:
                return {
                    "status": "degraded",
                    "latency_ms": round(latency, 2),
                    "message": f"Nextcloud returned status {response.status_code}"
                }
    except httpx.TimeoutException:
        return {
            "status": "unhealthy",
            "latency_ms": None,
            "message": "Nextcloud connection timeout"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "latency_ms": None,
            "message": str(e)
        }


async def check_mailcow() -> Dict[str, Any]:
    """Check Mailcow (Bheem Mail) connectivity"""
    try:
        if not settings.MAILCOW_URL:
            return {
                "status": "unconfigured",
                "latency_ms": None,
                "message": "Mailcow URL not configured"
            }

        start = datetime.utcnow()
        async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
            response = await client.get(
                f"{settings.MAILCOW_URL}/api/v1/get/status/containers",
                headers={"X-API-Key": settings.MAILCOW_API_KEY}
            )
            latency = (datetime.utcnow() - start).total_seconds() * 1000

            if response.status_code == 200:
                return {
                    "status": "healthy",
                    "latency_ms": round(latency, 2),
                    "message": "Mailcow connection OK"
                }
            elif response.status_code == 401:
                return {
                    "status": "unhealthy",
                    "latency_ms": round(latency, 2),
                    "message": "Mailcow authentication failed"
                }
            else:
                return {
                    "status": "degraded",
                    "latency_ms": round(latency, 2),
                    "message": f"Mailcow returned status {response.status_code}"
                }
    except httpx.TimeoutException:
        return {
            "status": "unhealthy",
            "latency_ms": None,
            "message": "Mailcow connection timeout"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "latency_ms": None,
            "message": str(e)
        }


async def check_bheem_passport() -> Dict[str, Any]:
    """Check Bheem Passport (SSO) connectivity"""
    try:
        if not settings.USE_PASSPORT_AUTH or not settings.BHEEM_PASSPORT_URL:
            return {
                "status": "disabled",
                "latency_ms": None,
                "message": "Passport authentication disabled"
            }

        start = datetime.utcnow()
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{settings.BHEEM_PASSPORT_URL}/health")
            latency = (datetime.utcnow() - start).total_seconds() * 1000

            if response.status_code == 200:
                return {
                    "status": "healthy",
                    "latency_ms": round(latency, 2),
                    "message": "Bheem Passport connection OK"
                }
            else:
                return {
                    "status": "degraded",
                    "latency_ms": round(latency, 2),
                    "message": f"Passport returned status {response.status_code}"
                }
    except httpx.TimeoutException:
        return {
            "status": "unhealthy",
            "latency_ms": None,
            "message": "Bheem Passport connection timeout"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "latency_ms": None,
            "message": str(e)
        }


async def check_bheem_notify() -> Dict[str, Any]:
    """Check Bheem Notify service connectivity"""
    try:
        notify_url = getattr(settings, 'BHEEM_NOTIFY_URL', None)
        if not notify_url:
            return {
                "status": "unconfigured",
                "latency_ms": None,
                "message": "Bheem Notify URL not configured"
            }

        start = datetime.utcnow()
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{notify_url}/health")
            latency = (datetime.utcnow() - start).total_seconds() * 1000

            if response.status_code == 200:
                return {
                    "status": "healthy",
                    "latency_ms": round(latency, 2),
                    "message": "Bheem Notify connection OK"
                }
            else:
                return {
                    "status": "degraded",
                    "latency_ms": round(latency, 2),
                    "message": f"Notify returned status {response.status_code}"
                }
    except Exception as e:
        return {
            "status": "unhealthy",
            "latency_ms": None,
            "message": str(e)
        }


async def check_s3_storage() -> Dict[str, Any]:
    """Check S3 storage connectivity"""
    try:
        if not settings.S3_ENDPOINT:
            return {
                "status": "unconfigured",
                "latency_ms": None,
                "message": "S3 storage not configured"
            }

        start = datetime.utcnow()
        async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
            # Just check if endpoint is reachable
            response = await client.head(settings.S3_ENDPOINT)
            latency = (datetime.utcnow() - start).total_seconds() * 1000

            return {
                "status": "healthy",
                "latency_ms": round(latency, 2),
                "message": "S3 endpoint reachable"
            }
    except Exception as e:
        return {
            "status": "unhealthy",
            "latency_ms": None,
            "message": str(e)
        }


@router.get("/health")
async def health_check():
    """Basic health check endpoint"""
    return {
        "status": "healthy",
        "service": "bheem-workspace",
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }


@router.get("/health/ready")
async def readiness_check(db: AsyncSession = Depends(get_db)):
    """Readiness check - verifies service is ready to handle requests"""
    db_check = await check_database(db)

    is_ready = db_check["status"] == "healthy"

    return {
        "ready": is_ready,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "checks": {
            "database": db_check
        }
    }


@router.get("/health/live")
async def liveness_check():
    """Liveness check - verifies service is running"""
    return {
        "alive": True,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }


@router.get("/health/detailed")
async def detailed_health_check(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_superadmin())
):
    """
    Detailed health check for all services (SuperAdmin only)
    Returns status of all integrated services
    """
    # Run all checks concurrently
    results = await asyncio.gather(
        check_database(db),
        check_livekit(),
        check_nextcloud(),
        check_mailcow(),
        check_bheem_passport(),
        check_bheem_notify(),
        check_s3_storage(),
        return_exceptions=True
    )

    services = {
        "database": results[0] if not isinstance(results[0], Exception) else {"status": "error", "message": str(results[0])},
        "livekit": results[1] if not isinstance(results[1], Exception) else {"status": "error", "message": str(results[1])},
        "nextcloud": results[2] if not isinstance(results[2], Exception) else {"status": "error", "message": str(results[2])},
        "mailcow": results[3] if not isinstance(results[3], Exception) else {"status": "error", "message": str(results[3])},
        "bheem_passport": results[4] if not isinstance(results[4], Exception) else {"status": "error", "message": str(results[4])},
        "bheem_notify": results[5] if not isinstance(results[5], Exception) else {"status": "error", "message": str(results[5])},
        "s3_storage": results[6] if not isinstance(results[6], Exception) else {"status": "error", "message": str(results[6])},
    }

    # Calculate overall status
    statuses = [s.get("status", "unknown") for s in services.values()]
    if all(s in ["healthy", "disabled", "unconfigured"] for s in statuses):
        overall_status = "healthy"
    elif any(s == "unhealthy" for s in statuses):
        overall_status = "unhealthy"
    else:
        overall_status = "degraded"

    return {
        "status": overall_status,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "services": services,
        "summary": {
            "healthy": sum(1 for s in statuses if s == "healthy"),
            "degraded": sum(1 for s in statuses if s == "degraded"),
            "unhealthy": sum(1 for s in statuses if s == "unhealthy"),
            "unconfigured": sum(1 for s in statuses if s in ["unconfigured", "disabled"])
        }
    }


@router.get("/health/services/{service_name}")
async def check_single_service(
    service_name: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_superadmin())
):
    """Check health of a specific service (SuperAdmin only)"""
    checks = {
        "database": lambda: check_database(db),
        "livekit": check_livekit,
        "nextcloud": check_nextcloud,
        "mailcow": check_mailcow,
        "passport": check_bheem_passport,
        "notify": check_bheem_notify,
        "s3": check_s3_storage,
    }

    if service_name not in checks:
        return {
            "error": f"Unknown service: {service_name}",
            "available_services": list(checks.keys())
        }

    result = await checks[service_name]()
    return {
        "service": service_name,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        **result
    }
