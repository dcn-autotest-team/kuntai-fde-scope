import uuid
import time
import hashlib
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database.session import get_db
from app.database.models import SysConfig, Lesson, Case, AdminToken
from app.schemas.schemas import AdminLoginRequest, AdminLoginResponse, UpdateLessonRequest, CreateLessonRequest

router = APIRouter(tags=["Admin"])

def hash_password(pwd: str) -> str:
    return hashlib.sha256(pwd.encode("utf-8")).hexdigest()

def issue_token(db: Session) -> str:
    token = str(uuid.uuid4())
    expire = int(time.time() * 1000) + settings.TOKEN_TTL_HOURS * 3600 * 1000
    db_token = AdminToken(token=token, expire_at=expire)
    db.add(db_token)
    db.commit()
    return token

def verify_token(x_admin_token: str = Header(None, alias="x-admin-token"), db: Session = Depends(get_db)):
    if not x_admin_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未提供管理员 Token")
    rec = db.query(AdminToken).filter(AdminToken.token == x_admin_token).first()
    if not rec:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token 无效或已过期")
    if int(time.time() * 1000) > rec.expire_at:
        db.delete(rec)
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token 已过期，请重新登录")
    return rec

@router.post("/admin/login", response_model=AdminLoginResponse)
def admin_login(req: AdminLoginRequest, db: Session = Depends(get_db)):
    if not req.password or hash_password(req.password) != settings.ADMIN_PWD_HASH:
        return AdminLoginResponse(ok=False, message="密码错误，请重试")
    
    token = issue_token(db)
    config_record = db.query(SysConfig).first()
    cfg_data = {
        "endpoint": config_record.endpoint if config_record else settings.DEFAULT_ENDPOINT,
        "apiKey": config_record.api_key if config_record else settings.DEFAULT_API_KEY,
        "model": config_record.model if config_record else settings.DEFAULT_MODEL
    }
    return AdminLoginResponse(ok=True, token=token, config=cfg_data)

INITIAL_SEED_LESSONS = [
    {
        "lesson": "涉及底层内核模块开发或硬件驱动自主研发的需求，需严格评估鲲泰硬件规格与研发周期，避免盲目承诺交付能力。",
        "context": "客户提出要求定制开发专属 PCIe 拓展卡驱动与 Linux 内核补丁。",
        "dimension_id": "dim_tech_depth"
    },
    {
        "lesson": "对于大模型微调与私有化部署场景，必须明确标注算力显存与并发吞吐瓶颈，区分标准服务包与定制研发范畴。",
        "context": "客户需求包含千亿参数大模型私有化部署及多卡并行推理调优。",
        "dimension_id": "dim_ai_capacity"
    },
    {
        "lesson": "纯纯软件或第三方开源系统的日常运维支持，原则上应引导推荐 FDE 交付运维标准服务包，不提供无界限保底兜底。",
        "context": "客户要求包含 7x24 小时第三方开源软件无限制故障排查服务。",
        "dimension_id": "dim_service_scope"
    }
]

@router.get("/admin/lessons")
def get_admin_lessons(db: Session = Depends(get_db), auth=Depends(verify_token)):
    lessons = db.query(Lesson).order_by(Lesson.created_at.desc()).all()
    
    # 若经验库为空，自动初始化种子经验，提升展示与体验
    if not lessons:
        for seed in INITIAL_SEED_LESSONS:
            item = Lesson(
                lesson=seed["lesson"],
                context=seed["context"],
                dimension_id=seed["dimension_id"]
            )
            db.add(item)
        db.commit()
        lessons = db.query(Lesson).order_by(Lesson.created_at.desc()).all()

    cases = db.query(Case).all()
    result = []
    for l in lessons:
        source_case = None
        if l.context and isinstance(l.context, str):
            for c in reversed(cases):
                req_text = c.requirement_text or ""
                if req_text and (req_text[:200] == l.context or req_text.startswith(l.context[:60])):
                    source_case = {
                        "id": c.id,
                        "requirementText": req_text,
                        "aiVerdict": c.ai_verdict,
                        "corrections": c.corrections,
                        "createdAt": c.created_at,
                        "feedbackAt": c.feedback_at
                    }
                    break
        result.append({
            "id": l.id,
            "lesson": l.lesson,
            "context": l.context,
            "dimensionId": l.dimension_id,
            "createdAt": l.created_at,
            "sourceCase": source_case
        })
    return {"ok": True, "lessons": result}

@router.post("/admin/lessons")
def create_lesson(req: CreateLessonRequest, db: Session = Depends(get_db), auth=Depends(verify_token)):
    if not (req.lesson or "").strip():
        raise HTTPException(status_code=400, detail="经验内容不能为空")
    
    l = Lesson(
        lesson=req.lesson.strip()[:500],
        context=(req.context or "").strip()[:300] if req.context else None,
        dimension_id=req.dimensionId or "general"
    )
    db.add(l)
    db.commit()
    db.refresh(l)
    return {"ok": True, "lesson": {"id": l.id, "lesson": l.lesson, "context": l.context, "dimensionId": l.dimension_id}}

@router.put("/admin/lessons/{lesson_id}")
def update_lesson(lesson_id: str, req: UpdateLessonRequest, db: Session = Depends(get_db), auth=Depends(verify_token)):
    if not (req.lesson or "").strip():
        raise HTTPException(status_code=400, detail="经验内容不能为空")
    
    l = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not l:
        raise HTTPException(status_code=404, detail="经验条目不存在")
    
    l.lesson = req.lesson.strip()[:500]
    if req.context is not None:
        l.context = req.context.strip()[:300]
    if req.dimensionId is not None:
        l.dimension_id = req.dimensionId
    db.commit()
    return {"ok": True, "lesson": {"id": l.id, "lesson": l.lesson, "context": l.context, "dimensionId": l.dimension_id}}

@router.delete("/admin/lessons/{lesson_id}")
def delete_lesson(lesson_id: str, db: Session = Depends(get_db), auth=Depends(verify_token)):
    l = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not l:
        raise HTTPException(status_code=404, detail="经验条目不存在")
    db.delete(l)
    db.commit()
    return {"ok": True}
