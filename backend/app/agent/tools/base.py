"""
Base Tool Abstraction for Nanobot Integration
Inherits from nanobot.agent.tools.Tool.
"""

from typing import Dict, Any, Callable
from nanobot.agent.tools import Tool, ToolRegistry


class FDEAgentTool(Tool):
    """Bridge FDE Agent capability into native nanobot Tool architecture."""
    def __init__(self, name: str, label: str, func: Callable[..., Any]):
        self._name = name
        self._label = label
        self._func = func

    @property
    def name(self) -> str:
        return self._name

    @property
    def description(self) -> str:
        return self._label

    @property
    def label(self) -> str:
        return self._label

    @property
    def parameters(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "ctx": {"type": "object", "description": "FDE Analysis Context"}
            }
        }

    async def execute(self, **kwargs: Any) -> Any:
        ctx = kwargs.get("ctx", kwargs)
        return await self._func(ctx)


tool_registry = ToolRegistry()


def register_tool(name: str, label: str):
    def decorator(func: Callable[..., Any]):
        tool_obj = FDEAgentTool(name, label, func)
        tool_registry.register(tool_obj)
        return func
    return decorator


def verdict_label(v: str) -> str:
    mapping = {
        "can": "可以做（属于 FDE 能力范围）",
        "maybe": "谨慎做（需要外部支持/协同）",
        "no": "不能独立承接（触犯红线或超界）"
    }
    return mapping.get(v, v)
