import json
import asyncio
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database.session import get_db, SessionLocal
from app.database.models import Case, Lesson
from app.schemas.schemas import AnalyzeRequest, FeedbackRequest
from app.agent.core import run_agent, generate_lessons_from_corrections

router = APIRouter(tags=["Agent"])

@router.post("/agent/analyze")
async def analyze_agent(req: AnalyzeRequest, request: Request):
    async def sse_generator():
        yield ": connected\n\n"
        
        queue = asyncio.Queue()
        
        async def emit(event: str, data: Dict[str, Any]):
            await queue.put({"event": event, "data": data})

        # 在单独的后台 task 中以新的 Session 运行 Nanobot Agent Loop
        async def task_runner():
            db = SessionLocal()
            try:
                await run_agent(req.model_dump(), db, emit)
            except Exception as e:
                await emit("error", {"message": str(e) or "分析失败，请重试"})
            finally:
                db.close()
                await queue.put(None)  # 终止信号

        asyncio.create_task(task_runner())

        while True:
            if await request.is_disconnected():
                break
            try:
                msg = await asyncio.wait_for(queue.get(), timeout=0.5)
                if msg is None:
                    break
                event_type = msg["event"]
                data_str = json.dumps(msg["data"], ensure_ascii=False)
                yield f"event: {event_type}\ndata: {data_str}\n\n"
            except asyncio.TimeoutError:
                continue

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@router.post("/agent/feedback")
async def agent_feedback(req: FeedbackRequest, db: Session = Depends(get_db)):
    if not req.caseId or not isinstance(req.confirmations, list):
        raise HTTPException(status_code=400, detail="参数不完整")

    case_item = db.query(Case).filter(Case.id == req.caseId).first()
    if not case_item:
        raise HTTPException(status_code=404, detail="案例不存在")

    confirmations_data = [c.model_dump() for c in req.confirmations]
    corrections = []
    ai_decs = case_item.ai_decisions or []

    for conf in confirmations_data:
        ai_match = next((d for d in ai_decs if d.get("dimension_id") == conf["dimension_id"]), None)
        if ai_match and int(ai_match.get("option_index", -1)) != int(conf["option_index"]):
            corrections.append({
                "dimension_id": conf["dimension_id"],
                "ai_option_index": int(ai_match.get("option_index", 0)),
                "user_option_index": int(conf["option_index"])
            })

    import time
    case_item.confirmations = confirmations_data
    case_item.corrections = corrections
    case_item.feedback_at = int(time.time() * 1000)
    db.commit()

    new_lessons = []
    if corrections:
        try:
            new_lessons = await generate_lessons_from_corrections(case_item, corrections, db)
        except Exception:
            pass

    return {
        "ok": True,
        "corrections": len(corrections),
        "lessons": new_lessons,
        "stats": calculate_stats(db)
    }

@router.get("/agent/stats")
def get_agent_stats(db: Session = Depends(get_db)):
    return calculate_stats(db)

def calculate_stats(db: Session) -> Dict[str, Any]:
    cases = db.query(Case).all()
    lessons = db.query(Lesson).all()

    total_cases = len(cases)
    confirmed_cases = [c for c in cases if c.confirmations]
    
    total_suggestions = 0
    accepted_suggestions = 0

    for c in confirmed_cases:
        ai_count = len(c.ai_decisions or [])
        corr_count = len(c.corrections or [])
        acc = max(0, ai_count - corr_count)
        total_suggestions += ai_count
        accepted_suggestions += acc

    acceptance_rate = round((accepted_suggestions / total_suggestions) * 100) if total_suggestions > 0 else None

    return {
        "totalCases": total_cases,
        "confirmedCases": len(confirmed_cases),
        "lessonCount": len(lessons),
        "totalSuggestions": total_suggestions,
        "acceptedSuggestions": accepted_suggestions,
        "acceptanceRate": acceptance_rate,
        "weekly": []
    }
