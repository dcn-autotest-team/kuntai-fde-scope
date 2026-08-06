"""
Service Package Recommender Tool
Matches standard Kuntai FDE delivery service packages based on verdict result.
"""

from typing import Dict, Any
from app.agent.tools.base import register_tool


@register_tool("recommend_packages", "推荐服务包")
async def tool_recommend_packages(ctx: Dict[str, Any]) -> Dict[str, Any]:
    verdict_res = ctx.get("results", {}).get("calculate_verdict", {})
    verdict = verdict_res.get("verdict", "can") if isinstance(verdict_res, dict) else "can"

    all_packages = [
        {"key": "diagnosis", "title": "AI 场景诊断工作坊", "duration": "3-5 天", "status": "can", "desc": "梳理场景清单、优先级矩阵与 MVP 路线图"},
        {"key": "rag", "title": "RAG / 知识库 PoC", "duration": "1-3 周", "status": "can", "desc": "文档解析、向量检索与 Prompt 优化验证"},
        {"key": "agent", "title": "Agent 原型搭建与工具接入", "duration": "2-4 周", "status": "can", "desc": "多步骤任务拆解、Tool Calling 原型开发"},
        {"key": "evaluation", "title": "AI 应用评估与测试用例设计", "duration": "1 周", "status": "can", "desc": " Badcase 分析与效果评测基准构建"},
        {"key": "deployment", "title": "推理部署与国产算力验证", "duration": "1-2 周", "status": "can", "desc": "环境连通性排查、Docker 基础部署与压测"}
    ]

    if verdict == "can":
        rec = all_packages[:3]
    elif verdict == "maybe":
        rec = [all_packages[0], all_packages[3]]
    else:
        rec = [all_packages[0]]

    return {"packages": rec}
