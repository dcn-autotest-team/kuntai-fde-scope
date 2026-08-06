"""
Dimension Analysis Tool
Analyzes client requirements across 6 FDE dimensions using LLM and recalled memory rules.
"""

from typing import Dict, Any
from app.agent.tools.base import register_tool
from app.agent.prompts import prompt_analyze_dimensions
from app.agent.llm import chat_json


@register_tool("analyze_dimensions", "维度智能分析")
async def tool_analyze_dimensions(ctx: Dict[str, Any]) -> Dict[str, Any]:
    text = ctx.get("text", "")
    doc_text = ctx.get("docText") or ""
    dimensions = ctx.get("dimensions", [])
    lessons = ctx.get("lessons", [])
    db = ctx["db"]

    combined_input = f"{text}\n\n[文档补充说明]\n{doc_text[:3000]}" if doc_text else text
    lesson_text = "\n".join([f"- {l['lesson']}" for l in lessons if isinstance(l, dict) and "lesson" in l]) or "无"

    dim_descriptions = []
    for d in dimensions:
        opts_str = "\n".join([f"   [{idx}] {opt['label']}" for idx, opt in enumerate(d.get("options", []))])
        dim_descriptions.append(f"维度 ID: {d['id']}\n标题: {d['title']}\n选项列表:\n{opts_str}")

    dims_str = "\n\n".join(dim_descriptions)
    prompt = prompt_analyze_dimensions(combined_input, lesson_text, dims_str)

    messages = [
        {"role": "system", "content": "你是严格输出 JSON 的需求判定分析助手。必须覆盖所有给出的维度 ID。"},
        {"role": "user", "content": prompt}
    ]

    parsed = await chat_json(messages, db, temperature=0.2, fallback=None)
    decisions = parsed.get("decisions", []) if isinstance(parsed, dict) else []

    dim_map = {d["dimension_id"]: d for d in decisions if isinstance(d, dict) and "dimension_id" in d}
    final_decisions = []

    for d in dimensions:
        dim_id = d.get("id")
        if dim_id in dim_map:
            item = dim_map[dim_id]
            try:
                idx = int(item.get("option_index", 0))
                if idx < 0 or idx >= len(d.get("options", [])):
                    idx = 0
            except Exception:
                idx = 0
            final_decisions.append({
                "dimension_id": dim_id,
                "option_index": idx,
                "reason": str(item.get("reason", "基于需求分析匹对"))
            })
        else:
            final_decisions.append({
                "dimension_id": dim_id,
                "option_index": 0,
                "reason": "匹配默认推荐项"
            })

    return {"decisions": final_decisions}
