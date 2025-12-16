"""
BaseAgent - Hybrid AI Agent with LLM + Q-learning
Implements the "Start Intelligent, Become Efficient" philosophy

Now with PostgreSQL persistence for patterns!
"""

import json
import hashlib
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from abc import ABC, abstractmethod
import logging

from ..models import ModelRouter
from ..database import PatternStore, ExecutionStore

logger = logging.getLogger(__name__)


@dataclass
class Pattern:
    """
    A learned pattern from executions
    """
    id: str = ""
    signature: str = ""  # Hash of state
    occurrences: int = 0
    success_count: int = 0
    failure_count: int = 0
    avg_execution_time: float = 0.0
    actions_taken: List[str] = field(default_factory=list)
    action_consistency: float = 0.0  # How often same action is chosen
    q_values: Dict[str, float] = field(default_factory=dict)
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    last_used: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    @property
    def success_rate(self) -> float:
        """Calculate success rate"""
        total = self.success_count + self.failure_count
        if total == 0:
            return 0.0
        return self.success_count / total

    @property
    def is_ready_for_qlearning(self) -> bool:
        """
        Check if pattern is ready for Q-learning transition
        Criteria:
        - Used 10+ times
        - Success rate > 80%
        - Action consistency > 90%
        """
        return (
            self.occurrences >= 10 and
            self.success_rate >= 0.8 and
            self.action_consistency >= 0.9
        )

    @classmethod
    def from_db_row(cls, row: Dict[str, Any]) -> "Pattern":
        """Create Pattern from database row"""
        return cls(
            id=row.get('id', ''),
            signature=row.get('signature', ''),
            occurrences=row.get('occurrences', 0),
            success_count=row.get('success_count', 0),
            failure_count=row.get('failure_count', 0),
            avg_execution_time=row.get('avg_execution_time_ms', 0.0),
            actions_taken=row.get('actions_taken', []),
            action_consistency=row.get('action_consistency', 0.0),
            q_values=row.get('q_values', {}),
            created_at=str(row.get('created_at', '')),
            last_used=str(row.get('last_used_at', ''))
        )


class BaseAgent(ABC):
    """
    Base class for all intelligent agents

    Implements hybrid decision-making:
    - LLM for novel scenarios (expensive, slow, intelligent)
    - Q-learning for known patterns (cheap, fast, reliable)

    Pattern storage is now in PostgreSQL for persistence across restarts!
    """

    # Agent metadata (override in subclasses)
    agent_type: str = "base"
    available_tools: List[str] = []

    def __init__(self, model_router: ModelRouter, workspace_id: str = "default"):
        self.model_router = model_router
        self.workspace_id = workspace_id

        # Statistics (session-level, aggregated from DB on request)
        self.stats = {
            "total_executions": 0,
            "llm_decisions": 0,
            "qlearning_decisions": 0,
            "total_cost": 0.0,
            "avg_execution_time": 0.0
        }

    def create_state_signature(self, inputs: Dict[str, Any]) -> str:
        """
        Create a unique signature for the current state
        Used to match against known patterns
        """
        # Normalize inputs for consistent hashing
        normalized = {
            k: str(v).lower().strip()
            for k, v in sorted(inputs.items())
            if v is not None
        }

        state_str = json.dumps(normalized, sort_keys=True)
        return hashlib.md5(state_str.encode()).hexdigest()

    async def find_pattern(self, signature: str) -> Optional[Pattern]:
        """
        Find pattern from PostgreSQL database
        """
        try:
            row = await PatternStore.get_pattern(
                agent_type=self.agent_type,
                signature=signature,
                workspace_id=self.workspace_id
            )

            if row:
                pattern = Pattern.from_db_row(row)
                if pattern.is_ready_for_qlearning:
                    return pattern
        except Exception as e:
            logger.warning(f"Error finding pattern: {e}")

        return None

    async def should_use_qlearning(self, inputs: Dict[str, Any]) -> Tuple[bool, Optional[Pattern]]:
        """
        Decide whether to use Q-learning or LLM
        Returns: (use_qlearning, pattern)
        """
        signature = self.create_state_signature(inputs)
        pattern = await self.find_pattern(signature)

        if pattern:
            logger.info(f"✅ Pattern found! Used {pattern.occurrences} times, {pattern.success_rate*100:.1f}% success")
            return True, pattern
        else:
            logger.info(f"🆕 New pattern detected, using LLM for intelligent decision")
            return False, None

    async def select_tools_with_llm(self, goal: str, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Use LLM to intelligently select which tools to run
        Expensive but handles novel scenarios
        """
        prompt = f"""You are an expert {self.agent_type} agent. Analyze the goal and select the optimal tools to execute.

Goal: {goal}
Inputs: {json.dumps(inputs, indent=2)}

Available Tools:
{chr(10).join(f"- {tool}" for tool in self.available_tools)}

Respond in JSON format:
{{
  "selected_tools": [
    {{
      "tool": "tool_name",
      "reason": "why this tool is needed",
      "priority": 1
    }}
  ],
  "execution_plan": "brief strategy explanation"
}}

Select 2-4 tools that provide the most value for this goal."""

        response = await self.model_router.complete(
            prompt=prompt,
            model='claude',  # Use Claude for planning
            temperature=0.3
        )

        # Parse JSON from response
        response_text = response.content
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()

        plan = json.loads(response_text)

        # Update stats
        self.stats["llm_decisions"] += 1
        self.stats["total_cost"] += response.cost

        return plan, response.cost

    def select_tools_with_qlearning(self, pattern: Pattern) -> Tuple[Dict[str, Any], float]:
        """
        Use Q-learning to select tools based on learned patterns
        Fast and cheap
        """
        # Get the learned action sequence
        tools = pattern.actions_taken

        plan = {
            "selected_tools": [
                {"tool": tool, "reason": "Learned from past executions", "priority": i+1}
                for i, tool in enumerate(tools)
            ],
            "execution_plan": f"Using learned pattern (used {pattern.occurrences} times, {pattern.success_rate*100:.1f}% success)"
        }

        # Update stats
        self.stats["qlearning_decisions"] += 1
        cost = 0.001  # Minimal cost for Q-learning lookup
        self.stats["total_cost"] += cost

        return plan, cost

    @abstractmethod
    async def execute_tool(self, tool_name: str, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a specific tool (implement in subclass)
        """
        pass

    async def execute_tools(self, plan: Dict[str, Any], inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute selected tools in sequence
        """
        tool_results = {}

        for tool_config in sorted(plan['selected_tools'], key=lambda x: x.get('priority', 99)):
            tool_name = tool_config['tool']
            logger.info(f"🔧 Executing tool: {tool_name}")

            try:
                result = await self.execute_tool(tool_name, inputs)
                tool_results[tool_name] = {
                    "success": True,
                    "data": result,
                    "reason": tool_config['reason']
                }
            except Exception as e:
                logger.error(f"❌ Tool {tool_name} failed: {str(e)}")
                tool_results[tool_name] = {
                    "success": False,
                    "error": str(e),
                    "reason": tool_config['reason']
                }

        return tool_results

    @abstractmethod
    async def synthesize_results(self, tool_results: Dict[str, Any], goal: str) -> Dict[str, Any]:
        """
        Synthesize tool results into final insights (implement in subclass)
        """
        pass

    async def store_execution_pattern(
        self,
        inputs: Dict[str, Any],
        selected_tools: List[str],
        success: bool,
        execution_time_ms: float,
        llm_cost: float = 0.0,
        qlearning_cost: float = 0.0
    ) -> Dict[str, Any]:
        """
        Store execution pattern to PostgreSQL for learning
        """
        signature = self.create_state_signature(inputs)

        try:
            result = await PatternStore.create_or_update_pattern(
                agent_type=self.agent_type,
                signature=signature,
                workspace_id=self.workspace_id,
                actions_taken=selected_tools,
                success=success,
                execution_time_ms=execution_time_ms,
                llm_cost=llm_cost,
                qlearning_cost=qlearning_cost
            )

            if result.get('is_ready_for_qlearning'):
                logger.info(f"🎓 Pattern ready for Q-learning transition!")

            return result
        except Exception as e:
            logger.error(f"Error storing pattern: {e}")
            return {}

    async def execute(self, goal: str, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Main execution method - orchestrates the hybrid decision process
        """
        start_time = datetime.utcnow()
        self.stats["total_executions"] += 1
        pattern_id = None
        llm_cost = 0.0
        qlearning_cost = 0.0

        logger.info(f"🚀 Executing {self.agent_type} agent for goal: {goal}")

        try:
            # Step 1: Decision routing (LLM or Q-learning?)
            use_qlearning, pattern = await self.should_use_qlearning(inputs)

            # Step 2: Tool selection
            if use_qlearning and pattern:
                plan, qlearning_cost = self.select_tools_with_qlearning(pattern)
                pattern_id = pattern.id
                decision_method = "qlearning"
            else:
                plan, llm_cost = await self.select_tools_with_llm(goal, inputs)
                decision_method = "llm"

            # Step 3: Execute tools
            tool_results = await self.execute_tools(plan, inputs)

            # Step 4: Synthesize results
            insights = await self.synthesize_results(tool_results, goal)

            # Step 5: Calculate execution time
            end_time = datetime.utcnow()
            execution_time_ms = (end_time - start_time).total_seconds() * 1000

            # Step 6: Determine success
            success = all(r.get('success', False) for r in tool_results.values())
            selected_tools = [t['tool'] for t in plan['selected_tools']]

            # Step 7: Store pattern for learning (async, don't wait)
            pattern_result = await self.store_execution_pattern(
                inputs=inputs,
                selected_tools=selected_tools,
                success=success,
                execution_time_ms=execution_time_ms,
                llm_cost=llm_cost,
                qlearning_cost=qlearning_cost
            )

            # Step 8: Record execution
            total_cost = llm_cost + qlearning_cost + self.stats.get("synthesis_cost", 0)
            try:
                execution_id = await ExecutionStore.record_execution(
                    agent_type=self.agent_type,
                    pattern_id=pattern_result.get('id'),
                    workspace_id=self.workspace_id,
                    goal=goal,
                    inputs=inputs,
                    success=success,
                    decision_method=decision_method,
                    tools_executed=selected_tools,
                    execution_time_ms=execution_time_ms,
                    cost=total_cost,
                    insights=insights
                )
            except Exception as e:
                logger.warning(f"Failed to record execution: {e}")
                execution_id = None

            # Update session stats
            self.stats["avg_execution_time"] = (
                (self.stats["avg_execution_time"] * (self.stats["total_executions"] - 1) + execution_time_ms)
                / self.stats["total_executions"]
            )

            # Return comprehensive results
            return {
                "success": success,
                "execution_id": execution_id,
                "goal": goal,
                "execution_plan": plan['execution_plan'],
                "tools_executed": selected_tools,
                "tool_results": tool_results,
                "insights": insights,
                "execution_time_ms": execution_time_ms,
                "decision_method": decision_method,
                "cost": total_cost,
                "pattern_status": {
                    "occurrences": pattern_result.get('occurrences', 1),
                    "success_rate": pattern_result.get('success_rate', 1.0 if success else 0.0),
                    "is_ready_for_qlearning": pattern_result.get('is_ready_for_qlearning', False)
                },
                "agent_stats": self.stats
            }

        except Exception as e:
            logger.error(f"Agent execution failed: {str(e)}")

            # Record failed execution
            try:
                await ExecutionStore.record_execution(
                    agent_type=self.agent_type,
                    workspace_id=self.workspace_id,
                    goal=goal,
                    inputs=inputs,
                    success=False,
                    decision_method="error",
                    error=str(e)
                )
            except:
                pass

            return {
                "success": False,
                "error": str(e),
                "goal": goal,
                "agent_stats": self.stats
            }

    async def get_learning_metrics(self) -> Dict[str, Any]:
        """
        Get learning metrics from database
        """
        try:
            metrics = await PatternStore.get_learning_metrics(
                agent_type=self.agent_type,
                workspace_id=self.workspace_id
            )
            return metrics
        except Exception as e:
            logger.error(f"Error getting metrics: {e}")
            return {
                "total_patterns": 0,
                "ready_for_qlearning": 0,
                "total_executions": self.stats["total_executions"],
                "qlearning_adoption": "0%"
            }
