import time
import re
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.schemas import GeneratePageRequest, HealthResponse
from app.agent.llm import chat_completion

router = APIRouter(tags=["Page"])

@router.get("/health", response_model=HealthResponse)
def health_check():
    return HealthResponse(ok=True, agent=True, time=int(time.time() * 1000))

@router.post("/generate-page")
async def generate_page(req: GeneratePageRequest, db: Session = Depends(get_db)):
    if not req.dimensions:
        raise HTTPException(status_code=400, detail="判定维度配置缺失")

    answer_map = {a.get("dimension_id"): a for a in (req.answers or []) if isinstance(a, dict)}
    
    dim_details = []
    for i, q in enumerate(req.dimensions):
        ans = answer_map.get(q.get("id"))
        selected = None
        if ans and "option_index" in ans:
            try:
                idx = int(ans["option_index"])
                opts = q.get("options", [])
                if 0 <= idx < len(opts):
                    selected = opts[idx]
            except Exception:
                pass
        
        lbl = selected["label"] if selected else "未选择"
        score_str = f"（分值 {selected['score']}{'，红线' if selected.get('redflag') else ''}）" if selected else ""
        dim_details.append(f"{i + 1}. {q.get('title')}\n   客户选择：{lbl}{score_str}")

    dim_details_str = "\n".join(dim_details)
    package_list = "\n".join([f"- {p.get('title')}（周期：{p.get('duration')}）" for p in (req.packages or [])]) or "无"

    verdict_text = "可以做（属于 FDE 能力范围）" if req.verdict == "can" else "需要外部支持（可参与但不宜独立兜底）"

    prompt = f"""你是一位面向企业客户的神州鲲泰 FDE 解决方案架构师。

请基于以下需求判定结果，生成一个完整的、独立的、可直接部署的 HTML 项目展示页。

## 客户需求描述
{req.userText or '（未提供文字描述）'}

## 判定结论
- 综合结果：{verdict_text}
- 判定维度详情：
{dim_details_str}

## 推荐服务包
{package_list}

## 页面内容要求
1. 项目标题与概述：用一句话概括客户需求和 FDE 价值主张
2. 客户需求理解：清晰复述客户痛点/目标
3. FDE 解决方案定位：说明 FDE 团队能做什么、边界在哪里
4. 推荐服务包与交付周期：列出服务包、周期和交付物
5. 项目价值与预期收益：3-4 条量化或定性的收益
6. 后续行动建议（CTA）：明确的下一步，如"预约场景诊断工作坊"

## 样式要求
- 使用神州鲲泰品牌色 #c41230 作为主色
- 背景以白色/浅灰为主，深色页脚
- 内联所有 CSS，单文件可独立运行，无需额外依赖
- 响应式布局，适配移动端
- 简洁专业，适合向客户展示

## 输出要求
请只输出完整 HTML 代码，不要任何解释文字。代码用 ```html 包裹。"""

    messages = [
        {"role": "system", "content": "你是一个严格按要求输出 HTML 代码的解决方案架构师，只输出完整 HTML 代码，不输出任何解释。"},
        {"role": "user", "content": prompt}
    ]

    try:
        content = await chat_completion(messages, db, temperature=0.5, max_tokens=4000)
        match = re.search(r"```html\s*([\s\S]*?)```", content)
        html = (match.group(1) if match else content).strip()
        if not html:
            raise ValueError("未能从响应中提取 HTML 代码")
        return {"ok": True, "html": html}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e) or "生成失败")
