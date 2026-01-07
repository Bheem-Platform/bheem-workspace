"""
Bheem Docs - AI & Smart Features Service
=========================================
AI-powered document features including summarization,
smart search, auto-tagging, and content analysis.
"""

from typing import Optional, List, Dict, Any
from uuid import UUID, uuid4
from datetime import datetime
import logging
import json
import re
import hashlib
import httpx

from core.config import settings

logger = logging.getLogger(__name__)


class DocsAIService:
    """
    AI-powered document features.

    Features:
    - Document summarization
    - Content extraction and analysis
    - Smart tagging suggestions
    - Semantic search
    - Similar document finding
    - Writing assistance
    """

    def __init__(self):
        """Initialize AI service."""
        self.openai_api_key = getattr(settings, "OPENAI_API_KEY", None)
        self.anthropic_api_key = getattr(settings, "ANTHROPIC_API_KEY", None)
        self.ai_enabled = bool(self.openai_api_key or self.anthropic_api_key)

        # Cache for embeddings
        self._embedding_cache: Dict[str, List[float]] = {}

    # =========================================================================
    # DOCUMENT SUMMARIZATION
    # =========================================================================

    async def summarize_document(
        self,
        content: str,
        max_length: int = 500,
        style: str = "concise"
    ) -> Dict[str, Any]:
        """
        Generate a summary of document content.

        Args:
            content: Document content (plain text or HTML)
            max_length: Maximum summary length
            style: Summary style (concise, detailed, bullet_points)

        Returns:
            Generated summary with metadata
        """
        # Clean content
        clean_content = self._clean_html(content)

        if not clean_content or len(clean_content) < 100:
            return {
                "summary": clean_content[:max_length] if clean_content else "",
                "method": "passthrough",
                "original_length": len(content),
                "summary_length": len(clean_content) if clean_content else 0
            }

        # If AI is available, use it
        if self.ai_enabled:
            try:
                summary = await self._ai_summarize(clean_content, max_length, style)
                return {
                    "summary": summary,
                    "method": "ai",
                    "style": style,
                    "original_length": len(content),
                    "summary_length": len(summary)
                }
            except Exception as e:
                logger.warning(f"AI summarization failed, falling back: {e}")

        # Fallback: extractive summarization
        summary = self._extractive_summary(clean_content, max_length)
        return {
            "summary": summary,
            "method": "extractive",
            "original_length": len(content),
            "summary_length": len(summary)
        }

    async def _ai_summarize(
        self,
        content: str,
        max_length: int,
        style: str
    ) -> str:
        """Use AI to generate summary."""
        style_prompts = {
            "concise": "Provide a brief, concise summary.",
            "detailed": "Provide a detailed summary covering all main points.",
            "bullet_points": "Provide a summary as bullet points."
        }

        prompt = f"""Summarize the following document in {max_length} characters or less.
{style_prompts.get(style, style_prompts['concise'])}

Document:
{content[:8000]}  # Limit input for API

Summary:"""

        if self.anthropic_api_key:
            return await self._call_anthropic(prompt, max_tokens=500)
        elif self.openai_api_key:
            return await self._call_openai(prompt, max_tokens=500)

        return content[:max_length]

    def _extractive_summary(self, content: str, max_length: int) -> str:
        """Simple extractive summarization."""
        # Split into sentences
        sentences = re.split(r'(?<=[.!?])\s+', content)

        if not sentences:
            return content[:max_length]

        # Score sentences by position and keyword density
        scored = []
        keywords = self._extract_keywords(content)

        for i, sentence in enumerate(sentences):
            # Position score (first sentences are important)
            position_score = 1.0 / (i + 1)

            # Keyword score
            keyword_count = sum(1 for kw in keywords if kw.lower() in sentence.lower())
            keyword_score = keyword_count / max(len(keywords), 1)

            # Length score (prefer medium-length sentences)
            words = len(sentence.split())
            length_score = 1.0 if 10 <= words <= 30 else 0.5

            total_score = position_score * 0.4 + keyword_score * 0.4 + length_score * 0.2
            scored.append((sentence, total_score))

        # Sort by score and take top sentences
        scored.sort(key=lambda x: x[1], reverse=True)

        summary = []
        current_length = 0

        for sentence, score in scored:
            if current_length + len(sentence) <= max_length:
                summary.append(sentence)
                current_length += len(sentence) + 1
            else:
                break

        # Reorder by original position
        summary_set = set(summary)
        ordered_summary = [s for s in sentences if s in summary_set]

        return " ".join(ordered_summary)

    # =========================================================================
    # KEYWORD AND TAG EXTRACTION
    # =========================================================================

    async def extract_keywords(
        self,
        content: str,
        max_keywords: int = 10
    ) -> Dict[str, Any]:
        """
        Extract keywords and key phrases from document.

        Args:
            content: Document content
            max_keywords: Maximum number of keywords

        Returns:
            Extracted keywords with relevance scores
        """
        clean_content = self._clean_html(content)

        if self.ai_enabled:
            try:
                keywords = await self._ai_extract_keywords(clean_content, max_keywords)
                return {
                    "keywords": keywords,
                    "method": "ai"
                }
            except Exception as e:
                logger.warning(f"AI keyword extraction failed: {e}")

        # Fallback: TF-IDF style extraction
        keywords = self._extract_keywords(clean_content)[:max_keywords]
        return {
            "keywords": [{"term": kw, "score": 1.0 - (i * 0.1)} for i, kw in enumerate(keywords)],
            "method": "statistical"
        }

    async def _ai_extract_keywords(
        self,
        content: str,
        max_keywords: int
    ) -> List[Dict[str, Any]]:
        """Use AI to extract keywords."""
        prompt = f"""Extract the {max_keywords} most important keywords or key phrases from this document.
Return them as a JSON array with format: [{{"term": "keyword", "score": 0.95}}]
Score should be 0-1 indicating relevance.

Document:
{content[:6000]}

Keywords JSON:"""

        response = await self._call_ai(prompt, max_tokens=300)

        # Parse JSON response
        try:
            # Find JSON array in response
            match = re.search(r'\[.*\]', response, re.DOTALL)
            if match:
                return json.loads(match.group())
        except json.JSONDecodeError:
            pass

        return []

    def _extract_keywords(self, content: str) -> List[str]:
        """Statistical keyword extraction."""
        # Common stop words
        stop_words = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
            'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
            'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'this',
            'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
            'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each',
            'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
            'not', 'only', 'same', 'so', 'than', 'too', 'very', 'just', 'also'
        }

        # Tokenize and count
        words = re.findall(r'\b[a-zA-Z]{3,}\b', content.lower())
        word_counts = {}

        for word in words:
            if word not in stop_words:
                word_counts[word] = word_counts.get(word, 0) + 1

        # Sort by frequency
        sorted_words = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)

        return [word for word, count in sorted_words[:20]]

    async def suggest_tags(
        self,
        content: str,
        existing_tags: Optional[List[str]] = None,
        max_suggestions: int = 5
    ) -> Dict[str, Any]:
        """
        Suggest tags for a document.

        Args:
            content: Document content
            existing_tags: Tags already on the document
            max_suggestions: Maximum suggestions

        Returns:
            Suggested tags
        """
        clean_content = self._clean_html(content)
        existing = set(existing_tags or [])

        if self.ai_enabled:
            try:
                prompt = f"""Suggest {max_suggestions} relevant tags for categorizing this document.
Tags should be single words or short phrases, lowercase.
{"Existing tags to avoid: " + ", ".join(existing) if existing else ""}

Document:
{clean_content[:4000]}

Suggested tags (comma-separated):"""

                response = await self._call_ai(prompt, max_tokens=100)
                tags = [t.strip().lower() for t in response.split(",")]
                tags = [t for t in tags if t and t not in existing][:max_suggestions]

                return {
                    "suggestions": tags,
                    "method": "ai"
                }
            except Exception as e:
                logger.warning(f"AI tag suggestion failed: {e}")

        # Fallback: use top keywords as tags
        keywords = self._extract_keywords(clean_content)
        suggestions = [kw for kw in keywords if kw not in existing][:max_suggestions]

        return {
            "suggestions": suggestions,
            "method": "keyword"
        }

    # =========================================================================
    # CONTENT ANALYSIS
    # =========================================================================

    async def analyze_document(
        self,
        content: str,
        title: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Comprehensive document analysis.

        Args:
            content: Document content
            title: Document title

        Returns:
            Analysis results including stats, readability, topics
        """
        clean_content = self._clean_html(content)

        # Basic statistics
        words = clean_content.split()
        sentences = re.split(r'[.!?]+', clean_content)
        paragraphs = clean_content.split('\n\n')

        stats = {
            "character_count": len(clean_content),
            "word_count": len(words),
            "sentence_count": len([s for s in sentences if s.strip()]),
            "paragraph_count": len([p for p in paragraphs if p.strip()]),
            "average_word_length": sum(len(w) for w in words) / max(len(words), 1),
            "average_sentence_length": len(words) / max(len(sentences), 1)
        }

        # Readability score (Flesch-Kincaid approximation)
        readability = self._calculate_readability(clean_content)

        # Extract keywords
        keywords_result = await self.extract_keywords(clean_content, max_keywords=10)

        # Generate summary
        summary_result = await self.summarize_document(clean_content, max_length=200)

        # Detect language (simple heuristic)
        language = self._detect_language(clean_content)

        return {
            "statistics": stats,
            "readability": readability,
            "keywords": keywords_result['keywords'],
            "summary": summary_result['summary'],
            "language": language,
            "analyzed_at": datetime.now().isoformat()
        }

    def _calculate_readability(self, content: str) -> Dict[str, Any]:
        """Calculate readability metrics."""
        words = content.split()
        sentences = re.split(r'[.!?]+', content)
        sentences = [s for s in sentences if s.strip()]

        if not words or not sentences:
            return {"score": 0, "grade_level": "N/A", "difficulty": "unknown"}

        # Count syllables (approximation)
        def count_syllables(word):
            word = word.lower()
            vowels = 'aeiou'
            count = 0
            prev_vowel = False
            for char in word:
                is_vowel = char in vowels
                if is_vowel and not prev_vowel:
                    count += 1
                prev_vowel = is_vowel
            # Adjust for silent e
            if word.endswith('e') and count > 1:
                count -= 1
            return max(count, 1)

        total_syllables = sum(count_syllables(w) for w in words)

        # Flesch Reading Ease
        avg_sentence_length = len(words) / len(sentences)
        avg_syllables_per_word = total_syllables / len(words)

        flesch_score = 206.835 - (1.015 * avg_sentence_length) - (84.6 * avg_syllables_per_word)
        flesch_score = max(0, min(100, flesch_score))

        # Grade level
        if flesch_score >= 90:
            grade = "5th grade"
            difficulty = "very_easy"
        elif flesch_score >= 80:
            grade = "6th grade"
            difficulty = "easy"
        elif flesch_score >= 70:
            grade = "7th grade"
            difficulty = "fairly_easy"
        elif flesch_score >= 60:
            grade = "8th-9th grade"
            difficulty = "standard"
        elif flesch_score >= 50:
            grade = "10th-12th grade"
            difficulty = "fairly_difficult"
        elif flesch_score >= 30:
            grade = "College"
            difficulty = "difficult"
        else:
            grade = "College graduate"
            difficulty = "very_difficult"

        return {
            "flesch_score": round(flesch_score, 1),
            "grade_level": grade,
            "difficulty": difficulty,
            "avg_sentence_length": round(avg_sentence_length, 1),
            "avg_syllables_per_word": round(avg_syllables_per_word, 2)
        }

    def _detect_language(self, content: str) -> str:
        """Simple language detection."""
        # Common words in different languages
        lang_indicators = {
            "en": {"the", "and", "is", "are", "was", "were", "have", "has", "been"},
            "es": {"el", "la", "los", "las", "de", "en", "que", "es", "un", "una"},
            "fr": {"le", "la", "les", "de", "des", "est", "sont", "dans", "que"},
            "de": {"der", "die", "das", "und", "ist", "sind", "von", "mit", "ein"},
        }

        words = set(content.lower().split())

        scores = {}
        for lang, indicators in lang_indicators.items():
            scores[lang] = len(words & indicators)

        if not scores:
            return "unknown"

        return max(scores, key=scores.get)

    # =========================================================================
    # SMART SEARCH
    # =========================================================================

    async def semantic_search(
        self,
        query: str,
        documents: List[Dict[str, Any]],
        top_k: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Semantic search across documents.

        Args:
            query: Search query
            documents: List of documents with 'id', 'title', 'content'
            top_k: Number of results

        Returns:
            Ranked search results
        """
        if not documents:
            return []

        # If AI available, use embeddings
        if self.ai_enabled and self.openai_api_key:
            try:
                return await self._embedding_search(query, documents, top_k)
            except Exception as e:
                logger.warning(f"Embedding search failed: {e}")

        # Fallback: keyword-based search
        return self._keyword_search(query, documents, top_k)

    async def _embedding_search(
        self,
        query: str,
        documents: List[Dict[str, Any]],
        top_k: int
    ) -> List[Dict[str, Any]]:
        """Search using embeddings."""
        # Get query embedding
        query_embedding = await self._get_embedding(query)

        # Get document embeddings
        results = []
        for doc in documents:
            content = f"{doc.get('title', '')} {self._clean_html(doc.get('content', ''))}"
            doc_embedding = await self._get_embedding(content[:2000])

            # Calculate cosine similarity
            similarity = self._cosine_similarity(query_embedding, doc_embedding)

            results.append({
                "id": doc.get('id'),
                "title": doc.get('title'),
                "score": similarity,
                "snippet": content[:200]
            })

        # Sort by similarity
        results.sort(key=lambda x: x['score'], reverse=True)

        return results[:top_k]

    async def _get_embedding(self, text: str) -> List[float]:
        """Get embedding for text."""
        # Check cache
        cache_key = hashlib.md5(text.encode()).hexdigest()
        if cache_key in self._embedding_cache:
            return self._embedding_cache[cache_key]

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/embeddings",
                headers={
                    "Authorization": f"Bearer {self.openai_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "input": text[:8000],
                    "model": "text-embedding-3-small"
                },
                timeout=30.0
            )
            response.raise_for_status()
            data = response.json()
            embedding = data['data'][0]['embedding']

            # Cache result
            self._embedding_cache[cache_key] = embedding

            return embedding

    def _cosine_similarity(self, a: List[float], b: List[float]) -> float:
        """Calculate cosine similarity between two vectors."""
        dot_product = sum(x * y for x, y in zip(a, b))
        norm_a = sum(x * x for x in a) ** 0.5
        norm_b = sum(x * x for x in b) ** 0.5
        return dot_product / (norm_a * norm_b) if norm_a and norm_b else 0

    def _keyword_search(
        self,
        query: str,
        documents: List[Dict[str, Any]],
        top_k: int
    ) -> List[Dict[str, Any]]:
        """Simple keyword-based search."""
        query_terms = set(query.lower().split())

        results = []
        for doc in documents:
            content = f"{doc.get('title', '')} {self._clean_html(doc.get('content', ''))}".lower()
            words = set(content.split())

            # Calculate term overlap
            matches = len(query_terms & words)
            score = matches / len(query_terms) if query_terms else 0

            if score > 0:
                results.append({
                    "id": doc.get('id'),
                    "title": doc.get('title'),
                    "score": score,
                    "snippet": content[:200]
                })

        results.sort(key=lambda x: x['score'], reverse=True)
        return results[:top_k]

    async def find_similar_documents(
        self,
        document_id: UUID,
        document_content: str,
        candidates: List[Dict[str, Any]],
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Find documents similar to a given document.

        Args:
            document_id: Source document ID (to exclude)
            document_content: Source document content
            candidates: List of candidate documents
            top_k: Number of similar documents

        Returns:
            List of similar documents with scores
        """
        # Filter out source document
        candidates = [d for d in candidates if str(d.get('id')) != str(document_id)]

        if not candidates:
            return []

        # Extract keywords from source
        keywords = self._extract_keywords(self._clean_html(document_content))

        if self.ai_enabled and self.openai_api_key:
            try:
                return await self._embedding_search(
                    " ".join(keywords[:10]),
                    candidates,
                    top_k
                )
            except Exception as e:
                logger.warning(f"Similarity search failed: {e}")

        return self._keyword_search(" ".join(keywords[:10]), candidates, top_k)

    # =========================================================================
    # WRITING ASSISTANCE
    # =========================================================================

    async def improve_writing(
        self,
        text: str,
        style: str = "professional"
    ) -> Dict[str, Any]:
        """
        Suggest improvements for text.

        Args:
            text: Text to improve
            style: Target style (professional, casual, academic)

        Returns:
            Improved text with suggestions
        """
        if not self.ai_enabled:
            return {
                "improved": text,
                "suggestions": [],
                "method": "unavailable"
            }

        style_prompts = {
            "professional": "Make this text more professional and clear.",
            "casual": "Make this text more casual and friendly.",
            "academic": "Make this text more formal and academic.",
            "concise": "Make this text more concise without losing meaning."
        }

        prompt = f"""{style_prompts.get(style, style_prompts['professional'])}

Original text:
{text[:4000]}

Improved text:"""

        try:
            improved = await self._call_ai(prompt, max_tokens=2000)
            return {
                "improved": improved.strip(),
                "style": style,
                "method": "ai"
            }
        except Exception as e:
            logger.warning(f"Writing improvement failed: {e}")
            return {
                "improved": text,
                "error": str(e),
                "method": "failed"
            }

    async def generate_content(
        self,
        prompt: str,
        document_context: Optional[str] = None,
        max_length: int = 500
    ) -> Dict[str, Any]:
        """
        Generate content based on a prompt.

        Args:
            prompt: What to generate
            document_context: Existing document for context
            max_length: Maximum length

        Returns:
            Generated content
        """
        if not self.ai_enabled:
            return {
                "content": "",
                "error": "AI not available",
                "method": "unavailable"
            }

        full_prompt = f"""Generate the following content{' based on the document context provided' if document_context else ''}.

{f'Document context: {document_context[:2000]}' if document_context else ''}

Request: {prompt}

Generated content:"""

        try:
            content = await self._call_ai(full_prompt, max_tokens=max_length * 2)
            return {
                "content": content.strip()[:max_length],
                "method": "ai"
            }
        except Exception as e:
            logger.warning(f"Content generation failed: {e}")
            return {
                "content": "",
                "error": str(e),
                "method": "failed"
            }

    # =========================================================================
    # AI API HELPERS
    # =========================================================================

    async def _call_ai(self, prompt: str, max_tokens: int = 500) -> str:
        """Call the best available AI API."""
        if self.anthropic_api_key:
            return await self._call_anthropic(prompt, max_tokens)
        elif self.openai_api_key:
            return await self._call_openai(prompt, max_tokens)
        raise ValueError("No AI API configured")

    async def _call_anthropic(self, prompt: str, max_tokens: int) -> str:
        """Call Anthropic API."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": self.anthropic_api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "claude-3-haiku-20240307",
                    "max_tokens": max_tokens,
                    "messages": [{"role": "user", "content": prompt}]
                },
                timeout=60.0
            )
            response.raise_for_status()
            data = response.json()
            return data['content'][0]['text']

    async def _call_openai(self, prompt: str, max_tokens: int) -> str:
        """Call OpenAI API."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.openai_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-3.5-turbo",
                    "max_tokens": max_tokens,
                    "messages": [{"role": "user", "content": prompt}]
                },
                timeout=60.0
            )
            response.raise_for_status()
            data = response.json()
            return data['choices'][0]['message']['content']

    # =========================================================================
    # UTILITIES
    # =========================================================================

    def _clean_html(self, content: str) -> str:
        """Remove HTML tags and clean content."""
        if not content:
            return ""

        # Remove HTML tags
        clean = re.sub(r'<[^>]+>', ' ', content)
        # Remove extra whitespace
        clean = re.sub(r'\s+', ' ', clean)
        # Remove HTML entities
        clean = re.sub(r'&[a-z]+;', ' ', clean)
        return clean.strip()


# Singleton instance
_ai_service: Optional[DocsAIService] = None


def get_docs_ai_service() -> DocsAIService:
    """Get or create AI service singleton."""
    global _ai_service
    if _ai_service is None:
        _ai_service = DocsAIService()
    return _ai_service
