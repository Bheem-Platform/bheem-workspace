"""
Nextcloud Credentials Service

Manages per-user Nextcloud credentials for document storage.
Creates Nextcloud users and app passwords so each user's documents
are stored in their own Nextcloud folder.
"""

import logging
import httpx
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Optional, Dict, Any, Tuple
from uuid import UUID
from datetime import datetime

from core.config import settings

logger = logging.getLogger(__name__)


class NextcloudCredentialsService:
    """Service to manage Nextcloud credentials for users."""

    def __init__(self):
        self.nextcloud_url = settings.NEXTCLOUD_URL
        self.admin_user = settings.NEXTCLOUD_ADMIN_USER
        self.admin_password = settings.NEXTCLOUD_ADMIN_PASSWORD

    def _get_db_connection(self):
        """Get database connection."""
        return psycopg2.connect(
            host=settings.ERP_DB_HOST,
            port=settings.ERP_DB_PORT,
            database=settings.ERP_DB_NAME,
            user=settings.ERP_DB_USER,
            password=settings.ERP_DB_PASSWORD
        )

    async def get_user_credentials(self, user_id: UUID) -> Optional[Dict[str, Any]]:
        """
        Get Nextcloud credentials for a user.

        Returns:
            Dict with nextcloud_username and app_password, or None if not found
        """
        try:
            conn = self._get_db_connection()
            cur = conn.cursor(cursor_factory=RealDictCursor)

            cur.execute("""
                SELECT nextcloud_username, app_password, app_password_id, is_active
                FROM workspace.nextcloud_credentials
                WHERE user_id = %s AND is_active = true
            """, (str(user_id),))

            row = cur.fetchone()

            # Update last_used_at
            if row:
                cur.execute("""
                    UPDATE workspace.nextcloud_credentials
                    SET last_used_at = NOW()
                    WHERE user_id = %s
                """, (str(user_id),))
                conn.commit()

            cur.close()
            conn.close()

            if row:
                return {
                    'nextcloud_username': row['nextcloud_username'],
                    'app_password': row['app_password'],
                    'app_password_id': row['app_password_id']
                }
            return None

        except Exception as e:
            logger.error(f"Failed to get Nextcloud credentials for user {user_id}: {e}")
            return None

    async def ensure_user_credentials(
        self,
        user_id: UUID,
        user_email: str,
        user_name: str = None
    ) -> Optional[Dict[str, Any]]:
        """
        Ensure user has Nextcloud credentials. Creates them if not exists.

        Args:
            user_id: The user's UUID
            user_email: User's email (used as Nextcloud username)
            user_name: User's display name

        Returns:
            Dict with nextcloud_username and app_password
        """
        # First check if credentials already exist
        existing = await self.get_user_credentials(user_id)
        if existing:
            return existing

        # Create new credentials
        return await self.create_user_credentials(user_id, user_email, user_name)

    async def create_user_credentials(
        self,
        user_id: UUID,
        user_email: str,
        user_name: str = None
    ) -> Optional[Dict[str, Any]]:
        """
        Create Nextcloud user and app password.

        Args:
            user_id: The user's UUID
            user_email: User's email (used as Nextcloud username)
            user_name: User's display name

        Returns:
            Dict with nextcloud_username and app_password
        """
        nextcloud_username = user_email.lower()

        try:
            async with httpx.AsyncClient(verify=False, timeout=30.0) as client:
                # Step 1: Check if Nextcloud user exists
                user_exists = await self._check_user_exists(client, nextcloud_username)

                if not user_exists:
                    # Step 2: Create Nextcloud user
                    created = await self._create_nextcloud_user(
                        client,
                        nextcloud_username,
                        user_name or user_email.split('@')[0]
                    )
                    if not created:
                        logger.error(f"Failed to create Nextcloud user: {nextcloud_username}")
                        return None

                # Step 3: Create BheemDocs folder for the user
                await self._create_user_folder(client, nextcloud_username)

                # Step 4: Generate app password
                app_password, app_password_id = await self._generate_app_password(
                    client,
                    nextcloud_username
                )

                if not app_password:
                    logger.error(f"Failed to generate app password for: {nextcloud_username}")
                    return None

                # Step 5: Store credentials in database
                await self._store_credentials(
                    user_id,
                    nextcloud_username,
                    app_password,
                    app_password_id
                )

                logger.info(f"Created Nextcloud credentials for user: {nextcloud_username}")

                return {
                    'nextcloud_username': nextcloud_username,
                    'app_password': app_password,
                    'app_password_id': app_password_id
                }

        except Exception as e:
            logger.error(f"Failed to create Nextcloud credentials: {e}")
            import traceback
            traceback.print_exc()
            return None

    async def _check_user_exists(self, client: httpx.AsyncClient, username: str) -> bool:
        """Check if Nextcloud user exists."""
        try:
            response = await client.get(
                f"{self.nextcloud_url}/ocs/v2.php/cloud/users/{username}",
                auth=(self.admin_user, self.admin_password),
                headers={"OCS-APIREQUEST": "true"},
                params={"format": "json"}
            )
            return response.status_code == 200
        except Exception as e:
            logger.warning(f"Error checking user existence: {e}")
            return False

    async def _create_nextcloud_user(
        self,
        client: httpx.AsyncClient,
        username: str,
        display_name: str
    ) -> bool:
        """Create a new Nextcloud user."""
        try:
            # Generate a random password (user will use app password anyway)
            import secrets
            temp_password = secrets.token_urlsafe(32)

            response = await client.post(
                f"{self.nextcloud_url}/ocs/v2.php/cloud/users",
                auth=(self.admin_user, self.admin_password),
                headers={"OCS-APIREQUEST": "true"},
                data={
                    "userid": username,
                    "password": temp_password,
                    "displayName": display_name,
                    "email": username
                },
                params={"format": "json"}
            )

            if response.status_code in [200, 201]:
                logger.info(f"Created Nextcloud user: {username}")
                return True
            else:
                # Check if user already exists (status 102)
                try:
                    data = response.json()
                    if data.get('ocs', {}).get('meta', {}).get('statuscode') == 102:
                        logger.info(f"Nextcloud user already exists: {username}")
                        return True
                except:
                    pass
                logger.error(f"Failed to create Nextcloud user: {response.status_code} - {response.text}")
                return False

        except Exception as e:
            logger.error(f"Error creating Nextcloud user: {e}")
            return False

    async def _create_user_folder(self, client: httpx.AsyncClient, username: str) -> bool:
        """Create BheemDocs folder in user's Nextcloud space."""
        try:
            folder_url = f"{self.nextcloud_url}/remote.php/dav/files/{username}/BheemDocs"

            response = await client.request(
                method="MKCOL",
                url=folder_url,
                auth=(self.admin_user, self.admin_password)
            )

            if response.status_code in [201, 204, 405]:  # 405 = already exists
                logger.info(f"BheemDocs folder ready for user: {username}")
                return True
            else:
                logger.warning(f"Could not create BheemDocs folder: {response.status_code}")
                return False

        except Exception as e:
            logger.warning(f"Error creating user folder: {e}")
            return False

    async def _generate_app_password(
        self,
        client: httpx.AsyncClient,
        username: str
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Generate an app password for the user.

        Note: This uses admin impersonation to create app password.
        In production, you might want users to generate their own via UI.
        """
        try:
            # Use the Nextcloud app passwords API
            # This requires admin to impersonate the user or use provisioning API

            # Method 1: Try using provisioning API (Nextcloud 25+)
            response = await client.post(
                f"{self.nextcloud_url}/ocs/v2.php/core/apppassword",
                auth=(self.admin_user, self.admin_password),
                headers={
                    "OCS-APIREQUEST": "true",
                    "OCS-APIRequest": "true"
                },
                params={"format": "json"}
            )

            if response.status_code == 200:
                try:
                    data = response.json()
                    app_password = data.get('ocs', {}).get('data', {}).get('apppassword')
                    if app_password:
                        return app_password, None
                except:
                    pass

            # Method 2: Use a predetermined app password pattern
            # For Nextcloud, we'll create user with known credentials
            # and use those credentials directly

            # Since Nextcloud app password API requires user's own session,
            # we'll use a simpler approach: store the user's initial password
            # and use that for WebDAV operations

            # Generate a secure password for the user
            import secrets
            app_password = secrets.token_urlsafe(32)

            # Update the user's password to this known value
            response = await client.put(
                f"{self.nextcloud_url}/ocs/v2.php/cloud/users/{username}",
                auth=(self.admin_user, self.admin_password),
                headers={"OCS-APIREQUEST": "true"},
                data={
                    "key": "password",
                    "value": app_password
                },
                params={"format": "json"}
            )

            if response.status_code == 200:
                logger.info(f"Set password for Nextcloud user: {username}")
                return app_password, None
            else:
                logger.error(f"Failed to set user password: {response.status_code} - {response.text}")
                return None, None

        except Exception as e:
            logger.error(f"Error generating app password: {e}")
            return None, None

    async def _store_credentials(
        self,
        user_id: UUID,
        nextcloud_username: str,
        app_password: str,
        app_password_id: Optional[str]
    ) -> bool:
        """Store credentials in database."""
        try:
            conn = self._get_db_connection()
            cur = conn.cursor()

            cur.execute("""
                INSERT INTO workspace.nextcloud_credentials
                (user_id, nextcloud_username, app_password, app_password_id)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (user_id)
                DO UPDATE SET
                    nextcloud_username = EXCLUDED.nextcloud_username,
                    app_password = EXCLUDED.app_password,
                    app_password_id = EXCLUDED.app_password_id,
                    updated_at = NOW(),
                    is_active = true
            """, (str(user_id), nextcloud_username, app_password, app_password_id))

            conn.commit()
            cur.close()
            conn.close()

            return True

        except Exception as e:
            logger.error(f"Failed to store credentials: {e}")
            return False

    async def update_password(self, username: str, new_password: str) -> bool:
        """
        Update stored password after it's synced to Nextcloud.
        Called from auth flow when user's password is synced.
        """
        try:
            conn = self._get_db_connection()
            cur = conn.cursor()

            cur.execute("""
                UPDATE workspace.nextcloud_credentials
                SET app_password = %s, updated_at = NOW()
                WHERE nextcloud_username = %s AND is_active = true
            """, (new_password, username.lower()))

            rows_updated = cur.rowcount
            conn.commit()
            cur.close()
            conn.close()

            if rows_updated > 0:
                logger.info(f"Updated Nextcloud password for: {username}")
            return True

        except Exception as e:
            logger.error(f"Failed to update Nextcloud password: {e}")
            return False

    async def revoke_credentials(self, user_id: UUID) -> bool:
        """Revoke/deactivate user's Nextcloud credentials."""
        try:
            conn = self._get_db_connection()
            cur = conn.cursor()

            cur.execute("""
                UPDATE workspace.nextcloud_credentials
                SET is_active = false, updated_at = NOW()
                WHERE user_id = %s
            """, (str(user_id),))

            conn.commit()
            cur.close()
            conn.close()

            logger.info(f"Revoked Nextcloud credentials for user: {user_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to revoke credentials: {e}")
            return False


# Singleton instance
_nextcloud_credentials_service = None


def get_nextcloud_credentials_service() -> NextcloudCredentialsService:
    """Get singleton instance of NextcloudCredentialsService."""
    global _nextcloud_credentials_service
    if _nextcloud_credentials_service is None:
        _nextcloud_credentials_service = NextcloudCredentialsService()
    return _nextcloud_credentials_service
