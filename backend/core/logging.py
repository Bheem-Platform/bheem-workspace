"""
Bheem Workspace - Structured Logging Configuration
"""
import logging
import sys
import json
from datetime import datetime
from typing import Any, Dict
from functools import wraps
from fastapi import Request
import traceback


class JSONFormatter(logging.Formatter):
    """JSON log formatter for structured logging"""

    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Add extra fields
        if hasattr(record, "user_id"):
            log_data["user_id"] = record.user_id
        if hasattr(record, "tenant_id"):
            log_data["tenant_id"] = record.tenant_id
        if hasattr(record, "request_id"):
            log_data["request_id"] = record.request_id
        if hasattr(record, "action"):
            log_data["action"] = record.action
        if hasattr(record, "duration_ms"):
            log_data["duration_ms"] = record.duration_ms
        if hasattr(record, "status_code"):
            log_data["status_code"] = record.status_code
        if hasattr(record, "extra_data"):
            log_data["extra"] = record.extra_data

        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else None,
                "message": str(record.exc_info[1]) if record.exc_info[1] else None,
                "traceback": traceback.format_exception(*record.exc_info)
            }

        return json.dumps(log_data)


class WorkspaceLogger:
    """Custom logger wrapper for Bheem Workspace"""

    def __init__(self, name: str = "bheem.workspace"):
        self.logger = logging.getLogger(name)

    def _log(self, level: int, message: str, **kwargs):
        """Internal log method with extra fields"""
        extra = {}
        for key in ["user_id", "tenant_id", "request_id", "action", "duration_ms", "status_code"]:
            if key in kwargs:
                extra[key] = kwargs.pop(key)
        if kwargs:
            extra["extra_data"] = kwargs

        self.logger.log(level, message, extra=extra)

    def debug(self, message: str, **kwargs):
        self._log(logging.DEBUG, message, **kwargs)

    def info(self, message: str, **kwargs):
        self._log(logging.INFO, message, **kwargs)

    def warning(self, message: str, **kwargs):
        self._log(logging.WARNING, message, **kwargs)

    def error(self, message: str, **kwargs):
        self._log(logging.ERROR, message, **kwargs)

    def critical(self, message: str, **kwargs):
        self._log(logging.CRITICAL, message, **kwargs)

    def exception(self, message: str, **kwargs):
        """Log exception with traceback"""
        self.logger.exception(message, extra=kwargs)


def setup_logging(
    level: str = "INFO",
    json_format: bool = True,
    log_file: str = None
):
    """
    Configure logging for the application

    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        json_format: Use JSON format for structured logging
        log_file: Optional file path to write logs
    """
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, level.upper()))

    # Remove existing handlers
    root_logger.handlers = []

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(getattr(logging, level.upper()))

    if json_format:
        console_handler.setFormatter(JSONFormatter())
    else:
        console_handler.setFormatter(logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        ))

    root_logger.addHandler(console_handler)

    # File handler if specified
    if log_file:
        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(getattr(logging, level.upper()))
        if json_format:
            file_handler.setFormatter(JSONFormatter())
        else:
            file_handler.setFormatter(logging.Formatter(
                "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
            ))
        root_logger.addHandler(file_handler)

    # Set third-party loggers to WARNING to reduce noise
    logging.getLogger("uvicorn").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


def get_logger(name: str = "bheem.workspace") -> WorkspaceLogger:
    """Get a workspace logger instance"""
    return WorkspaceLogger(name)


# Request logging middleware helper
async def log_request(request: Request, response_status: int, duration_ms: float, user_id: str = None):
    """Log API request"""
    logger = get_logger("bheem.workspace.api")
    logger.info(
        f"{request.method} {request.url.path}",
        user_id=user_id,
        status_code=response_status,
        duration_ms=round(duration_ms, 2),
        request_id=request.headers.get("X-Request-ID"),
        action=f"api_{request.method.lower()}",
        client_ip=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent", "")[:100]
    )


# Admin action logging
def log_admin_action(
    action: str,
    user_id: str = None,
    tenant_id: str = None,
    entity_type: str = None,
    entity_id: str = None,
    description: str = None,
    **extra
):
    """Log admin action for audit trail"""
    logger = get_logger("bheem.workspace.admin")
    logger.info(
        description or f"Admin action: {action}",
        user_id=user_id,
        tenant_id=tenant_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        **extra
    )


# Security event logging
def log_security_event(
    event: str,
    user_id: str = None,
    ip_address: str = None,
    success: bool = True,
    **extra
):
    """Log security-related events"""
    logger = get_logger("bheem.workspace.security")
    log_func = logger.info if success else logger.warning
    log_func(
        f"Security event: {event}",
        user_id=user_id,
        action=f"security_{event}",
        ip_address=ip_address,
        success=success,
        **extra
    )
