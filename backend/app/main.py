from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database.session import engine, Base
from app.routers import agent_router, admin_router, config_router, page_router, chat_router

# 自动创表 (SQLite 或 MySQL)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="神州鲲泰 FDE 团队能力边界判定与展示系统 - FastAPI + Vue3 前后端分离版本 (Nanobot Agent 驱动)",
    version="3.0.0"
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 挂载 API 路由
app.include_router(agent_router.router, prefix=settings.API_PREFIX)
app.include_router(admin_router.router, prefix=settings.API_PREFIX)
app.include_router(config_router.router, prefix=settings.API_PREFIX)
app.include_router(page_router.router, prefix=settings.API_PREFIX)
app.include_router(chat_router.router, prefix=settings.API_PREFIX)

@app.get("/")
def root():
    return {
        "message": "神州鲲泰 FDE 团队能力边界判定系统 (FastAPI 后端已就绪)",
        "docs": "/docs"
    }
