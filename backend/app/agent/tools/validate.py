"""
Requirement Validation Tool
Checks if client input contains a valid IT/AI requirement description.
"""

from typing import Dict, Any
from app.agent.tools.base import register_tool
from app.agent.prompts import prompt_validate_requirement
from app.agent.llm import chat_json


@register_tool("validate_requirement", "需求有效性校验")
async def tool_validate_requirement(ctx: Dict[str, Any]) -> Dict[str, Any]:
    text = ctx.get("text", "")
    doc_text = ctx.get("docText") or ""
    has_image = bool(ctx.get("imageDataUrl"))
    db = ctx["db"]

    combined = (text + " " + doc_text[:500]).strip()
    if len(combined) < 6 and not has_image:
        return {"valid": False, "reason": "描述过于简短，请补充具体的 AI 应用场景或业务痛点需求。"}

    prompt = prompt_validate_requirement(combined)
    messages = [
        {"role": "system", "content": "你是判定需求有效性的校验模块，只输出 JSON。"},
        {"role": "user", "content": prompt}
    ]

    parsed = await chat_json(messages, db, temperature=0.1, fallback=None)
    if parsed and isinstance(parsed, dict) and "valid" in parsed:
        return {"valid": bool(parsed["valid"]), "reason": str(parsed.get("reason", ""))}

    return {"valid": True, "reason": "包含有效需求内容"}
