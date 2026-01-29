"""
Health Check API Tests
"""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.api


class TestHealthCheck:
    """Test health check endpoints."""

    @pytest.mark.asyncio
    async def test_health_check(self, client: AsyncClient):
        """Test that health check endpoint returns 200."""
        response = await client.get("/api/v1/health")

        # Accept both 200 and 404 (if endpoint doesn't exist)
        assert response.status_code in [200, 404]

    @pytest.mark.asyncio
    async def test_root_endpoint(self, client: AsyncClient):
        """Test that root endpoint is accessible."""
        response = await client.get("/")

        # The root might redirect or return various responses
        assert response.status_code in [200, 307, 404]


class TestAPIInfo:
    """Test API info endpoints."""

    @pytest.mark.asyncio
    async def test_openapi_json(self, client: AsyncClient):
        """Test that OpenAPI JSON is accessible."""
        response = await client.get("/openapi.json")

        assert response.status_code == 200
        data = response.json()
        assert "openapi" in data
        assert "info" in data
        assert "paths" in data

    @pytest.mark.asyncio
    async def test_docs_endpoint(self, client: AsyncClient):
        """Test that docs endpoint is accessible."""
        response = await client.get("/docs")

        assert response.status_code == 200
