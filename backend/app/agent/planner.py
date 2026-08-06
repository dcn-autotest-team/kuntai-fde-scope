from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.agent.llm import chat_json
from app.agent.prompts import prompt_plan_execution

def default_plan() -> Dict[str, Any]:
    return {
        "reasoning": "按标准 5 步流程执行：校验需求有效性 -> 维度智能分析 -> 红线专项复核 -> 计算判定结论 -> 推荐服务包",
        "steps": [
            {"tool": "validate_requirement", "purpose": "验证客户输入是否包含具体的 AI 项目需求描述"},
            {"tool": "analyze_dimensions", "purpose": "根据需求描述对 6 大维度逐一选出最匹配的选项"},
            {"tool": "check_redlines", "purpose": "复核是否存在触犯红线场景（越权操作、无人审核自动决策等）"},
            {"tool": "calculate_verdict", "purpose": "综合评分与红线规则得出最终结论：可以做/谨慎做/不能独立承接"},
            {"tool": "recommend_packages", "purpose": "基于分析结论匹配推荐神州鲲泰 FDE 标准服务包"}
        ],
        "fallback": True
    }

async def create_plan(ctx: Dict[str, Any], db: Session) -> Dict[str, Any]:
    text = ctx.get("text", "")
    doc_text = ctx.get("docText") or ""
    has_image = bool(ctx.get("imageDataUrl"))
    similar_cases = ctx.get("similarCases", [])
    lessons = ctx.get("lessons", [])

    case_snippets = "\n".join([f"- [相似度 {c['similarity']}] 结论: {c['aiVerdict']} 需求: {c['requirementText'][:80]}" for c in similar_cases]) or "无"
    lesson_snippets = "\n".join([f"- 经验: {l['lesson']}" for l in lessons]) or "无"

    prompt = prompt_plan_execution(text, has_image, doc_text, lesson_snippets, case_snippets)


    messages = [
        {"role": "system", "content": "你是严格输出 JSON 的规划模块，必须包含 validate_requirement、analyze_dimensions、check_redlines、calculate_verdict、recommend_packages。"},
        {"role": "user", "content": prompt}
    ]

    parsed = await chat_json(messages, db, temperature=0.2, fallback=None)
    if parsed and isinstance(parsed.get("steps"), list) and len(parsed["steps"]) >= 3:
        return {
            "reasoning": str(parsed.get("reasoning", "自定义规划流程")),
            "steps": parsed["steps"],
            "fallback": False
        }
    return default_plan()
