"""
Pytest Configuration and Fixtures

This file contains shared fixtures and configuration for all tests.
"""

import asyncio
import os
from typing import AsyncGenerator, Generator
from uuid import uuid4

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool

# Set test environment before importing app
os.environ["TESTING"] = "true"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"

from main import app
from core.database import Base, get_db


# ===========================================
# Database Fixtures
# ===========================================

# Test database engine
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestSessionLocal = async_sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Create a fresh database session for each test.
    """
    # Create all tables
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestSessionLocal() as session:
        yield session

    # Drop all tables after test
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """
    Create a test client with overridden database dependency.
    """

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        yield client

    app.dependency_overrides.clear()


# ===========================================
# Authentication Fixtures
# ===========================================

@pytest.fixture
def test_user_data() -> dict:
    """
    Generate test user data.
    """
    return {
        "id": str(uuid4()),
        "email": "testuser@example.com",
        "name": "Test User",
        "role": "user",
        "tenant_id": str(uuid4()),
        "company_code": "TEST001",
    }


@pytest.fixture
def test_admin_data() -> dict:
    """
    Generate test admin data.
    """
    return {
        "id": str(uuid4()),
        "email": "admin@example.com",
        "name": "Test Admin",
        "role": "admin",
        "tenant_id": str(uuid4()),
        "company_code": "TEST001",
    }


@pytest.fixture
def auth_headers(test_user_data: dict) -> dict:
    """
    Create authentication headers with a test JWT token.
    """
    from core.security import create_access_token

    token = create_access_token(data=test_user_data)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_auth_headers(test_admin_data: dict) -> dict:
    """
    Create authentication headers for admin user.
    """
    from core.security import create_access_token

    token = create_access_token(data=test_admin_data)
    return {"Authorization": f"Bearer {token}"}


# ===========================================
# Factory Fixtures
# ===========================================

@pytest.fixture
def make_user():
    """
    Factory fixture to create user data.
    """
    def _make_user(
        email: str = None,
        name: str = None,
        role: str = "user",
        tenant_id: str = None,
    ) -> dict:
        from faker import Faker
        fake = Faker()

        return {
            "id": str(uuid4()),
            "email": email or fake.email(),
            "name": name or fake.name(),
            "role": role,
            "tenant_id": tenant_id or str(uuid4()),
            "company_code": "TEST001",
        }

    return _make_user


@pytest.fixture
def make_tenant():
    """
    Factory fixture to create tenant data.
    """
    def _make_tenant(
        name: str = None,
        slug: str = None,
        plan: str = "starter",
    ) -> dict:
        from faker import Faker
        fake = Faker()

        return {
            "id": str(uuid4()),
            "name": name or fake.company(),
            "slug": slug or fake.slug(),
            "plan": plan,
            "max_users": 10,
            "is_active": True,
        }

    return _make_tenant


# ===========================================
# Mock Fixtures
# ===========================================

@pytest.fixture
def mock_nextcloud(mocker):
    """
    Mock Nextcloud service.
    """
    mock = mocker.patch("services.nextcloud_service.NextcloudService")
    mock.return_value.create_folder.return_value = True
    mock.return_value.upload_file.return_value = True
    mock.return_value.delete_file.return_value = True
    mock.return_value.list_files.return_value = []
    return mock


@pytest.fixture
def mock_mailcow(mocker):
    """
    Mock Mailcow service.
    """
    mock = mocker.patch("services.mailcow_service.MailcowService")
    mock.return_value.create_mailbox.return_value = True
    mock.return_value.get_mailboxes.return_value = []
    return mock


@pytest.fixture
def mock_livekit(mocker):
    """
    Mock LiveKit service.
    """
    mock = mocker.patch("services.livekit_service.LiveKitService")
    mock.return_value.create_room.return_value = {"name": "test-room"}
    mock.return_value.generate_token.return_value = "test-token"
    return mock


@pytest.fixture
def mock_redis(mocker):
    """
    Mock Redis client.
    """
    mock = mocker.patch("redis.Redis")
    mock.return_value.get.return_value = None
    mock.return_value.set.return_value = True
    mock.return_value.delete.return_value = True
    return mock


# ===========================================
# Utility Fixtures
# ===========================================

@pytest.fixture
def sample_file():
    """
    Create a sample file for upload tests.
    """
    import io

    content = b"Test file content"
    file = io.BytesIO(content)
    file.name = "test.txt"
    return file


@pytest.fixture
def sample_image():
    """
    Create a sample image for upload tests.
    """
    import io

    # 1x1 transparent PNG
    content = (
        b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01'
        b'\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00'
        b'\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
    )
    file = io.BytesIO(content)
    file.name = "test.png"
    return file


# ===========================================
# Event Loop Configuration
# ===========================================

@pytest.fixture(scope="session")
def event_loop():
    """
    Create an instance of the default event loop for each test session.
    """
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()
