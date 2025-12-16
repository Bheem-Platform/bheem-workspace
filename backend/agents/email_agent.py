"""
Email Agent - Email marketing management
"""

import json
import logging
from typing import Dict, Any

from ..base_agent import BaseAgent
from ...tools.socialselling.email_tools import EmailTools

logger = logging.getLogger(__name__)


class EmailAgent(BaseAgent):
    """Email Agent for email marketing"""

    agent_type = "email_agent"
    available_tools = [
        "create_campaign", "send_campaign", "get_campaign_stats", "list_campaigns",
        "create_list", "add_subscribers", "remove_subscriber", "get_list_stats",
        "create_automation", "get_automation_stats", "test_email", "generate_subject_lines"
    ]

    def __init__(self, model_router, workspace_id: str = "default",
                 backend_url: str = "http://localhost:8030", auth_token: str = None):
        super().__init__(model_router, workspace_id)
        self.backend_url = backend_url
        self.tools = EmailTools(f"{backend_url}/api/v1", auth_token)

    async def execute_tool(self, tool_name: str, inputs: Dict[str, Any]) -> Dict[str, Any]:
        logger.info(f"Executing Email tool: {tool_name}")
        result = await self.tools.execute_tool(tool_name, **inputs)
        if result.success:
            return result.output
        raise Exception(f"Tool {tool_name} failed: {result.error}")

    async def synthesize_results(self, tool_results: Dict[str, Any], goal: str) -> Dict[str, Any]:
        prompt = f"""Analyze email marketing results.
Goal: {goal}
Results: {json.dumps(tool_results, indent=2, default=str)}

Respond in JSON:
{{"summary": "brief summary", "emails_sent": 0, "open_rate": 0,
"click_rate": 0, "unsubscribe_rate": 0, "recommendations": []}}"""

        response = await self.model_router.complete(prompt=prompt, model='claude', temperature=0.3)
        try:
            text = response.content
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            return json.loads(text)
        except:
            return {"summary": response.content, "status": "unknown"}
