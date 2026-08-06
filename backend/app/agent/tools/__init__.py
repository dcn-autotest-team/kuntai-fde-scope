"""
Modular Nanobot Tools Package
Imports and registers all domain tools into tool_registry.
"""

from typing import Dict, Any
from app.agent.tools.base import tool_registry, register_tool, verdict_label
from app.agent.prompts import prompt_reflect_summary
from app.agent.llm import chat_completion

# Auto-load all tool modules
from app.agent.tools.validate import tool_validate_requirement
from app.agent.tools.analyze import tool_analyze_dimensions
from app.agent.tools.redlines import tool_check_redlines
from app.agent.tools.verdict import tool_calculate_verdict
from app.agent.tools.recommend import tool_recommend_packages

# Alias for backwards compatibility
registry = tool_registry


async def reflect(ctx: Dict[str, Any]) -> Dict[str, Any]:
    text = ctx.get("text", "")
    verdict_res = ctx.get("results", {}).get("calculate_verdict", {})
    verdict = verdict_res.get("verdict", "can") if isinstance(verdict_res, dict) else "can"
    details = verdict_res.get("details", []) if isinstance(verdict_res, dict) else []
    db = ctx.get("db")

    detail_str = "\n".join([f"- {d.get('dimension_title')}: {d.get('option_label')}" for d in details if isinstance(d, dict)])
    prompt = prompt_reflect_summary(text, verdict_label(verdict), detail_str)

    messages = [
        {"role": "system", "content": "你是总结能力强、客观严谨的解决方案架构师。"},
        {"role": "user", "content": prompt}
    ]

    try:
        summary = await chat_completion(messages, db, temperature=0.3, max_tokens=400)
    except Exception:
        summary = f"根据维度分析，综合得分 {verdict_res.get('total', 0)} 分，结论为：{verdict_label(verdict)}。"

    return {
        "summary": summary.strip(),
        "consistent": True,
        "corrected": False
    }


def template_summary(ctx: Dict[str, Any]) -> str:
    verdict_res = ctx.get("results", {}).get("calculate_verdict", {})
    v = verdict_res.get("verdict", "can") if isinstance(verdict_res, dict) else "can"
    total = verdict_res.get("total", 0) if isinstance(verdict_res, dict) else 0
    return f"综合评估结果：{verdict_label(v)}，总分 {total} 分。"
