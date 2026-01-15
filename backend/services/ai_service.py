"""
Bheem Workspace - AI Service
Business logic for AI features (Bheem AI)
"""
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
import httpx
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func

from models.enterprise_models import AIConversation, AIUsageLog


class AIService:
    """Service for AI features"""

    def __init__(self, db: AsyncSession):
        self.db = db
        # In production, these would come from config
        self.ai_endpoint = "https://api.anthropic.com/v1/messages"  # Or OpenAI, etc.
        self.default_model = "claude-3-sonnet-20240229"

    # =============================================
    # AI Chat
    # =============================================

    async def chat(
        self,
        tenant_id: UUID,
        user_id: UUID,
        message: str,
        conversation_id: Optional[UUID] = None,
        context_type: Optional[str] = None,
        context_id: Optional[UUID] = None,
        context_data: Optional[Dict] = None,
        system_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send a message to AI and get response"""
        # Get or create conversation
        conversation = None
        if conversation_id:
            conversation = await self.get_conversation(conversation_id, user_id)

        if not conversation:
            conversation = await self.create_conversation(
                tenant_id=tenant_id,
                user_id=user_id,
                context_type=context_type,
                context_id=context_id
            )

        # Build messages for AI
        messages = conversation.messages or []
        messages.append({
            "role": "user",
            "content": message,
            "timestamp": datetime.utcnow().isoformat()
        })

        # Build system prompt with context
        full_system_prompt = self._build_system_prompt(
            system_prompt, context_type, context_data
        )

        # Call AI API
        start_time = datetime.utcnow()
        try:
            response = await self._call_ai_api(
                messages=[{"role": m["role"], "content": m["content"]} for m in messages],
                system_prompt=full_system_prompt
            )

            # Add AI response to messages
            messages.append({
                "role": "assistant",
                "content": response["content"],
                "timestamp": datetime.utcnow().isoformat()
            })

            # Update conversation
            conversation.messages = messages
            conversation.message_count = len(messages)
            conversation.total_tokens += response.get("total_tokens", 0)
            conversation.updated_at = datetime.utcnow()

            # Log usage
            await self._log_usage(
                tenant_id=tenant_id,
                user_id=user_id,
                feature="chat",
                context_type=context_type,
                context_id=context_id,
                input_tokens=response.get("input_tokens", 0),
                output_tokens=response.get("output_tokens", 0),
                model_used=response.get("model"),
                latency_ms=int((datetime.utcnow() - start_time).total_seconds() * 1000),
                success=True
            )

            await self.db.commit()

            return {
                "conversation_id": conversation.id,
                "response": response["content"],
                "tokens_used": response.get("total_tokens", 0)
            }

        except Exception as e:
            await self._log_usage(
                tenant_id=tenant_id,
                user_id=user_id,
                feature="chat",
                context_type=context_type,
                context_id=context_id,
                latency_ms=int((datetime.utcnow() - start_time).total_seconds() * 1000),
                success=False,
                error_message=str(e)
            )
            raise

    def _build_system_prompt(
        self,
        custom_prompt: Optional[str],
        context_type: Optional[str],
        context_data: Optional[Dict]
    ) -> str:
        """Build system prompt with context"""
        base_prompt = """You are Bheem AI, an intelligent assistant for Bheem Workspace.
You help users with their productivity tasks including email, documents, spreadsheets,
presentations, calendar, and more. Be helpful, concise, and professional."""

        if custom_prompt:
            base_prompt = custom_prompt

        if context_type and context_data:
            context_prompt = f"\n\nContext ({context_type}):\n{json.dumps(context_data, indent=2)}"
            base_prompt += context_prompt

        return base_prompt

    async def _call_ai_api(
        self,
        messages: List[Dict],
        system_prompt: str,
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        """Call the AI API (mock implementation)"""
        # In production, this would call actual AI API
        # For now, return a mock response
        return {
            "content": "I'm Bheem AI, your intelligent assistant. How can I help you today?",
            "model": model or self.default_model,
            "input_tokens": 100,
            "output_tokens": 50,
            "total_tokens": 150
        }

    # =============================================
    # Specialized AI Features
    # =============================================

    async def summarize(
        self,
        tenant_id: UUID,
        user_id: UUID,
        content: str,
        max_length: int = 200,
        context_type: Optional[str] = None,
        context_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """Summarize content"""
        prompt = f"""Summarize the following content in approximately {max_length} words.
Be concise and capture the key points.

Content:
{content}

Summary:"""

        start_time = datetime.utcnow()
        try:
            response = await self._call_ai_api(
                messages=[{"role": "user", "content": prompt}],
                system_prompt="You are a summarization assistant. Provide clear, concise summaries."
            )

            await self._log_usage(
                tenant_id=tenant_id,
                user_id=user_id,
                feature="summarize",
                context_type=context_type,
                context_id=context_id,
                input_tokens=response.get("input_tokens", 0),
                output_tokens=response.get("output_tokens", 0),
                model_used=response.get("model"),
                latency_ms=int((datetime.utcnow() - start_time).total_seconds() * 1000),
                success=True
            )

            return {
                "summary": response["content"],
                "tokens_used": response.get("total_tokens", 0)
            }
        except Exception as e:
            await self._log_usage(
                tenant_id=tenant_id,
                user_id=user_id,
                feature="summarize",
                success=False,
                error_message=str(e),
                latency_ms=int((datetime.utcnow() - start_time).total_seconds() * 1000)
            )
            raise

    async def translate(
        self,
        tenant_id: UUID,
        user_id: UUID,
        content: str,
        target_language: str,
        source_language: Optional[str] = None
    ) -> Dict[str, Any]:
        """Translate content"""
        source = f"from {source_language}" if source_language else ""
        prompt = f"""Translate the following text {source} to {target_language}.
Preserve the original formatting and tone.

Text:
{content}

Translation:"""

        start_time = datetime.utcnow()
        try:
            response = await self._call_ai_api(
                messages=[{"role": "user", "content": prompt}],
                system_prompt="You are a professional translator. Provide accurate translations."
            )

            await self._log_usage(
                tenant_id=tenant_id,
                user_id=user_id,
                feature="translate",
                input_tokens=response.get("input_tokens", 0),
                output_tokens=response.get("output_tokens", 0),
                model_used=response.get("model"),
                latency_ms=int((datetime.utcnow() - start_time).total_seconds() * 1000),
                success=True
            )

            return {
                "translation": response["content"],
                "target_language": target_language,
                "tokens_used": response.get("total_tokens", 0)
            }
        except Exception as e:
            await self._log_usage(
                tenant_id=tenant_id,
                user_id=user_id,
                feature="translate",
                success=False,
                error_message=str(e),
                latency_ms=int((datetime.utcnow() - start_time).total_seconds() * 1000)
            )
            raise

    async def compose(
        self,
        tenant_id: UUID,
        user_id: UUID,
        content_type: str,  # email, document, reply
        instructions: str,
        context: Optional[str] = None,
        tone: str = "professional"
    ) -> Dict[str, Any]:
        """Compose content using AI"""
        context_text = f"\n\nContext:\n{context}" if context else ""

        prompt = f"""Compose a {content_type} based on the following instructions.
Use a {tone} tone.

Instructions: {instructions}{context_text}

{content_type.capitalize()}:"""

        start_time = datetime.utcnow()
        try:
            response = await self._call_ai_api(
                messages=[{"role": "user", "content": prompt}],
                system_prompt=f"You are a professional writer. Compose high-quality {content_type}s."
            )

            await self._log_usage(
                tenant_id=tenant_id,
                user_id=user_id,
                feature="compose",
                input_tokens=response.get("input_tokens", 0),
                output_tokens=response.get("output_tokens", 0),
                model_used=response.get("model"),
                latency_ms=int((datetime.utcnow() - start_time).total_seconds() * 1000),
                success=True
            )

            return {
                "content": response["content"],
                "content_type": content_type,
                "tokens_used": response.get("total_tokens", 0)
            }
        except Exception as e:
            await self._log_usage(
                tenant_id=tenant_id,
                user_id=user_id,
                feature="compose",
                success=False,
                error_message=str(e),
                latency_ms=int((datetime.utcnow() - start_time).total_seconds() * 1000)
            )
            raise

    async def analyze(
        self,
        tenant_id: UUID,
        user_id: UUID,
        data: str,
        analysis_type: str = "general"  # general, sentiment, trends, insights
    ) -> Dict[str, Any]:
        """Analyze data using AI"""
        prompt = f"""Analyze the following data and provide {analysis_type} analysis.
Include key insights and recommendations.

Data:
{data}

Analysis:"""

        start_time = datetime.utcnow()
        try:
            response = await self._call_ai_api(
                messages=[{"role": "user", "content": prompt}],
                system_prompt="You are a data analyst. Provide clear, actionable insights."
            )

            await self._log_usage(
                tenant_id=tenant_id,
                user_id=user_id,
                feature="analyze",
                input_tokens=response.get("input_tokens", 0),
                output_tokens=response.get("output_tokens", 0),
                model_used=response.get("model"),
                latency_ms=int((datetime.utcnow() - start_time).total_seconds() * 1000),
                success=True
            )

            return {
                "analysis": response["content"],
                "analysis_type": analysis_type,
                "tokens_used": response.get("total_tokens", 0)
            }
        except Exception as e:
            await self._log_usage(
                tenant_id=tenant_id,
                user_id=user_id,
                feature="analyze",
                success=False,
                error_message=str(e),
                latency_ms=int((datetime.utcnow() - start_time).total_seconds() * 1000)
            )
            raise

    async def extract(
        self,
        tenant_id: UUID,
        user_id: UUID,
        content: str,
        extract_type: str  # dates, names, entities, action_items, etc.
    ) -> Dict[str, Any]:
        """Extract information from content"""
        prompt = f"""Extract all {extract_type} from the following content.
Return them in a structured format.

Content:
{content}

Extracted {extract_type}:"""

        start_time = datetime.utcnow()
        try:
            response = await self._call_ai_api(
                messages=[{"role": "user", "content": prompt}],
                system_prompt="You are an information extraction specialist."
            )

            await self._log_usage(
                tenant_id=tenant_id,
                user_id=user_id,
                feature="extract",
                input_tokens=response.get("input_tokens", 0),
                output_tokens=response.get("output_tokens", 0),
                model_used=response.get("model"),
                latency_ms=int((datetime.utcnow() - start_time).total_seconds() * 1000),
                success=True
            )

            return {
                "extracted": response["content"],
                "extract_type": extract_type,
                "tokens_used": response.get("total_tokens", 0)
            }
        except Exception as e:
            await self._log_usage(
                tenant_id=tenant_id,
                user_id=user_id,
                feature="extract",
                success=False,
                error_message=str(e),
                latency_ms=int((datetime.utcnow() - start_time).total_seconds() * 1000)
            )
            raise

    # =============================================
    # Conversation Management
    # =============================================

    async def create_conversation(
        self,
        tenant_id: UUID,
        user_id: UUID,
        title: Optional[str] = None,
        context_type: Optional[str] = None,
        context_id: Optional[UUID] = None
    ) -> AIConversation:
        """Create a new AI conversation"""
        conversation = AIConversation(
            tenant_id=tenant_id,
            user_id=user_id,
            title=title or "New Conversation",
            context_type=context_type,
            context_id=context_id,
            messages=[]
        )

        self.db.add(conversation)
        await self.db.commit()
        await self.db.refresh(conversation)
        return conversation

    async def get_conversation(
        self,
        conversation_id: UUID,
        user_id: UUID
    ) -> Optional[AIConversation]:
        """Get a conversation"""
        result = await self.db.execute(
            select(AIConversation).where(
                AIConversation.id == conversation_id,
                AIConversation.user_id == user_id
            )
        )
        return result.scalar_one_or_none()

    async def list_conversations(
        self,
        user_id: UUID,
        include_archived: bool = False,
        skip: int = 0,
        limit: int = 50
    ) -> List[AIConversation]:
        """List user conversations"""
        query = select(AIConversation).where(
            AIConversation.user_id == user_id
        )

        if not include_archived:
            query = query.where(AIConversation.is_archived == False)

        query = query.order_by(AIConversation.updated_at.desc())
        query = query.offset(skip).limit(limit)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def archive_conversation(
        self,
        conversation_id: UUID,
        user_id: UUID
    ) -> bool:
        """Archive a conversation"""
        result = await self.db.execute(
            update(AIConversation)
            .where(
                AIConversation.id == conversation_id,
                AIConversation.user_id == user_id
            )
            .values(is_archived=True)
        )
        await self.db.commit()
        return result.rowcount > 0

    async def delete_conversation(
        self,
        conversation_id: UUID,
        user_id: UUID
    ) -> bool:
        """Delete a conversation"""
        result = await self.db.execute(
            delete(AIConversation).where(
                AIConversation.id == conversation_id,
                AIConversation.user_id == user_id
            )
        )
        await self.db.commit()
        return result.rowcount > 0

    # =============================================
    # Usage Logging & Analytics
    # =============================================

    async def _log_usage(
        self,
        tenant_id: UUID,
        user_id: UUID,
        feature: str,
        context_type: Optional[str] = None,
        context_id: Optional[UUID] = None,
        input_tokens: int = 0,
        output_tokens: int = 0,
        model_used: Optional[str] = None,
        latency_ms: int = 0,
        success: bool = True,
        error_message: Optional[str] = None
    ):
        """Log AI usage"""
        log = AIUsageLog(
            tenant_id=tenant_id,
            user_id=user_id,
            feature=feature,
            context_type=context_type,
            context_id=context_id,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            model_used=model_used,
            latency_ms=latency_ms,
            success=success,
            error_message=error_message
        )
        self.db.add(log)

    async def get_usage_stats(
        self,
        tenant_id: UUID,
        user_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """Get AI usage statistics"""
        query = select(
            func.count(AIUsageLog.id).label('total_requests'),
            func.sum(AIUsageLog.input_tokens).label('total_input_tokens'),
            func.sum(AIUsageLog.output_tokens).label('total_output_tokens'),
            func.avg(AIUsageLog.latency_ms).label('avg_latency_ms')
        ).where(
            AIUsageLog.tenant_id == tenant_id,
            AIUsageLog.success == True
        )

        if user_id:
            query = query.where(AIUsageLog.user_id == user_id)

        result = await self.db.execute(query)
        row = result.one()

        # Feature breakdown
        feature_query = select(
            AIUsageLog.feature,
            func.count(AIUsageLog.id)
        ).where(
            AIUsageLog.tenant_id == tenant_id
        ).group_by(AIUsageLog.feature)

        if user_id:
            feature_query = feature_query.where(AIUsageLog.user_id == user_id)

        feature_result = await self.db.execute(feature_query)
        feature_counts = dict(feature_result.all())

        return {
            'total_requests': row.total_requests or 0,
            'total_input_tokens': row.total_input_tokens or 0,
            'total_output_tokens': row.total_output_tokens or 0,
            'total_tokens': (row.total_input_tokens or 0) + (row.total_output_tokens or 0),
            'avg_latency_ms': round(row.avg_latency_ms or 0, 2),
            'by_feature': feature_counts
        }
