"""
Email Marketing Tools - Email campaigns and automation
"""

from typing import Dict, Any, List, Optional
from ..api_base import APIToolSet, ToolResult


class EmailTools(APIToolSet):
    """Tools for email marketing"""

    def __init__(self, base_url: str, auth_token: str = None):
        super().__init__(base_url, auth_token)

    async def create_campaign(self, name: str, subject: str, content: str,
                             from_name: str, from_email: str, list_id: str) -> ToolResult:
        """Create email campaign"""
        return await self._post("/email/campaigns", {
            "name": name, "subject": subject, "content": content,
            "from_name": from_name, "from_email": from_email, "list_id": list_id
        })

    async def send_campaign(self, campaign_id: str, scheduled_time: str = None) -> ToolResult:
        """Send or schedule campaign"""
        return await self._post(f"/email/campaigns/{campaign_id}/send", {
            "scheduled_time": scheduled_time
        })

    async def get_campaign_stats(self, campaign_id: str) -> ToolResult:
        """Get campaign statistics"""
        return await self._get(f"/email/campaigns/{campaign_id}/stats")

    async def list_campaigns(self, status: str = None, page: int = 1, limit: int = 20) -> ToolResult:
        """List email campaigns"""
        params = {"page": page, "limit": limit}
        if status: params["status"] = status
        return await self._get("/email/campaigns", params)

    async def create_list(self, name: str, description: str = None) -> ToolResult:
        """Create email list"""
        return await self._post("/email/lists", {"name": name, "description": description})

    async def add_subscribers(self, list_id: str, subscribers: List[Dict]) -> ToolResult:
        """Add subscribers to list"""
        return await self._post(f"/email/lists/{list_id}/subscribers", {"subscribers": subscribers})

    async def remove_subscriber(self, list_id: str, email: str) -> ToolResult:
        """Remove subscriber from list"""
        return await self._delete(f"/email/lists/{list_id}/subscribers/{email}")

    async def get_list_stats(self, list_id: str) -> ToolResult:
        """Get list statistics"""
        return await self._get(f"/email/lists/{list_id}/stats")

    async def create_automation(self, name: str, trigger: Dict, emails: List[Dict]) -> ToolResult:
        """Create email automation sequence"""
        return await self._post("/email/automations", {
            "name": name, "trigger": trigger, "emails": emails
        })

    async def get_automation_stats(self, automation_id: str) -> ToolResult:
        """Get automation statistics"""
        return await self._get(f"/email/automations/{automation_id}/stats")

    async def test_email(self, campaign_id: str, test_emails: List[str]) -> ToolResult:
        """Send test email"""
        return await self._post(f"/email/campaigns/{campaign_id}/test", {"emails": test_emails})

    async def generate_subject_lines(self, topic: str, count: int = 5) -> ToolResult:
        """Generate email subject lines"""
        return await self._post("/email/subjects/generate", {"topic": topic, "count": count})

    async def execute_tool(self, tool_name: str, **kwargs) -> ToolResult:
        method = getattr(self, tool_name, None)
        if method:
            return await method(**kwargs)
        return ToolResult(success=False, error=f"Unknown tool: {tool_name}")
