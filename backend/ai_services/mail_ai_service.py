"""
Bheem Mail AI Service
AI-powered email features using LLM
"""

import json
import httpx
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from core.config import settings


class ComposeRequest(BaseModel):
    prompt: str
    tone: str = "professional"  # professional, friendly, formal, casual, urgent
    context: Optional[str] = None


class RewriteRequest(BaseModel):
    content: str
    tone: str = "professional"


class SummarizeRequest(BaseModel):
    content: str
    max_length: int = 200


class SmartReplyRequest(BaseModel):
    email_content: str
    sender_name: str
    count: int = 3


class MailAIService:
    """AI-powered email assistant using Anthropic Claude"""

    def __init__(self):
        self.api_key = getattr(settings, 'ANTHROPIC_API_KEY', None) or getattr(settings, 'OPENAI_API_KEY', None)
        self.model = "claude-3-haiku-20240307"  # Fast and cost-effective
        self.api_url = "https://api.anthropic.com/v1/messages"

    async def _call_llm(self, system_prompt: str, user_prompt: str, max_tokens: int = 1024) -> str:
        """Call the LLM API"""
        if not self.api_key:
            # Fallback to simple templates if no API key
            return self._fallback_response(user_prompt)

        headers = {
            "Content-Type": "application/json",
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01"
        }

        payload = {
            "model": self.model,
            "max_tokens": max_tokens,
            "system": system_prompt,
            "messages": [
                {"role": "user", "content": user_prompt}
            ]
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(self.api_url, headers=headers, json=payload)
            if response.status_code == 200:
                data = response.json()
                return data["content"][0]["text"]
            else:
                raise Exception(f"LLM API error: {response.status_code}")

    def _fallback_response(self, prompt: str) -> str:
        """Simple fallback when no API key is available"""
        return "AI features require an API key. Please configure ANTHROPIC_API_KEY in settings."

    async def compose_email(self, request: ComposeRequest) -> Dict[str, str]:
        """Generate an email from a prompt"""
        tone_instructions = {
            "professional": "Use a professional and business-appropriate tone.",
            "friendly": "Use a warm, friendly, and approachable tone.",
            "formal": "Use a formal and highly respectful tone.",
            "casual": "Use a casual and conversational tone.",
            "urgent": "Convey urgency while remaining professional."
        }

        system_prompt = f"""You are an expert email writer. Write emails that are clear, concise, and effective.
{tone_instructions.get(request.tone, tone_instructions['professional'])}

IMPORTANT: Respond ONLY with valid JSON in this exact format:
{{"subject": "Email subject line", "body": "Full email body"}}

Do not include any other text, explanation, or markdown formatting."""

        user_prompt = f"Write an email based on this request: {request.prompt}"
        if request.context:
            user_prompt += f"\n\nContext from previous email:\n{request.context}"

        response = await self._call_llm(system_prompt, user_prompt)

        try:
            # Try to parse JSON response
            result = json.loads(response)
            return {"subject": result.get("subject", ""), "body": result.get("body", "")}
        except json.JSONDecodeError:
            # If not valid JSON, extract subject and body manually
            lines = response.strip().split('\n')
            subject = ""
            body = response

            for i, line in enumerate(lines):
                if line.lower().startswith('subject:'):
                    subject = line.replace('Subject:', '').replace('subject:', '').strip()
                    body = '\n'.join(lines[i+1:]).strip()
                    break

            return {"subject": subject, "body": body}

    async def rewrite_email(self, request: RewriteRequest) -> Dict[str, str]:
        """Rewrite an email with a different tone"""
        tone_instructions = {
            "professional": "Rewrite to be professional and business-appropriate.",
            "friendly": "Rewrite to be warm and friendly.",
            "formal": "Rewrite to be formal and respectful.",
            "casual": "Rewrite to be casual and conversational.",
            "urgent": "Rewrite to convey urgency.",
            "shorter": "Make it more concise while keeping the key points.",
            "longer": "Expand with more detail and context."
        }

        system_prompt = f"""You are an expert email editor.
{tone_instructions.get(request.tone, tone_instructions['professional'])}

Respond with ONLY the rewritten email text, no explanations."""

        response = await self._call_llm(system_prompt, f"Rewrite this email:\n\n{request.content}")
        return {"body": response.strip()}

    async def summarize_email(self, request: SummarizeRequest) -> Dict[str, Any]:
        """Summarize an email and extract key points"""
        system_prompt = """You are an email summarization expert.
Analyze the email and provide:
1. A brief summary (1-2 sentences)
2. Key points (bullet points)
3. Action items (if any)
4. Sentiment (positive, neutral, negative)

Respond in JSON format:
{"summary": "...", "key_points": ["..."], "action_items": ["..."], "sentiment": "neutral"}"""

        response = await self._call_llm(system_prompt, f"Summarize this email:\n\n{request.content}")

        try:
            return json.loads(response)
        except json.JSONDecodeError:
            return {
                "summary": response[:request.max_length],
                "key_points": [],
                "action_items": [],
                "sentiment": "neutral"
            }

    async def generate_smart_replies(self, request: SmartReplyRequest) -> Dict[str, List[str]]:
        """Generate smart reply suggestions"""
        system_prompt = f"""You are an email assistant. Generate {request.count} short, natural reply options.
Each reply should be 1-2 sentences. Vary the responses:
- One positive/agreeing response
- One neutral/acknowledgment response
- One that requests more information or time

Respond in JSON format:
{{"replies": ["Reply 1", "Reply 2", "Reply 3"]}}"""

        user_prompt = f"Generate reply suggestions for this email from {request.sender_name}:\n\n{request.email_content}"

        response = await self._call_llm(system_prompt, user_prompt)

        try:
            result = json.loads(response)
            return {"replies": result.get("replies", [])}
        except json.JSONDecodeError:
            # Fallback generic replies
            return {
                "replies": [
                    "Thanks for your email. I'll review this and get back to you.",
                    "Got it, thanks for letting me know.",
                    "Thanks! Let me look into this and follow up shortly."
                ]
            }

    async def categorize_email(self, content: str, sender: str) -> Dict[str, Any]:
        """Categorize email by importance and type"""
        system_prompt = """Analyze this email and categorize it.

Respond in JSON format:
{
    "priority": "high|normal|low",
    "category": "work|personal|newsletter|promotional|social|transactional",
    "is_spam": false,
    "requires_response": true,
    "suggested_labels": ["label1", "label2"]
}"""

        user_prompt = f"From: {sender}\n\n{content}"
        response = await self._call_llm(system_prompt, user_prompt)

        try:
            return json.loads(response)
        except json.JSONDecodeError:
            return {
                "priority": "normal",
                "category": "work",
                "is_spam": False,
                "requires_response": True,
                "suggested_labels": []
            }

    async def extract_action_items(self, content: str) -> Dict[str, List[str]]:
        """Extract action items and deadlines from email"""
        system_prompt = """Extract action items from this email.
Look for tasks, requests, deadlines, and follow-ups.

Respond in JSON format:
{
    "action_items": [
        {"task": "Description", "deadline": "date or null", "assignee": "person or null"}
    ],
    "deadlines": ["Dec 15: Submit report"],
    "questions_asked": ["What is the budget?"]
}"""

        response = await self._call_llm(system_prompt, f"Extract action items:\n\n{content}")

        try:
            return json.loads(response)
        except json.JSONDecodeError:
            return {"action_items": [], "deadlines": [], "questions_asked": []}

    async def check_grammar_tone(self, content: str) -> Dict[str, Any]:
        """Check grammar and tone of email draft"""
        system_prompt = """Review this email draft for:
1. Grammar and spelling errors
2. Tone appropriateness
3. Clarity and conciseness
4. Professionalism

Respond in JSON format:
{
    "score": 85,
    "tone": "professional",
    "issues": [{"type": "grammar", "text": "original", "suggestion": "corrected"}],
    "suggestions": ["Consider adding a greeting"]
}"""

        response = await self._call_llm(system_prompt, f"Review this email:\n\n{content}")

        try:
            return json.loads(response)
        except json.JSONDecodeError:
            return {"score": 80, "tone": "professional", "issues": [], "suggestions": []}

    async def generate_subject_lines(self, body: str, count: int = 3) -> Dict[str, List[str]]:
        """Generate subject line suggestions for email"""
        system_prompt = f"""Generate {count} effective email subject lines for this email body.
Subject lines should be:
- Clear and descriptive
- Under 60 characters
- Action-oriented when appropriate

Respond in JSON: {{"subjects": ["Subject 1", "Subject 2", "Subject 3"]}}"""

        response = await self._call_llm(system_prompt, f"Generate subjects for:\n\n{body}")

        try:
            return json.loads(response)
        except json.JSONDecodeError:
            return {"subjects": ["Re: Your message", "Follow up", "Quick question"]}


# Singleton instance
mail_ai_service = MailAIService()
