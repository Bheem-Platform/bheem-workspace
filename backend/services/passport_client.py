"""
Bheem Passport Client for Workspace
HTTP client for communicating with Bheem Passport centralized authentication service
"""

import httpx
from typing import Optional, Dict, Any
from fastapi import HTTPException, status
import os
from datetime import datetime


class BheemPassportClient:
    """Client for interacting with Bheem Passport service"""

    def __init__(self, base_url: Optional[str] = None):
        self.base_url = base_url or os.getenv("BHEEM_PASSPORT_URL", "https://platform.bheem.co.uk")
        self.timeout = 15.0

    async def login(
        self,
        username: str,
        password: str,
        company_code: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Authenticate user with Bheem Passport

        Args:
            username: Username or email
            password: User password
            company_code: Optional company code

        Returns:
            Dict containing access_token, refresh_token, and user info
        """
        url = f"{self.base_url}/api/v1/auth/login"

        headers = {}
        if company_code:
            headers["X-Company-Code"] = company_code

        # OAuth2PasswordRequestForm format
        form_data = {
            "username": username,
            "password": password
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    url,
                    data=form_data,
                    headers=headers
                )

                if response.status_code == 401:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid credentials"
                    )
                elif response.status_code == 403:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Account is inactive or banned"
                    )
                elif response.status_code != 200:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Authentication service error: {response.text}"
                    )

                return response.json()

        except httpx.TimeoutException:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication service timeout"
            )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Cannot connect to authentication service: {str(e)}"
            )

    async def validate_token(self, token: str) -> Dict[str, Any]:
        """
        Validate a JWT token with Bheem Passport

        Args:
            token: JWT access token

        Returns:
            Dict containing validation result and payload
        """
        url = f"{self.base_url}/api/v1/auth/validate"

        payload = {"token": token}

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, json=payload)

                if response.status_code == 401:
                    return {"valid": False, "error": "Invalid or expired token"}
                elif response.status_code != 200:
                    return {"valid": False, "error": f"Validation error: {response.text}"}

                return response.json()

        except httpx.TimeoutException:
            return {"valid": False, "error": "Authentication service timeout"}
        except httpx.RequestError as e:
            return {"valid": False, "error": f"Cannot connect to authentication service: {str(e)}"}

    async def refresh_token(self, refresh_token: str) -> Dict[str, Any]:
        """
        Refresh access token using refresh token

        Args:
            refresh_token: JWT refresh token

        Returns:
            Dict containing new access_token and refresh_token
        """
        url = f"{self.base_url}/api/v1/auth/refresh"

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    url,
                    params={"refresh_token": refresh_token}
                )

                if response.status_code == 401:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid refresh token"
                    )
                elif response.status_code == 403:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="User account is inactive"
                    )
                elif response.status_code != 200:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Token refresh error: {response.text}"
                    )

                return response.json()

        except httpx.TimeoutException:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication service timeout"
            )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Cannot connect to authentication service: {str(e)}"
            )

    async def get_current_user(self, token: str) -> Dict[str, Any]:
        """
        Get current user information from token

        Args:
            token: JWT access token

        Returns:
            Dict containing user information from token payload
        """
        url = f"{self.base_url}/api/v1/auth/me"

        headers = {"Authorization": f"Bearer {token}"}

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url, headers=headers)

                if response.status_code == 401:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid or expired token"
                    )
                elif response.status_code != 200:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"User info error: {response.text}"
                    )

                return response.json()

        except httpx.TimeoutException:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication service timeout"
            )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Cannot connect to authentication service: {str(e)}"
            )

    async def register(
        self,
        username: str,
        password: str,
        role: str = "Customer",
        company_code: str = "BHM001"
    ) -> Dict[str, Any]:
        """
        Register a new user with Bheem Passport

        Args:
            username: Unique username (usually email)
            password: User password
            role: User role (Customer, Employee, Admin, SuperAdmin)
            company_code: Company code

        Returns:
            Dict containing user information
        """
        url = f"{self.base_url}/api/v1/auth/register"

        payload = {
            "username": username,
            "password": password,
            "role": role,
            "company_code": company_code
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, json=payload)

                if response.status_code == 400:
                    error_detail = response.json().get("detail", "Registration failed")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=error_detail
                    )
                elif response.status_code != 200:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Registration service error: {response.text}"
                    )

                return response.json()

        except httpx.TimeoutException:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication service timeout"
            )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Cannot connect to authentication service: {str(e)}"
            )

    async def change_password(
        self,
        token: str,
        old_password: str,
        new_password: str
    ) -> Dict[str, Any]:
        """
        Change user password

        Args:
            token: JWT access token
            old_password: Current password
            new_password: New password

        Returns:
            Dict containing success message
        """
        url = f"{self.base_url}/api/v1/auth/change-password"

        headers = {"Authorization": f"Bearer {token}"}
        payload = {
            "old_password": old_password,
            "new_password": new_password
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, json=payload, headers=headers)

                if response.status_code == 400:
                    error_detail = response.json().get("detail", "Password change failed")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=error_detail
                    )
                elif response.status_code == 401:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid or expired token"
                    )
                elif response.status_code != 200:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Password change error: {response.text}"
                    )

                return response.json()

        except httpx.TimeoutException:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication service timeout"
            )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Cannot connect to authentication service: {str(e)}"
            )

    async def request_password_reset(self, email: str, company_code: str = "BHM001") -> Dict[str, Any]:
        """
        Request password reset from Bheem Passport

        Args:
            email: User email address
            company_code: Company code

        Returns:
            Dict containing success message
        """
        url = f"{self.base_url}/api/v1/auth/password/reset/request"

        payload = {
            "email": email,
            "company_code": company_code
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, json=payload)

                if response.status_code != 200:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Password reset request error: {response.text}"
                    )

                return response.json()

        except httpx.TimeoutException:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication service timeout"
            )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Cannot connect to authentication service: {str(e)}"
            )

    async def get_companies(self) -> Dict[str, Any]:
        """
        Get list of available companies

        Returns:
            Dict containing list of companies
        """
        url = f"{self.base_url}/api/v1/auth/companies"

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url)

                if response.status_code != 200:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Companies list error: {response.text}"
                    )

                return response.json()

        except httpx.TimeoutException:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication service timeout"
            )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Cannot connect to authentication service: {str(e)}"
            )

    async def health_check(self) -> bool:
        """
        Check if Bheem Passport service is healthy

        Returns:
            True if service is healthy, False otherwise
        """
        url = f"{self.base_url}/health"

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(url)
                return response.status_code == 200
        except Exception:
            return False


# Singleton instance
_passport_client: Optional[BheemPassportClient] = None


def get_passport_client() -> BheemPassportClient:
    """Get or create BheemPassportClient singleton instance"""
    global _passport_client
    if _passport_client is None:
        _passport_client = BheemPassportClient()
    return _passport_client
