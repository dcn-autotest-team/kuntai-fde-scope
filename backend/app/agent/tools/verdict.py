"""
Verdict Calculator Tool
Calculates final evaluation verdict ('can', 'maybe', 'no') and total score based on dimension options and redlines.
"""

from typing import Dict, Any
from app.agent.tools.base import register_tool


@register_tool("calculate_verdict", "计算判定结论")
async def tool_calculate_verdict(ctx: Dict[str, Any]) -> Dict[str, Any]:
    dimensions = ctx.get("dimensions", [])
    analyze_res = ctx.get("results", {}).get("analyze_dimensions", {})
    decisions = analyze_res.get("decisions", []) if isinstance(analyze_res, dict) else []

    dim_dict = {d["id"]: d for d in dimensions if isinstance(d, dict) and "id" in d}
    total_score = 0
    has_redflag = False
    redflag_dims = []
    details = []

    for item in decisions:
        if not isinstance(item, dict):
            continue
        dim_id = item.get("dimension_id")
        opt_idx = item.get("option_index", 0)
        dim = dim_dict.get(dim_id)
        if dim and isinstance(dim.get("options"), list) and 0 <= opt_idx < len(dim["options"]):
            opt = dim["options"][opt_idx]
            score = opt.get("score", 0)
            is_red = opt.get("redflag", False)
            total_score += score
            if is_red:
                has_redflag = True
                redflag_dims.append(dim_id)
            details.append({
                "dimension_id": dim_id,
                "dimension_title": dim.get("title", dim_id),
                "option_index": opt_idx,
                "option_label": opt.get("label", ""),
                "score": score,
                "redflag": is_red,
                "reason": item.get("reason", "")
            })

    if has_redflag:
        verdict = "no"
    elif total_score >= 8:
        verdict = "can"
    elif total_score >= 4:
        verdict = "maybe"
    else:
        verdict = "no"

    return {
        "verdict": verdict,
        "total": total_score,
        "hasRedFlag": has_redflag,
        "redflagDimensions": redflag_dims,
        "details": details
    }
