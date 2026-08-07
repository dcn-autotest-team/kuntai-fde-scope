import json
import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.agent.llm import chat_completion_stream

logger = logging.getLogger("chat_router")
router = APIRouter(tags=["Chat"])

SYSTEM_PROMPT = """你是「神州鲲泰 FDE 团队 AI 助手」，基于 Nanobot 微智能体引擎驱动。你的职责是帮助用户快速了解 FDE 团队的能力边界、服务范围和工作模式。

## 核心知识

FDE（Forward Deployed Engineering）定位为连接客户业务、IT 环境与 AI 应用能力的前线工程小队。

### 可以独立推进的工作
- AI 场景诊断、需求拆解、MVP 路线图
- RAG / 企业知识库 / 智能问答 PoC
- Agent / 工作流自动化半自动原型
- 测试用例、Badcase 分析、模型与接口评测
- 私有化推理部署验证、GPU/服务器测试
- 客户环境接入、连通性排查与部署协同

### 需要外部支持
- 生产级 AI 平台架构与复杂权限体系
- 高并发、多租户、灾备、审计与计费体系
- 复杂企业系统深度集成
- 垂直行业深水区高风险业务判断

### 触发红线（不能做）
- 端到端负责客户 AI 转型成败
- 无人审核的自动决策系统
- 生产环境 7x24 运维 SLA
- 大型核心网络或核心系统改造总包
- 纯战略咨询，只出报告不落地
- 从零训练大模型、基座模型研发

### 推荐服务包
1. AI 场景诊断工作坊（3-5 天）
2. RAG / 知识库 PoC（1-3 周）
3. Agent / 流程自动化 MVP（2-4 周）
4. AI 应用测试评估（1-2 周）
5. 私有化推理部署验证（1-3 周）
6. 客户环境接入与部署协同（视环境而定）

## 回复要求
- 简洁专业，聚焦 FDE 能力边界与相关技术主题
- 不要使用大量 emoji 表情
- 若开启了联网搜索，请结合网页检索内容提供最新最准确的解答并说明参考信息
- 回复使用中文"""


def perform_web_search(query: str, max_results: int = 3) -> List[Dict[str, str]]:
    """Perform real-time web search using ddgs package."""
    try:
        from ddgs import DDGS
        results = list(DDGS().text(query, max_results=max_results))
        formatted = []
        for item in results:
            if isinstance(item, dict):
                formatted.append({
                    "title": str(item.get("title", "")),
                    "url": str(item.get("href", "")),
                    "snippet": str(item.get("body", ""))
                })
        return formatted
    except Exception as e:
        logger.warning(f"Web search failed: {e}")
        return []


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    web_search: bool = False


@router.post("/chat")
async def chat_stream(req: ChatRequest, db: Session = Depends(get_db)):
    """SSE streaming chat endpoint with optional Web Search support."""
    latest_user_query = ""
    for msg in reversed(req.messages):
        if msg.role == "user" and msg.content.strip():
            latest_user_query = msg.content.strip()
            break

    search_results = []
    system_prompt_addon = ""

    # Perform web search if requested or auto-enabled
    if req.web_search and latest_user_query:
        search_results = perform_web_search(latest_user_query, max_results=3)
        if search_results:
            search_lines = [f"- 标题: {r['title']}\n  链接: {r['url']}\n  摘要: {r['snippet']}" for r in search_results]
            system_prompt_addon = "\n\n## 实时联网检索到的网页信息 (Web Search Results)\n" + "\n\n".join(search_lines) + "\n\n请结合上述最新的网页检索内容，客观详尽地回答用户问题。"

    # Build prompt messages
    messages = [{"role": "system", "content": SYSTEM_PROMPT + system_prompt_addon}]
    for msg in req.messages[-20:]:  # Keep last 20 messages
        messages.append({"role": msg.role, "content": msg.content})

    async def sse_generator():
        try:
            # Emit search results metadata if available
            if search_results:
                search_data = json.dumps({
                    "type": "search",
                    "results": search_results
                }, ensure_ascii=False)
                yield f"data: {search_data}\n\n"

            async for chunk in chat_completion_stream(messages, db, temperature=0.5, max_tokens=2000):
                data = json.dumps({"content": chunk}, ensure_ascii=False)
                yield f"data: {data}\n\n"
            yield "data: [DONE]\n\n"
        except ValueError as e:
            error_data = json.dumps({"error": str(e)}, ensure_ascii=False)
            yield f"data: {error_data}\n\n"
        except Exception as e:
            error_data = json.dumps({"error": f"对话服务异常: {str(e)}"}, ensure_ascii=False)
            yield f"data: {error_data}\n\n"

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

