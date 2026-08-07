"""
LLM Prompt Templates Center
Centralized prompt templates for requirement validation, 6D matrix analysis, reflection, and lesson extraction.
"""

from typing import List, Dict, Any


def prompt_validate_requirement(combined_text: str) -> str:
    return f"""请判断以下输入是否包含具体的 IT / AI 应用落地需求描述（如知识库、 Agent、智能问答、推理部署、算法评估等）。

输入内容: {combined_text[:1000] if combined_text else '[包含上传图片]'}

输出 JSON 格式: {{ "valid": true/false, "reason": "说明原因" }}"""


def prompt_analyze_dimensions(combined_input: str, lesson_text: str, dims_str: str) -> str:
    return f"""你是神州鲲泰 FDE 团队的需求分析专家。请仔细阅读客户需求，对 6 个判定维度逐一选出最匹配的选项索引。

## 客户需求描述
{combined_input or '（客户上传了需求图片）'}

## 历史经验提示（参考）
{lesson_text}

## 判定维度说明
{dims_str}

## 输出要求
请只输出 JSON，格式如下：
{{
  "decisions": [
    {{ "dimension_id": "维度id", "option_index": 0, "reason": "一句话选择理由" }}
  ]
}}"""


def prompt_reflect_summary(text: str, verdict_label_text: str, detail_str: str) -> str:
    return f"""你是神州鲲泰 FDE 判定系统的反思模块。请根据判定明细生成一份简洁专业的结论摘要。

客户需求: {text[:300] or '需求描述'}
判定结论: {verdict_label_text}
维度选择:
{detail_str}

输出要求:
请输出一短段话（100-200字）总结需求的核心判定理由，语言客观专业。"""


def prompt_generate_lessons(requirement_text: str, detail_text: str) -> str:
    return f"""你是神州鲲泰 FDE 需求判定 Agent 的反思沉淀模块。人工专家纠正了 AI 的判定，请沉淀出可复用的判定经验。

## 当时的需求
{requirement_text[:500]}

## 纠正明细
{detail_text}

## 输出要求
只输出 JSON: {{ "lessons": [ {{ "dimension_id": "维度id", "lesson": "一条具体、可复用的判定经验（说明什么类型的需求在该维度应如何选择）" }} ] }}"""


def prompt_plan_execution(text: str, has_image: bool, doc_text: str, lesson_snippets: str, case_snippets: str) -> str:
    return f"""你是神州鲲泰 FDE 判定 Agent 的规划模块。请根据客户需求及检索到的历史经验，设计分析流程。

## 客户需求
文本: {text or '（无文本描述）'}
包含图片: {'是' if has_image else '否'}
文档片段: {doc_text[:300] or '无'}

## 检索到的历史经验
{lesson_snippets}

## 检索到的相似案例
{case_snippets}

## 可用工具库
1. validate_requirement: 校验是否属于有效 AI 项目需求描述
2. analyze_dimensions: 对 6 大维度逐一判定（必须执行）
3. check_redlines: 专项复核红线场景
4. calculate_verdict: 计算综合判定结论与得分（必须执行）
5. recommend_packages: 推荐服务包

请输出 JSON，格式如下：
{{
  "reasoning": "简要规划理由（1-2 句话）",
  "steps": [
    {{ "tool": "工具名", "purpose": "该步骤的具体目的" }}
  ]
}}"""

