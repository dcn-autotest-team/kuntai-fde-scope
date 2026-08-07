from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database.session import get_db
from app.database.models import SysConfig
from app.schemas.schemas import PublicConfigResponse, UpdateConfigRequest
from app.routers.admin_router import verify_token

router = APIRouter(tags=["Config"])

@router.get("/config", response_model=PublicConfigResponse)
def get_public_config(db: Session = Depends(get_db)):
    config_record = db.query(SysConfig).first()
    if config_record:
        return PublicConfigResponse(
            endpoint=config_record.endpoint or settings.DEFAULT_ENDPOINT,
            model=config_record.model or settings.DEFAULT_MODEL,
            hasKey=bool(config_record.api_key and config_record.api_key.strip())
        )
    return PublicConfigResponse(
        endpoint=settings.DEFAULT_ENDPOINT,
        model=settings.DEFAULT_MODEL,
        hasKey=bool(settings.DEFAULT_API_KEY)
    )

@router.post("/config")
def update_config(req: UpdateConfigRequest, db: Session = Depends(get_db), auth=Depends(verify_token)):
    config_record = db.query(SysConfig).first()
    if not config_record:
        config_record = SysConfig(
            endpoint=settings.DEFAULT_ENDPOINT,
            api_key=settings.DEFAULT_API_KEY,
            model=settings.DEFAULT_MODEL
        )
        db.add(config_record)
    
    if req.endpoint is not None and req.endpoint.strip():
        config_record.endpoint = req.endpoint.strip()
    if req.apiKey is not None:
        config_record.api_key = req.apiKey.strip()
    if req.model is not None and req.model.strip():
        config_record.model = req.model.strip()
    
    db.commit()
    return {
        "ok": True,
        "config": {
            "endpoint": config_record.endpoint,
            "model": config_record.model,
            "hasKey": bool(config_record.api_key and config_record.api_key.strip())
        }
    }
