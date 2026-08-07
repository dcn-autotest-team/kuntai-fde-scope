"""
Redline Risk Compliance Audit Tool
Audits requirement analysis decisions for redline compliance risks.
"""

from typing import Dict, Any
from app.agent.tools.base import register_tool


@register_tool("check_redlines", "红线专项复核")
async def tool_check_redlines(ctx: Dict[str, Any]) -> Dict[str, Any]:
    dimensions = ctx.get("dimensions", [])
    analyze_res = ctx.get("results", {}).get("analyze_dimensions", {})
    decisions = analyze_res.get("decisions", []) if isinstance(analyze_res, dict) else []

    dim_dict = {d["id"]: d for d in dimensions if isinstance(d, dict) and "id" in d}
    redflags = []

    for item in decisions:
        if not isinstance(item, dict):
            continue
        dim_id = item.get("dimension_id")
        opt_idx = item.get("option_index", 0)
        dim = dim_dict.get(dim_id)
        if dim and isinstance(dim.get("options"), list) and 0 <= opt_idx < len(dim["options"]):
            opt = dim["options"][opt_idx]
            if opt.get("redflag"):
                redflags.append({
                    "dimension_id": dim_id,
                    "dimension_title": dim.get("title", dim_id),
                    "option_label": opt.get("label", ""),
                    "reason": item.get("reason", "")
                })

    return {
        "hasRedFlag": len(redflags) > 0,
        "redflags": redflags,
        "note": f"检测到 {len(redflags)} 处红线风险" if redflags else "未发现触犯红线场景"
    }
