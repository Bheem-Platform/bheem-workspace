"""
Bheem Workspace - Cloudflare Service
DNS management via Cloudflare API
"""
import httpx
from typing import List, Dict, Any, Optional
from core.config import settings


class CloudflareService:
    """Cloudflare API integration for DNS management"""

    def __init__(self):
        self.api_token = settings.CLOUDFLARE_API_TOKEN
        self.base_url = "https://api.cloudflare.com/client/v4"

    async def _request(
        self,
        method: str,
        endpoint: str,
        data: dict = None,
        params: dict = None
    ) -> Dict[str, Any]:
        """Make authenticated request to Cloudflare API"""
        async with httpx.AsyncClient() as client:
            url = f"{self.base_url}/{endpoint}"
            headers = {
                "Authorization": f"Bearer {self.api_token}",
                "Content-Type": "application/json"
            }

            try:
                if method == "GET":
                    response = await client.get(url, headers=headers, params=params)
                elif method == "POST":
                    response = await client.post(url, headers=headers, json=data)
                elif method == "PUT":
                    response = await client.put(url, headers=headers, json=data)
                elif method == "PATCH":
                    response = await client.patch(url, headers=headers, json=data)
                elif method == "DELETE":
                    response = await client.delete(url, headers=headers)
                else:
                    return {"success": False, "error": f"Unsupported method: {method}"}

                result = response.json()
                return result
            except Exception as e:
                return {"success": False, "error": str(e)}

    # ==================== Zone Management ====================

    async def list_zones(self, name: str = None) -> List[Dict[str, Any]]:
        """List all zones (domains) or filter by name"""
        params = {}
        if name:
            params["name"] = name

        result = await self._request("GET", "zones", params=params)

        if result.get("success"):
            return result.get("result", [])
        return []

    async def get_zone(self, zone_id: str) -> Dict[str, Any]:
        """Get zone details"""
        return await self._request("GET", f"zones/{zone_id}")

    async def get_zone_by_name(self, domain: str) -> Optional[Dict[str, Any]]:
        """Get zone by domain name"""
        zones = await self.list_zones(name=domain)
        return zones[0] if zones else None

    async def create_zone(self, name: str, account_id: str = None) -> Dict[str, Any]:
        """Create a new zone"""
        data = {"name": name, "jump_start": True}
        if account_id:
            data["account"] = {"id": account_id}

        return await self._request("POST", "zones", data)

    async def delete_zone(self, zone_id: str) -> Dict[str, Any]:
        """Delete a zone"""
        return await self._request("DELETE", f"zones/{zone_id}")

    # ==================== DNS Record Management ====================

    async def list_dns_records(
        self,
        zone_id: str,
        record_type: str = None,
        name: str = None
    ) -> List[Dict[str, Any]]:
        """List DNS records for a zone"""
        params = {}
        if record_type:
            params["type"] = record_type
        if name:
            params["name"] = name

        result = await self._request("GET", f"zones/{zone_id}/dns_records", params=params)

        if result.get("success"):
            return result.get("result", [])
        return []

    async def create_dns_record(
        self,
        zone_id: str,
        record_type: str,
        name: str,
        content: str,
        ttl: int = 3600,
        proxied: bool = False,
        priority: int = None
    ) -> Dict[str, Any]:
        """Create a DNS record"""
        data = {
            "type": record_type,
            "name": name,
            "content": content,
            "ttl": ttl,
            "proxied": proxied
        }

        if priority is not None and record_type == "MX":
            data["priority"] = priority

        return await self._request("POST", f"zones/{zone_id}/dns_records", data)

    async def update_dns_record(
        self,
        zone_id: str,
        record_id: str,
        record_type: str,
        name: str,
        content: str,
        ttl: int = 3600,
        proxied: bool = False,
        priority: int = None
    ) -> Dict[str, Any]:
        """Update a DNS record"""
        data = {
            "type": record_type,
            "name": name,
            "content": content,
            "ttl": ttl,
            "proxied": proxied
        }

        if priority is not None and record_type == "MX":
            data["priority"] = priority

        return await self._request("PUT", f"zones/{zone_id}/dns_records/{record_id}", data)

    async def delete_dns_record(self, zone_id: str, record_id: str) -> Dict[str, Any]:
        """Delete a DNS record"""
        return await self._request("DELETE", f"zones/{zone_id}/dns_records/{record_id}")

    async def get_dns_record(self, zone_id: str, record_id: str) -> Dict[str, Any]:
        """Get a specific DNS record"""
        return await self._request("GET", f"zones/{zone_id}/dns_records/{record_id}")

    # ==================== Bulk DNS Operations ====================

    async def create_mailgun_dns_records(
        self,
        zone_id: str,
        domain: str,
        mailgun_records: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Create all required DNS records for Mailgun domain verification"""
        results = {
            "success": [],
            "failed": []
        }

        for record in mailgun_records:
            record_type = record.get("record_type", record.get("type", "TXT"))
            name = record.get("name", domain)
            value = record.get("value", "")
            priority = record.get("priority")

            # Mailgun returns different field names
            if "valid" in record:
                # This is a verification status, not a record to create
                continue

            result = await self.create_dns_record(
                zone_id=zone_id,
                record_type=record_type,
                name=name,
                content=value,
                ttl=3600,
                proxied=False,
                priority=priority
            )

            if result.get("success"):
                results["success"].append({
                    "type": record_type,
                    "name": name,
                    "record_id": result.get("result", {}).get("id")
                })
            else:
                results["failed"].append({
                    "type": record_type,
                    "name": name,
                    "error": result.get("errors", [])
                })

        return results

    async def setup_email_dns(
        self,
        zone_id: str,
        domain: str,
        mail_server: str = "mxe.mailgun.org",
        spf_includes: List[str] = None
    ) -> Dict[str, Any]:
        """Set up standard email DNS records"""
        if spf_includes is None:
            spf_includes = ["mailgun.org"]

        records_to_create = [
            {
                "type": "MX",
                "name": domain,
                "content": mail_server,
                "priority": 10
            },
            {
                "type": "TXT",
                "name": domain,
                "content": f"v=spf1 include:{' include:'.join(spf_includes)} ~all"
            }
        ]

        results = {"success": [], "failed": []}

        for record in records_to_create:
            result = await self.create_dns_record(
                zone_id=zone_id,
                record_type=record["type"],
                name=record["name"],
                content=record["content"],
                priority=record.get("priority"),
                proxied=False
            )

            if result.get("success"):
                results["success"].append(record)
            else:
                results["failed"].append({
                    **record,
                    "error": result.get("errors", [])
                })

        return results

    # ==================== SSL/TLS ====================

    async def get_ssl_settings(self, zone_id: str) -> Dict[str, Any]:
        """Get SSL/TLS settings for zone"""
        return await self._request("GET", f"zones/{zone_id}/settings/ssl")

    async def set_ssl_mode(self, zone_id: str, mode: str = "full") -> Dict[str, Any]:
        """Set SSL mode: off, flexible, full, strict"""
        return await self._request("PATCH", f"zones/{zone_id}/settings/ssl", {"value": mode})

    # ==================== Page Rules ====================

    async def create_page_rule(
        self,
        zone_id: str,
        targets: List[Dict[str, Any]],
        actions: List[Dict[str, Any]],
        priority: int = 1,
        status: str = "active"
    ) -> Dict[str, Any]:
        """Create a page rule"""
        data = {
            "targets": targets,
            "actions": actions,
            "priority": priority,
            "status": status
        }
        return await self._request("POST", f"zones/{zone_id}/pagerules", data)

    async def list_page_rules(self, zone_id: str) -> List[Dict[str, Any]]:
        """List page rules for a zone"""
        result = await self._request("GET", f"zones/{zone_id}/pagerules")
        if result.get("success"):
            return result.get("result", [])
        return []

    # ==================== Verification ====================

    async def verify_dns_record(
        self,
        zone_id: str,
        record_type: str,
        name: str,
        expected_content: str
    ) -> bool:
        """Verify a DNS record exists with expected content"""
        records = await self.list_dns_records(
            zone_id=zone_id,
            record_type=record_type,
            name=name
        )

        for record in records:
            if expected_content in record.get("content", ""):
                return True
        return False

    async def get_nameservers(self, zone_id: str) -> List[str]:
        """Get assigned nameservers for a zone"""
        result = await self.get_zone(zone_id)
        if result.get("success"):
            return result.get("result", {}).get("name_servers", [])
        return []

    # ==================== Custom Hostnames (for SaaS) ====================

    async def create_custom_hostname(
        self,
        zone_id: str,
        hostname: str,
        ssl_method: str = "http"
    ) -> Dict[str, Any]:
        """Create a custom hostname for tenant subdomains"""
        data = {
            "hostname": hostname,
            "ssl": {
                "method": ssl_method,  # http, txt, email
                "type": "dv"
            }
        }
        return await self._request("POST", f"zones/{zone_id}/custom_hostnames", data)

    async def list_custom_hostnames(self, zone_id: str) -> List[Dict[str, Any]]:
        """List custom hostnames"""
        result = await self._request("GET", f"zones/{zone_id}/custom_hostnames")
        if result.get("success"):
            return result.get("result", [])
        return []

    async def delete_custom_hostname(
        self,
        zone_id: str,
        hostname_id: str
    ) -> Dict[str, Any]:
        """Delete a custom hostname"""
        return await self._request(
            "DELETE",
            f"zones/{zone_id}/custom_hostnames/{hostname_id}"
        )


# Singleton instance
cloudflare_service = CloudflareService()
