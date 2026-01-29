"""
Sentry Integration for Bheem Workspace Backend

This module provides Sentry error tracking and performance monitoring.
"""

import os
import logging
from typing import Optional

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.integrations.asyncio import AsyncioIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from sentry_sdk.integrations.httpx import HttpxIntegration

logger = logging.getLogger(__name__)


def init_sentry(
    dsn: Optional[str] = None,
    environment: Optional[str] = None,
    release: Optional[str] = None,
) -> None:
    """
    Initialize Sentry error tracking.

    Args:
        dsn: Sentry DSN (Data Source Name). If not provided, uses SENTRY_DSN env var.
        environment: Environment name (development, staging, production).
        release: Release version string.
    """
    sentry_dsn = dsn or os.getenv("SENTRY_DSN")

    if not sentry_dsn:
        logger.info("Sentry DSN not configured. Error tracking disabled.")
        return

    env = environment or os.getenv("ENVIRONMENT", "development")
    rel = release or os.getenv("SENTRY_RELEASE", "development")

    # Determine if we should enable Sentry
    enabled = env == "production" or os.getenv("SENTRY_ENABLED", "false").lower() == "true"

    if not enabled:
        logger.info(f"Sentry disabled for environment: {env}")
        return

    sentry_sdk.init(
        dsn=sentry_dsn,
        environment=env,
        release=rel,

        # Performance Monitoring
        traces_sample_rate=0.1 if env == "production" else 1.0,

        # Profiling
        profiles_sample_rate=0.1 if env == "production" else 0.0,

        # Integrations
        integrations=[
            FastApiIntegration(
                transaction_style="endpoint",
            ),
            SqlalchemyIntegration(),
            AsyncioIntegration(),
            LoggingIntegration(
                level=logging.INFO,
                event_level=logging.ERROR,
            ),
            HttpxIntegration(),
        ],

        # Don't send PII by default
        send_default_pii=False,

        # Attach stacktrace to messages
        attach_stacktrace=True,

        # Maximum breadcrumbs
        max_breadcrumbs=50,

        # Before send hook for filtering/modifying events
        before_send=before_send,

        # Before send transaction hook
        before_send_transaction=before_send_transaction,

        # Ignore specific errors
        ignore_errors=[
            KeyboardInterrupt,
            SystemExit,
        ],

        # Debug mode
        debug=env == "development",
    )

    logger.info(f"Sentry initialized for environment: {env}")


def before_send(event, hint):
    """
    Filter or modify events before sending to Sentry.
    """
    # Get the exception if available
    exception = hint.get("exc_info")

    if exception:
        exc_type, exc_value, _ = exception

        # Filter out specific exceptions
        ignored_exceptions = [
            "ConnectionResetError",
            "BrokenPipeError",
            "asyncio.CancelledError",
        ]

        if exc_type.__name__ in ignored_exceptions:
            return None

        # Filter out common HTTP errors that aren't bugs
        error_message = str(exc_value) if exc_value else ""
        ignored_messages = [
            "Connection refused",
            "Connection reset by peer",
            "Broken pipe",
            "Operation cancelled",
        ]

        for msg in ignored_messages:
            if msg.lower() in error_message.lower():
                return None

    # Scrub sensitive data
    if event.get("request"):
        headers = event["request"].get("headers", {})
        if "Authorization" in headers:
            headers["Authorization"] = "[Filtered]"
        if "Cookie" in headers:
            headers["Cookie"] = "[Filtered]"

    return event


def before_send_transaction(event, hint):
    """
    Filter or modify transactions before sending to Sentry.
    """
    # Filter out health check endpoints
    transaction_name = event.get("transaction", "")
    ignored_transactions = [
        "/health",
        "/healthz",
        "/ready",
        "/readyz",
        "/metrics",
    ]

    for ignored in ignored_transactions:
        if transaction_name.endswith(ignored):
            return None

    return event


def capture_exception(exception: Exception, **kwargs) -> Optional[str]:
    """
    Capture an exception to Sentry.

    Args:
        exception: The exception to capture.
        **kwargs: Additional context to attach.

    Returns:
        The Sentry event ID if captured, None otherwise.
    """
    return sentry_sdk.capture_exception(exception, **kwargs)


def capture_message(message: str, level: str = "info", **kwargs) -> Optional[str]:
    """
    Capture a message to Sentry.

    Args:
        message: The message to capture.
        level: The log level (debug, info, warning, error, fatal).
        **kwargs: Additional context to attach.

    Returns:
        The Sentry event ID if captured, None otherwise.
    """
    return sentry_sdk.capture_message(message, level=level, **kwargs)


def set_user(user_id: str, email: Optional[str] = None, username: Optional[str] = None) -> None:
    """
    Set the current user context for Sentry.

    Args:
        user_id: The user's ID.
        email: The user's email (optional).
        username: The user's username (optional).
    """
    sentry_sdk.set_user({
        "id": user_id,
        "email": email,
        "username": username,
    })


def set_tag(key: str, value: str) -> None:
    """
    Set a tag on the current scope.

    Args:
        key: The tag key.
        value: The tag value.
    """
    sentry_sdk.set_tag(key, value)


def set_context(key: str, value: dict) -> None:
    """
    Set extra context on the current scope.

    Args:
        key: The context key.
        value: The context data.
    """
    sentry_sdk.set_context(key, value)


def add_breadcrumb(
    message: str,
    category: str = "custom",
    level: str = "info",
    data: Optional[dict] = None,
) -> None:
    """
    Add a breadcrumb to the current scope.

    Args:
        message: The breadcrumb message.
        category: The breadcrumb category.
        level: The breadcrumb level.
        data: Additional data to attach.
    """
    sentry_sdk.add_breadcrumb(
        message=message,
        category=category,
        level=level,
        data=data or {},
    )


class SentryMiddleware:
    """
    Middleware to add Sentry context to requests.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # Add request context
        with sentry_sdk.push_scope() as sentry_scope:
            # Set request info
            sentry_scope.set_tag("path", scope.get("path", ""))
            sentry_scope.set_tag("method", scope.get("method", ""))

            # Get client IP
            client = scope.get("client")
            if client:
                sentry_scope.set_tag("client_ip", client[0])

            await self.app(scope, receive, send)
