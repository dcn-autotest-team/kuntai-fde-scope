import uuid
import logging
from typing import Dict, Any, Callable, Awaitable, List
from sqlalchemy.orm import Session

from app.agent.nanobot import NanobotAgentAdapter
from app.agent.tools import tool_registry, reflect, template_summary, verdict_label
from app.agent.retrieve import retrieve_similar_cases, retrieve_lessons
from app.agent.planner import create_plan, default_plan
from app.agent.llm import chat_json
from app.agent.prompts import prompt_generate_lessons
from app.database.models import Case, Lesson

logger = logging.getLogger("agent.core")
nanobot = NanobotAgentAdapter(tool_registry)

def safe_data(tool_name: str, result: Dict[str, Any]) -> Dict[str, Any]:
    if tool_name == "retrieve_similar_cases":
        return {
            "cases": [{"excerpt": c["requirementText"][:80], "verdict": c["aiVerdict"], "similarity": c["similarity"]} for c in result.get("cases", [])],
            "lessons": [l["lesson"] for l in result.get("lessons", [])]
        }
    elif tool_name == "validate_requirement":
        return {"valid": result.get("valid"), "reason": result.get("reason")}
    elif tool_name == "analyze_dimensions":
        return {"decisions": result.get("decisions")}
    elif tool_name == "check_redlines":
        return {"redflags": result.get("redflags"), "note": result.get("note")}
    elif tool_name == "calculate_verdict":
        return {
            "verdict": result.get("verdict"),
            "total": result.get("total"),
            "hasRedFlag": result.get("hasRedFlag"),
            "redflagDimensions": result.get("redflagDimensions")
        }
    elif tool_name == "recommend_packages":
        return {"packages": result.get("packages")}
    elif tool_name == "reflect":
        return {"summary": result.get("summary"), "consistent": result.get("consistent"), "corrected": result.get("corrected")}
    return {}

def summarize_result(tool_name: str, result: Dict[str, Any]) -> str:
    if tool_name == "retrieve_similar_cases":
        cases_count = len(result.get("cases", []))
        lesson_count = result.get("lessonCount", 0)
        return f"命中 {cases_count} 个案例记忆、{lesson_count} 条规则经验" if cases_count else "暂无历史案例，本次判定将沉淀为新的经验"
    elif tool_name == "validate_requirement":
        return "输入为有效 AI 项目需求" if result.get("valid") else f"无效输入：{result.get('reason')}"
    elif tool_name == "analyze_dimensions":
        return f"完成 {len(result.get('decisions', []))} 个维度分析"
    elif tool_name == "check_redlines":
        reds = result.get("redflags", [])
        return f"发现 {len(reds)} 处红线风险" if reds else "未发现红线风险"
    elif tool_name == "calculate_verdict":
        return f"结论：{verdict_label(result.get('verdict', ''))}（总分 {result.get('total', 0)}）"
    elif tool_name == "recommend_packages":
        pkgs = [p["title"] for p in result.get("packages", [])]
        return f"推荐服务包：{'、'.join(pkgs)}"
    elif tool_name == "reflect":
        return "完成判定结论摘要生成"
    return ""

async def run_agent(
    params: Dict[str, Any],
    db: Session,
    emit: Callable[[str, Dict[str, Any]], Awaitable[None]]
):
    text = str(params.get("text") or "").strip()
    image_data_url = params.get("imageDataUrl")
    doc_text = str(params.get("docText") or "")[:8000] if params.get("docText") else None
    dimensions = params.get("dimensions") or []

    if not dimensions:
        raise ValueError("判定维度配置为空")
    if not text and not image_data_url and not doc_text:
        raise ValueError("请输入需求描述、上传图片或上传文档")

    ctx = {
        "text": text,
        "imageDataUrl": image_data_url,
        "docText": doc_text,
        "dimensions": dimensions,
        "db": db,
        "similarCases": [],
        "lessons": [],
        "results": {}
    }

    # 1. HKUDS Nanobot 记忆检索 (Memory Recall & Consolidation)
    await emit("tool_start", {
        "tool": "retrieve_similar_cases",
        "label": "Nanobot 记忆库检索 (Memory Recall)",
        "purpose": "从 Nanobot MemoryStore 检索 Episodic 案例记忆与 Evolutionary 进化规则"
    })
    query_text = f"{text} {doc_text[:500] if doc_text else ''}".strip()
    cases = retrieve_similar_cases(query_text, db, top_k=3)
    lessons = retrieve_lessons(query_text, db, top_k=6)

    ctx["similarCases"] = cases
    ctx["lessons"] = lessons
    retrieval_res = {"cases": cases, "lessons": lessons, "lessonCount": len(lessons)}
    ctx["results"]["retrieve_similar_cases"] = retrieval_res

    await emit("tool_result", {
        "tool": "retrieve_similar_cases",
        "label": "Nanobot 记忆库检索 (Memory Recall)",
        "summary": summarize_result("retrieve_similar_cases", retrieval_res),
        "data": safe_data("retrieve_similar_cases", retrieval_res)
    })

    # 2. HKUDS Nanobot 规划驱动 (Agent Task Planning)
    await emit("plan_start", {})
    try:
        plan = await create_plan(ctx, db)
    except Exception:
        plan = default_plan()

    await emit("plan", {
        "reasoning": plan["reasoning"],
        "steps": [{"tool": s["tool"], "label": getattr(tool_registry.get(s["tool"]), "label", s["tool"]), "purpose": s["purpose"]} for s in plan["steps"]],
        "fallback": plan.get("fallback", False)
    })

    # 3. 按 Nanobot 计划驱动 Tool 执行 Loop
    for step in plan["steps"]:
        tool_name = step["tool"]
        result = await nanobot.execute_tool(tool_name, ctx, emit)
        if result is None:
            continue

        ctx["results"][tool_name] = result

        await emit("tool_result", {
            "tool": tool_name,
            "label": getattr(tool_registry.get(tool_name), "label", tool_name),
            "summary": summarize_result(tool_name, result),
            "data": safe_data(tool_name, result)
        })

        if tool_name == "validate_requirement" and result.get("valid") is False:
            await emit("reflection", {"summary": result.get("reason"), "consistent": True, "shortCircuited": True})
            await emit("done", {
                "caseId": None,
                "valid": False,
                "validityReason": result.get("reason", "需求描述不清晰或不完整。")
            })
            return

    # 补算兜底
    if "calculate_verdict" not in ctx["results"] and "analyze_dimensions" in ctx["results"]:
        calc_res = await nanobot.execute_tool("calculate_verdict", ctx, emit)
        ctx["results"]["calculate_verdict"] = calc_res
        await emit("tool_result", {
            "tool": "calculate_verdict",
            "label": getattr(tool_registry.get("calculate_verdict"), "label", "计算判定结论"),
            "summary": summarize_result("calculate_verdict", calc_res),
            "data": safe_data("calculate_verdict", calc_res)
        })

    verdict_res = ctx["results"].get("calculate_verdict")
    if not verdict_res:
        raise ValueError("未能完成维度分析，请重试")

    # 4. 反思
    await emit("tool_start", {
        "tool": "reflect",
        "label": "一致性反思与摘要生成",
        "purpose": "校验分析摘要与判定结论一致性并生成简报"
    })
    try:
        reflection_res = await reflect(ctx)
    except Exception:
        reflection_res = {"summary": template_summary(ctx), "consistent": True, "corrected": False}

    await emit("tool_result", {
        "tool": "reflect",
        "label": "一致性反思与摘要生成",
        "summary": summarize_result("reflect", reflection_res),
        "data": safe_data("reflect", reflection_res)
    })
    await emit("reflection", reflection_res)

    # 5. 持久化新建案例到 SQLAlchemy
    decisions = ctx["results"].get("analyze_dimensions", {}).get("decisions", [])
    packages = ctx["results"].get("recommend_packages", {}).get("packages", [])

    new_case = Case(
        id=str(uuid.uuid4()),
        requirement_text=(text or (f"[文档] {doc_text[:200]}" if doc_text else "[图片需求]"))[:2000],
        has_image=bool(image_data_url),
        has_doc=bool(doc_text),
        ai_decisions=decisions,
        ai_verdict=verdict_res.get("verdict"),
        ai_summary=reflection_res.get("summary", ""),
        ai_packages=packages
    )
    db.add(new_case)
    db.commit()

    await emit("done", {
        "caseId": new_case.id,
        "valid": True,
        "decisions": verdict_res.get("details", []),
        "verdict": verdict_res.get("verdict"),
        "total": verdict_res.get("total"),
        "hasRedFlag": verdict_res.get("hasRedFlag"),
        "redflagDimensions": verdict_res.get("redflagDimensions"),
        "summary": reflection_res.get("summary"),
        "packages": packages
    })

async def generate_lessons_from_corrections(
    case_item: Case,
    corrections: List[Dict[str, Any]],
    db: Session
) -> List[str]:
    detail_lines = []
    for c in corrections:
        ai_dec = next((d for d in (case_item.ai_decisions or []) if d.get("dimension_id") == c["dimension_id"]), {})
        detail_lines.append(
            f"- 维度「{c['dimension_id']}」: AI 选择第 {c['ai_option_index']} 项（{ai_dec.get('reason', '无理由')}），人工纠正为第 {c['user_option_index']} 项"
        )
    detail_text = "\n".join(detail_lines)

    prompt = prompt_generate_lessons(case_item.requirement_text or "", detail_text)
    messages = [
        {"role": "system", "content": "你是严格输出 JSON 的经验沉淀模块。"},
        {"role": "user", "content": prompt}
    ]


    parsed = await chat_json(messages, db, temperature=0.3, fallback=None)
    saved_lessons = []
    if parsed and isinstance(parsed.get("lessons"), list):
        for item in parsed["lessons"]:
            text = str(item.get("lesson") or "").strip()
            if text:
                # 检查去重
                exists = db.query(Lesson).filter(Lesson.lesson == text).first()
                if not exists:
                    new_lesson = Lesson(
                        id=str(uuid.uuid4()),
                        lesson=text[:500],
                        context=(case_item.requirement_text or "")[:300],
                        dimension_id=item.get("dimension_id")
                    )
                    db.add(new_lesson)
                    saved_lessons.append(text)
        db.commit()

    return saved_lessons
