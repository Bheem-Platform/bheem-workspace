"""
API Tool Base Class for AgentBheem
Extends base Tool for HTTP API-connected tools with authentication
"""

import httpx
import logging
from typing import Optional, Dict, Any, List
from functools import wraps
import inspect

from .base import Tool, ToolResult

logger = logging.getLogger(__name__)

# Global tool registry
_tool_registry: Dict[str, Dict[str, Any]] = {}


class APITool(Tool):
    """
    Base class for API-connected tools
    Handles HTTP requests, authentication, retries, and error handling
    """

    name: str = "api_tool"
    description: str = "Base API tool"
    base_url: str = ""
    requires_auth: bool = True

    def __init__(
        self,
        base_url: str = None,
        auth_token: str = None,
        timeout: float = 30.0
    ):
        super().__init__()
        self.base_url = base_url or self.base_url
        self.auth_token = auth_token
        self.timeout = timeout
        self._client: Optional[httpx.AsyncClient] = None

    async def get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client"""
        if self._client is None or self._client.is_closed:
            headers = {}
            if self.auth_token:
                headers["Authorization"] = f"Bearer {self.auth_token}"
            headers["Content-Type"] = "application/json"

            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                headers=headers,
                timeout=self.timeout
            )
        return self._client

    async def close(self):
        """Close HTTP client"""
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    async def api_call(
        self,
        method: str,
        endpoint: str,
        data: Dict = None,
        params: Dict = None,
        headers: Dict = None,
        retry_count: int = 3
    ) -> Dict[str, Any]:
        """
        Make API call with retry logic

        Args:
            method: HTTP method (GET, POST, PUT, DELETE, PATCH)
            endpoint: API endpoint (will be appended to base_url)
            data: Request body (for POST, PUT, PATCH)
            params: Query parameters
            headers: Additional headers
            retry_count: Number of retries on failure

        Returns:
            API response as dict
        """
        client = await self.get_client()
        last_error = None

        for attempt in range(retry_count):
            try:
                response = await client.request(
                    method=method.upper(),
                    url=endpoint,
                    json=data,
                    params=params,
                    headers=headers
                )

                # Handle non-2xx responses
                if response.status_code >= 400:
                    error_body = response.text
                    try:
                        error_body = response.json()
                    except:
                        pass

                    if response.status_code == 401:
                        raise AuthenticationError(f"Authentication failed: {error_body}")
                    elif response.status_code == 403:
                        raise AuthorizationError(f"Access denied: {error_body}")
                    elif response.status_code == 404:
                        raise NotFoundError(f"Resource not found: {endpoint}")
                    elif response.status_code >= 500:
                        raise ServerError(f"Server error: {error_body}")
                    else:
                        raise APIError(f"API error {response.status_code}: {error_body}")

                # Parse response
                if response.headers.get("content-type", "").startswith("application/json"):
                    return response.json()
                return {"raw": response.text}

            except (httpx.TimeoutException, httpx.ConnectError) as e:
                last_error = e
                if attempt < retry_count - 1:
                    logger.warning(f"API call failed (attempt {attempt + 1}): {e}, retrying...")
                    import asyncio
                    await asyncio.sleep(2 ** attempt)  # Exponential backoff
                continue

            except (AuthenticationError, AuthorizationError, NotFoundError) as e:
                # Don't retry auth/not found errors
                raise

        raise ConnectionError(f"API call failed after {retry_count} attempts: {last_error}")

    async def get(self, endpoint: str, params: Dict = None) -> Dict:
        """GET request"""
        return await self.api_call("GET", endpoint, params=params)

    async def post(self, endpoint: str, data: Dict = None, params: Dict = None) -> Dict:
        """POST request"""
        return await self.api_call("POST", endpoint, data=data, params=params)

    async def put(self, endpoint: str, data: Dict = None) -> Dict:
        """PUT request"""
        return await self.api_call("PUT", endpoint, data=data)

    async def patch(self, endpoint: str, data: Dict = None) -> Dict:
        """PATCH request"""
        return await self.api_call("PATCH", endpoint, data=data)

    async def delete(self, endpoint: str, params: Dict = None) -> Dict:
        """DELETE request"""
        return await self.api_call("DELETE", endpoint, params=params)

    async def execute(self, **kwargs) -> ToolResult:
        """Default execute - override in subclasses"""
        self._record_usage()
        try:
            result = await self._execute(**kwargs)
            return ToolResult(success=True, output=result)
        except Exception as e:
            logger.error(f"Tool {self.name} failed: {e}")
            return ToolResult(success=False, output=None, error=str(e))

    async def _execute(self, **kwargs) -> Any:
        """Override this method in subclasses"""
        raise NotImplementedError("Subclasses must implement _execute")


# Custom Exceptions
class APIError(Exception):
    """Base API error"""
    pass


class AuthenticationError(APIError):
    """Authentication failed (401)"""
    pass


class AuthorizationError(APIError):
    """Authorization failed (403)"""
    pass


class NotFoundError(APIError):
    """Resource not found (404)"""
    pass


class ServerError(APIError):
    """Server error (5xx)"""
    pass


# Tool Registration Decorator
def tool(
    name: str = None,
    description: str = None,
    agent: str = None,
    parameters: Dict[str, Any] = None
):
    """
    Decorator to register a function as a tool

    Usage:
        @tool(name="create_user", agent="passport_agent", description="Create a new user")
        async def create_user(username: str, email: str, role: str = "user") -> Dict:
            '''Create a new user account'''
            pass

    Args:
        name: Tool name (defaults to function name)
        description: Tool description (defaults to docstring)
        agent: Agent this tool belongs to
        parameters: Parameter schema (auto-generated if not provided)
    """
    def decorator(func):
        tool_name = name or func.__name__
        tool_desc = description or func.__doc__ or f"Tool: {tool_name}"

        # Auto-generate parameters from function signature
        if parameters is None:
            sig = inspect.signature(func)
            hints = getattr(func, '__annotations__', {})

            tool_params = {
                "type": "object",
                "properties": {},
                "required": []
            }

            for param_name, param in sig.parameters.items():
                if param_name in ('self', 'cls'):
                    continue

                # Get type hint
                param_type = hints.get(param_name, str)
                json_type = _python_type_to_json(param_type)

                tool_params["properties"][param_name] = {
                    "type": json_type,
                    "description": f"Parameter: {param_name}"
                }

                # Required if no default
                if param.default == inspect.Parameter.empty:
                    tool_params["required"].append(param_name)
        else:
            tool_params = parameters

        # Register tool
        _tool_registry[tool_name] = {
            "name": tool_name,
            "description": tool_desc,
            "parameters": tool_params,
            "function": func,
            "agent": agent,
            "is_async": inspect.iscoroutinefunction(func)
        }

        @wraps(func)
        async def wrapper(*args, **kwargs):
            if inspect.iscoroutinefunction(func):
                return await func(*args, **kwargs)
            return func(*args, **kwargs)

        # Attach metadata
        wrapper._tool_name = tool_name
        wrapper._tool_agent = agent
        wrapper._tool_params = tool_params

        return wrapper

    return decorator


def _python_type_to_json(python_type) -> str:
    """Convert Python type hint to JSON schema type"""
    type_map = {
        str: "string",
        int: "integer",
        float: "number",
        bool: "boolean",
        list: "array",
        dict: "object",
        List: "array",
        Dict: "object",
    }

    # Handle Optional, List, Dict from typing
    origin = getattr(python_type, '__origin__', None)
    if origin is not None:
        if origin is list:
            return "array"
        if origin is dict:
            return "object"

    return type_map.get(python_type, "string")


def get_tools_for_agent(agent_name: str) -> List[Dict]:
    """Get all tools registered for a specific agent"""
    return [
        {
            "name": tool["name"],
            "description": tool["description"],
            "parameters": tool["parameters"],
            "function": tool["function"]
        }
        for tool in _tool_registry.values()
        if tool.get("agent") == agent_name
    ]


def get_all_tools() -> Dict[str, Dict]:
    """Get all registered tools"""
    return _tool_registry.copy()


def get_tool(name: str) -> Optional[Dict]:
    """Get a specific tool by name"""
    return _tool_registry.get(name)


class APIToolSet:
    """
    Collection of API tools for a specific service
    Manages authentication and provides tool access
    """

    service_name: str = "api"
    base_url: str = ""

    def __init__(self, base_url: str = None, auth_token: str = None):
        self.base_url = base_url or self.base_url
        self.auth_token = auth_token
        self._tools: Dict[str, APITool] = {}

    def register_tool(self, tool: APITool):
        """Register a tool with this toolset"""
        tool.base_url = self.base_url
        tool.auth_token = self.auth_token
        self._tools[tool.name] = tool

    def get_tool(self, name: str) -> Optional[APITool]:
        """Get a tool by name"""
        return self._tools.get(name)

    def list_tools(self) -> List[str]:
        """List all tool names"""
        return list(self._tools.keys())

    async def execute_tool(self, name: str, **kwargs) -> ToolResult:
        """Execute a tool by name"""
        tool = self.get_tool(name)
        if not tool:
            return ToolResult(success=False, output=None, error=f"Tool not found: {name}")
        return await tool.execute(**kwargs)

    async def close(self):
        """Close all tool connections"""
        for tool in self._tools.values():
            await tool.close()
