"""
Nanobot Agent Integration Architecture (HKUDS/nanobot)
Directly leverages official nanobot.agent (AgentLoop, MemoryStore, ToolRegistry).
"""

import logging
from typing import Callable, Awaitable, Dict, Any, List, Optional

# Native HKUDS Nanobot Package Imports
from nanobot.agent.tools import ToolRegistry, Tool, ToolResult, ToolContext
from nanobot.agent.memory import MemoryStore
from nanobot.agent.loop import AgentLoop

logger = logging.getLogger("nanobot")


from pathlib import Path

class NanobotAgentAdapter:
    """
    Adapter bridging official nanobot.agent ToolRegistry & MemoryStore with SSE stream output.
    """
    def __init__(self, registry: Optional[ToolRegistry] = None, memory: Optional[MemoryStore] = None, workspace: Optional[Path] = None):
        self.registry = registry or ToolRegistry()
        workspace_path = workspace or (Path(__file__).resolve().parent.parent.parent / "workspace")
        workspace_path.mkdir(parents=True, exist_ok=True)
        self.memory = memory or MemoryStore(workspace=workspace_path)


    async def execute_tool(
        self,
        tool_name: str,
        ctx: Dict[str, Any],
        emit_func: Callable[[str, Dict[str, Any]], Awaitable[None]]
    ) -> Any:
        tool_obj = self.registry.get(tool_name)
        if not tool_obj:
            logger.warning(f"Nanobot tool '{tool_name}' not registered in ToolRegistry.")
            return None

        label = getattr(tool_obj, "label", tool_obj.description or tool_name)
        await emit_func("tool_start", {
            "tool": tool_name,
            "label": label,
            "purpose": f"Executing Nanobot Tool: {label}"
        })

        try:
            result = await tool_obj.execute(ctx=ctx)
            return result
        except Exception as e:
            logger.error(f"Nanobot tool '{tool_name}' execution error: {e}")
            await emit_func("tool_error", {
                "tool": tool_name,
                "label": label,
                "message": str(e)
            })
            raise e





