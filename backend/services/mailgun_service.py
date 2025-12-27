"""
Bheem Workspace - Mailgun Service
Domain management and transactional email via Mailgun API
"""
import httpx
from typing import List, Dict, Any, Optional
from datetime import datetime
from core.config import settings


class MailgunService:
    """Mailgun API integration for domain management and email sending"""

    def __init__(self):
        self.api_key = settings.MAILGUN_API_KEY
        self.base_url = "https://api.eu.mailgun.net/v3"  # EU region
        self.domain = settings.MAILGUN_DOMAIN
        self.from_name = settings.MAILGUN_FROM_NAME
        self.from_email = settings.MAILGUN_FROM_EMAIL

    async def _request(
        self,
        method: str,
        endpoint: str,
        data: dict = None,
        json_body: bool = False
    ) -> Dict[str, Any]:
        """Make authenticated request to Mailgun API"""
        async with httpx.AsyncClient() as client:
            url = f"{self.base_url}/{endpoint}"
            auth = ("api", self.api_key)

            try:
                if method == "GET":
                    response = await client.get(url, auth=auth, params=data)
                elif method == "POST":
                    if json_body:
                        response = await client.post(url, auth=auth, json=data)
                    else:
                        response = await client.post(url, auth=auth, data=data)
                elif method == "PUT":
                    response = await client.put(url, auth=auth, data=data)
                elif method == "DELETE":
                    response = await client.delete(url, auth=auth)
                else:
                    return {"error": f"Unsupported method: {method}"}

                if response.status_code in [200, 201]:
                    return response.json()
                else:
                    return {
                        "error": response.text,
                        "status_code": response.status_code
                    }
            except Exception as e:
                return {"error": str(e)}

    # ==================== Domain Management ====================

    async def add_domain(self, domain: str, smtp_password: str = None) -> Dict[str, Any]:
        """Add a new domain to Mailgun"""
        data = {
            "name": domain,
            "web_scheme": "https"
        }
        if smtp_password:
            data["smtp_password"] = smtp_password

        # Use domains endpoint (not under base domain)
        async with httpx.AsyncClient() as client:
            url = "https://api.eu.mailgun.net/v4/domains"
            auth = ("api", self.api_key)

            try:
                response = await client.post(url, auth=auth, data=data)
                if response.status_code in [200, 201]:
                    return response.json()
                return {"error": response.text, "status_code": response.status_code}
            except Exception as e:
                return {"error": str(e)}

    async def get_domain(self, domain: str) -> Dict[str, Any]:
        """Get domain details including DNS records"""
        async with httpx.AsyncClient() as client:
            url = f"https://api.eu.mailgun.net/v4/domains/{domain}"
            auth = ("api", self.api_key)

            try:
                response = await client.get(url, auth=auth)
                if response.status_code == 200:
                    return response.json()
                return {"error": response.text, "status_code": response.status_code}
            except Exception as e:
                return {"error": str(e)}

    async def verify_domain(self, domain: str) -> Dict[str, Any]:
        """Verify domain DNS records"""
        async with httpx.AsyncClient() as client:
            url = f"https://api.eu.mailgun.net/v4/domains/{domain}/verify"
            auth = ("api", self.api_key)

            try:
                response = await client.put(url, auth=auth)
                if response.status_code == 200:
                    return response.json()
                return {"error": response.text, "status_code": response.status_code}
            except Exception as e:
                return {"error": str(e)}

    async def delete_domain(self, domain: str) -> Dict[str, Any]:
        """Delete a domain from Mailgun"""
        async with httpx.AsyncClient() as client:
            url = f"https://api.eu.mailgun.net/v4/domains/{domain}"
            auth = ("api", self.api_key)

            try:
                response = await client.delete(url, auth=auth)
                if response.status_code in [200, 204]:
                    return {"success": True}
                return {"error": response.text, "status_code": response.status_code}
            except Exception as e:
                return {"error": str(e)}

    async def list_domains(self) -> List[Dict[str, Any]]:
        """List all domains"""
        async with httpx.AsyncClient() as client:
            url = "https://api.eu.mailgun.net/v4/domains"
            auth = ("api", self.api_key)

            try:
                response = await client.get(url, auth=auth)
                if response.status_code == 200:
                    data = response.json()
                    return data.get("items", [])
                return []
            except Exception as e:
                print(f"Mailgun list domains error: {e}")
                return []

    async def get_dns_records(self, domain: str) -> Dict[str, Any]:
        """Get required DNS records for domain verification"""
        domain_info = await self.get_domain(domain)

        if "error" in domain_info:
            return domain_info

        records = {
            "sending_dns_records": domain_info.get("sending_dns_records", []),
            "receiving_dns_records": domain_info.get("receiving_dns_records", []),
            "domain_state": domain_info.get("domain", {}).get("state", "unknown")
        }

        return records

    # ==================== Email Sending ====================

    async def send_email(
        self,
        to: List[str],
        subject: str,
        html: str = None,
        text: str = None,
        from_email: str = None,
        from_name: str = None,
        cc: List[str] = None,
        bcc: List[str] = None,
        reply_to: str = None,
        tags: List[str] = None,
        variables: Dict[str, str] = None,
        domain: str = None
    ) -> Dict[str, Any]:
        """Send an email via Mailgun"""
        send_domain = domain or self.domain
        sender_email = from_email or self.from_email
        sender_name = from_name or self.from_name

        data = {
            "from": f"{sender_name} <{sender_email}>",
            "to": to,
            "subject": subject
        }

        if html:
            data["html"] = html
        if text:
            data["text"] = text
        if cc:
            data["cc"] = cc
        if bcc:
            data["bcc"] = bcc
        if reply_to:
            data["h:Reply-To"] = reply_to
        if tags:
            data["o:tag"] = tags

        # Add recipient variables for personalization
        if variables:
            import json
            data["recipient-variables"] = json.dumps(variables)

        return await self._request("POST", f"{send_domain}/messages", data)

    async def send_template_email(
        self,
        to: List[str],
        template: str,
        variables: Dict[str, Any],
        subject: str = None,
        from_email: str = None,
        domain: str = None
    ) -> Dict[str, Any]:
        """Send email using a Mailgun template"""
        send_domain = domain or self.domain

        data = {
            "from": from_email or f"{self.from_name} <{self.from_email}>",
            "to": to,
            "template": template,
            "h:X-Mailgun-Variables": str(variables)
        }

        if subject:
            data["subject"] = subject

        return await self._request("POST", f"{send_domain}/messages", data)

    # ==================== Webhooks ====================

    async def create_webhook(
        self,
        domain: str,
        event: str,
        url: str
    ) -> Dict[str, Any]:
        """Create a webhook for domain events"""
        data = {
            "id": event,
            "url": url
        }
        return await self._request("POST", f"domains/{domain}/webhooks", data)

    async def list_webhooks(self, domain: str) -> Dict[str, Any]:
        """List all webhooks for a domain"""
        return await self._request("GET", f"domains/{domain}/webhooks")

    async def delete_webhook(self, domain: str, event: str) -> Dict[str, Any]:
        """Delete a webhook"""
        async with httpx.AsyncClient() as client:
            url = f"{self.base_url}/domains/{domain}/webhooks/{event}"
            auth = ("api", self.api_key)

            try:
                response = await client.delete(url, auth=auth)
                if response.status_code in [200, 204]:
                    return {"success": True}
                return {"error": response.text}
            except Exception as e:
                return {"error": str(e)}

    # ==================== Stats & Logs ====================

    async def get_stats(
        self,
        domain: str = None,
        event: str = "accepted",
        duration: str = "1m"
    ) -> Dict[str, Any]:
        """Get domain statistics"""
        target_domain = domain or self.domain

        params = {
            "event": event,
            "duration": duration
        }

        return await self._request("GET", f"{target_domain}/stats/total", params)

    async def get_events(
        self,
        domain: str = None,
        event: str = None,
        limit: int = 100
    ) -> Dict[str, Any]:
        """Get email events/logs"""
        target_domain = domain or self.domain

        params = {"limit": limit}
        if event:
            params["event"] = event

        return await self._request("GET", f"{target_domain}/events", params)

    # ==================== Mailing Lists ====================

    async def create_mailing_list(
        self,
        address: str,
        name: str = None,
        description: str = None,
        access_level: str = "readonly"
    ) -> Dict[str, Any]:
        """Create a mailing list"""
        data = {
            "address": address,
            "access_level": access_level  # readonly, members, everyone
        }
        if name:
            data["name"] = name
        if description:
            data["description"] = description

        return await self._request("POST", "lists", data)

    async def add_list_member(
        self,
        list_address: str,
        member_email: str,
        name: str = None,
        subscribed: bool = True
    ) -> Dict[str, Any]:
        """Add a member to a mailing list"""
        data = {
            "address": member_email,
            "subscribed": "yes" if subscribed else "no"
        }
        if name:
            data["name"] = name

        return await self._request("POST", f"lists/{list_address}/members", data)

    async def remove_list_member(
        self,
        list_address: str,
        member_email: str
    ) -> Dict[str, Any]:
        """Remove a member from a mailing list"""
        async with httpx.AsyncClient() as client:
            url = f"{self.base_url}/lists/{list_address}/members/{member_email}"
            auth = ("api", self.api_key)

            try:
                response = await client.delete(url, auth=auth)
                if response.status_code in [200, 204]:
                    return {"success": True}
                return {"error": response.text}
            except Exception as e:
                return {"error": str(e)}

    # ==================== Routes ====================

    async def create_route(
        self,
        expression: str,
        actions: List[str],
        description: str = None,
        priority: int = 0
    ) -> Dict[str, Any]:
        """Create an email route/rule"""
        data = {
            "priority": priority,
            "expression": expression,
            "action": actions
        }
        if description:
            data["description"] = description

        return await self._request("POST", "routes", data)

    async def list_routes(self) -> Dict[str, Any]:
        """List all routes"""
        return await self._request("GET", "routes")


# Singleton instance
mailgun_service = MailgunService()
