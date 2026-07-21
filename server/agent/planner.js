// Agent 规划器：LLM 根据需求与历史案例自主制定分析计划
const { chatJson, buildUserContent } = require('./llm');

const AVAILABLE_TOOLS = [
  { name: 'validate_requirement', desc: '校验输入是否为清晰、具体、可执行的 AI 项目需求（必须第一个执行）' },
  { name: 'analyze_dimensions', desc: '按判定维度逐一分析需求并给出选项建议与理由' },
  { name: 'check_redlines', desc: '红线专项复核：7x24 SLA、无人审核自动决策、生产级总包、底层模型研发、越权操作等' },
  { name: 'calculate_verdict', desc: '根据维度分值与红线确定性计算最终判定结论（必须在维度分析之后执行）' },
  { name: 'recommend_packages', desc: '根据判定结果推荐 FDE 服务包（最后执行）' }
];

// 兜底计划：LLM 规划失败时使用
function defaultPlan() {
  return {
    reasoning: '按标准流程执行：有效性校验 → 维度分析 → 红线复核 → 结论计算 → 服务包推荐。',
    steps: [
      { tool: 'validate_requirement', purpose: '校验需求有效性' },
      { tool: 'analyze_dimensions', purpose: '分析全部判定维度' },
      { tool: 'check_redlines', purpose: '红线专项复核' },
      { tool: 'calculate_verdict', purpose: '计算判定结论' },
      { tool: 'recommend_packages', purpose: '推荐服务包' }
    ],
    fallback: true
  };
}

function sanitizePlan(parsed) {
  if (!parsed || !Array.isArray(parsed.steps) || !parsed.steps.length) return defaultPlan();
  const validNames = new Set(AVAILABLE_TOOLS.map((t) => t.name));
  const steps = [];
  for (const step of parsed.steps) {
    const tool = String(step?.tool || '');
    if (!validNames.has(tool)) continue;
    if (steps.some((s) => s.tool === tool)) continue; // 每个工具最多执行一次
    steps.push({ tool, purpose: String(step?.purpose || '').slice(0, 100) || tool });
  }
  if (!steps.length) return defaultPlan();

  // 强制约束：有效性校验必须第一；结论计算必须在维度分析之后；服务包推荐最后
  steps.sort((a, b) => orderWeight(a.tool) - orderWeight(b.tool));
  if (steps[0].tool !== 'validate_requirement') {
    steps.unshift({ tool: 'validate_requirement', purpose: '校验需求有效性' });
  }
  return { reasoning: String(parsed.reasoning || '').slice(0, 300), steps, fallback: false };
}

function orderWeight(tool) {
  return {
    validate_requirement: 0,
    analyze_dimensions: 1,
    check_redlines: 2,
    calculate_verdict: 3,
    recommend_packages: 4
  }[tool] ?? 5;
}

async function createPlan(ctx) {
  const toolList = AVAILABLE_TOOLS.map((t) => `- ${t.name}：${t.desc}`).join('\n');
  const caseHint = ctx.similarCases.length
    ? `\n## 历史相似案例（供参考）\n${ctx.similarCases.map((c, i) => `${i + 1}. ${c.requirementText.slice(0, 120)}（结论：${c.aiVerdict || '未知'}）`).join('\n')}`
    : '';

  const prompt = `你是神州鲲泰 FDE 需求判定 Agent 的规划器。请根据用户输入，制定一份分析计划。

## 可用工具
${toolList}

## 用户输入
${ctx.text || '（无文字描述）'}${ctx.imageDataUrl ? '\n（用户附带一张图片）' : ''}${ctx.docText ? '\n（用户附带一份文档，摘要：' + ctx.docText.slice(0, 300) + '）' : ''}${caseHint}

## 计划规则
1. validate_requirement 必须第一个执行
2. 如果输入明显不是有效需求（闲聊、反问、乱码），计划只保留 validate_requirement 一步
3. calculate_verdict 必须在 analyze_dimensions 和 check_redlines 之后
4. recommend_packages 只能最后执行
5. 每个工具最多出现一次

## 输出要求
只输出 JSON：{ "reasoning": "规划思路（一句话）", "steps": [ { "tool": "工具名", "purpose": "该步骤目标" } ] }`;

  const parsed = await chatJson({
    messages: [
      { role: 'system', content: '你是严格输出 JSON 的规划器，不输出任何非 JSON 内容。' },
      { role: 'user', content: buildUserContent(prompt, null) }
    ],
    temperature: 0.2,
    maxTokens: 600,
    fallback: null
  });

  return sanitizePlan(parsed);
}

module.exports = { createPlan, defaultPlan, AVAILABLE_TOOLS };
