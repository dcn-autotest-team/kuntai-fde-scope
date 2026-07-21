// Agent 工具集：有效性校验、维度分析、红线复核、结论计算、服务包推荐、反思
const { chatJson, buildUserContent } = require('./llm');

const PACKAGES = {
  diagnosis: { id: 'diagnosis', title: 'AI 场景诊断工作坊', duration: '3-5 天', status: 'can' },
  rag: { id: 'rag', title: 'RAG / 知识库 PoC', duration: '1-3 周', status: 'can' },
  agent: { id: 'agent', title: 'Agent / 流程自动化 MVP', duration: '2-4 周', status: 'caution' },
  evaluation: { id: 'evaluation', title: 'AI 应用测试评估', duration: '1-2 周', status: 'can' },
  deployment: { id: 'deployment', title: '私有化推理部署验证', duration: '1-3 周', status: 'caution' },
  environment: { id: 'environment', title: '客户环境接入与部署协同', duration: '视环境而定', status: 'caution' }
};

function dimensionText(dimensions) {
  return dimensions.map((q, i) =>
    `${i + 1}. 维度id=${q.id}｜${q.title}\n   选项：${q.options.map((o, j) => `[${j}] ${o.label}（分值 ${o.score}${o.redflag ? '，红线' : ''}）`).join(' | ')}`
  ).join('\n');
}

function requirementText(ctx) {
  let text = ctx.text || '（无文字描述）';
  if (ctx.docText) {
    text += '\n\n## 附带文档内容\n--- 文档开始 ---\n' + ctx.docText.slice(0, 8000) + '\n--- 文档结束 ---';
  }
  return text;
}

// ── 工具 1：需求有效性校验 ───────────────────────────────────────────────────
async function validateRequirement(ctx) {
  const prompt = `你是神州鲲泰 FDE 需求准入审核员。请判断以下输入是否为一个有效的 AI 项目需求。

## 输入内容
${requirementText(ctx)}${ctx.imageDataUrl ? '\n（用户同时上传了一张图片，请结合图片内容判断。）' : ''}

## 有效需求标准（必须同时满足）
1. 是清晰、具体、可执行的 AI 应用场景
2. 包含客户要做什么、解决什么问题或交付什么
3. 不直接触碰 FDE 红线：7x24 SLA、长期运维托管、生产级总包、从零训练大模型/底层模型研发、越权操作生产环境、无人审核的高风险自动决策、完整 AI 平台/中台建设

如果只是闲聊、反问、胡言乱语、过度简短、与 AI 项目无关，或明确触碰红线，判定为无效。

## 输出要求
只输出 JSON：{ "valid": true 或 false, "reason": "判定理由（一句话，无效时说明如何补充）" }`;

  const parsed = await chatJson({
    messages: [
      { role: 'system', content: '你是严格输出 JSON 的审核员，不输出任何非 JSON 内容。' },
      { role: 'user', content: buildUserContent(prompt, ctx.imageDataUrl) }
    ],
    temperature: 0.2,
    maxTokens: 300,
    fallback: null
  });

  if (!parsed || typeof parsed.valid !== 'boolean') {
    // 解析失败时保守放行，交由后续维度分析与人工确认把关
    return { valid: true, reason: '有效性校验结果异常，转入人工确认流程。', degraded: true };
  }
  return { valid: parsed.valid, reason: String(parsed.reason || '') };
}

// ── 工具 2：维度分析（few-shot 注入历史案例与经验，进化生效点） ────────────────
async function analyzeDimensions(ctx) {
  const caseSection = ctx.similarCases.length
    ? `\n## 历史相似案例（经人工确认的正确判定，请参考其判断口径）\n${ctx.similarCases.map((c, i) => {
        const decisions = (c.confirmations || c.aiDecisions || [])
          .map((d) => {
            const q = ctx.dimensions.find((x) => x.id === d.dimension_id);
            const opt = q?.options?.[Number(d.option_index)];
            return q && opt ? `「${q.title}」→「${opt.label}」` : null;
          })
          .filter(Boolean)
          .join('；');
        return `案例${i + 1}：${c.requirementText.slice(0, 200)}\n判定：${decisions || '（无明细）'}（结论：${verdictLabel(c.aiVerdict)}）`;
      }).join('\n\n')}\n`
    : '';

  const lessonSection = ctx.lessons.length
    ? `\n## 历史经验（从人工纠正中沉淀，判定时必须遵守）\n${ctx.lessons.map((l, i) => `${i + 1}. ${l.lesson}`).join('\n')}\n`
    : '';

  const prompt = `你是神州鲲泰 FDE 需求分析专家。请根据以下 ${ctx.dimensions.length} 个判定维度分析该需求，为每个维度选择最合适的选项。

## 判定维度与选项
${dimensionText(ctx.dimensions)}
${caseSection}${lessonSection}
## 用户需求
${requirementText(ctx)}${ctx.imageDataUrl ? '\n（用户同时上传了一张图片，请结合图片内容一起分析。）' : ''}

## 输出要求
只输出 JSON：
{
  "decisions": [
    { "dimension_id": "维度id", "option_index": 选项序号（从0开始）, "reason": "简短理由" }
  ],
  "draft_summary": "整体分析摘要（一两句话）"
}

注意：
- 每个维度必须选择一个选项，dimension_id 必须严格使用上方给出的维度id
- 参考历史相似案例的判定口径，但不要机械照搬，以当前需求事实为准
- 历史经验是人工纠正后的结论，优先级高于你的直觉判断
- 如果需求触发任何红线选项，请如实选择对应红线选项`;

  const parsed = await chatJson({
    messages: [
      { role: 'system', content: '你是严格输出 JSON 的需求分析专家，不输出任何非 JSON 内容。' },
      { role: 'user', content: buildUserContent(prompt, ctx.imageDataUrl) }
    ],
    temperature: 0.3,
    maxTokens: 1500,
    fallback: null
  });

  const decisions = Array.isArray(parsed?.decisions) ? parsed.decisions : [];
  // 过滤非法决策，保证 dimension_id 与 option_index 有效
  const validDecisions = [];
  for (const d of decisions) {
    const q = ctx.dimensions.find((x) => x.id === d.dimension_id);
    const idx = Number(d.option_index);
    if (q && Number.isInteger(idx) && idx >= 0 && idx < q.options.length) {
      validDecisions.push({ dimension_id: q.id, option_index: idx, reason: String(d.reason || '').slice(0, 200) });
    }
  }
  if (!validDecisions.length) throw new Error('维度分析结果为空或格式异常');

  return { decisions: validDecisions, draftSummary: String(parsed?.draft_summary || '') };
}

// ── 工具 3：红线专项复核 ─────────────────────────────────────────────────────
async function checkRedlines(ctx) {
  const decisions = ctx.results.analyze_dimensions?.decisions || [];
  const decisionText = decisions.map((d) => {
    const q = ctx.dimensions.find((x) => x.id === d.dimension_id);
    const opt = q?.options?.[d.option_index];
    return q && opt ? `- 「${q.title}」选择了「${opt.label}」` : null;
  }).filter(Boolean).join('\n');

  const prompt = `你是神州鲲泰 FDE 风险合规复核员。请对以下需求做红线专项复核。

## FDE 红线场景
- 要求 7x24 生产运维 SLA 或长期托管
- 要求无人审核的高风险自动决策（金融放款、医疗诊断、法律裁定、人事筛选、风控处罚、交易执行、生产安全控制等）
- 要求生产级总包、完整 AI 平台/中台建设
- 要求从零训练大模型、基座模型研发、千卡级训练
- 要求越权操作客户生产环境
- 要求端到端负责客户 AI 转型成败、纯战略咨询只出报告

## 用户需求
${requirementText(ctx)}

## 初步维度判定
${decisionText || '（无）'}

## 复核要求
1. 逐条对照红线场景，判断需求是否触碰
2. 如果触碰，指出对应的判定维度 id 与证据；可用维度id：${ctx.dimensions.map((q) => q.id).join('、')}
3. 初步判定已标红线的维度无需重复，但请确认是否有遗漏

## 输出要求
只输出 JSON：{ "redflags": [ { "dimension_id": "维度id", "evidence": "触碰红线的证据（一句话）" } ], "note": "复核结论（一句话）" }
未触碰任何红线时 redflags 为空数组。`;

  const parsed = await chatJson({
    messages: [
      { role: 'system', content: '你是严格输出 JSON 的风险合规复核员，不输出任何非 JSON 内容。' },
      { role: 'user', content: buildUserContent(prompt, ctx.imageDataUrl) }
    ],
    temperature: 0.2,
    maxTokens: 500,
    fallback: null
  });

  const validIds = new Set(ctx.dimensions.map((q) => q.id));
  const redflags = (Array.isArray(parsed?.redflags) ? parsed.redflags : [])
    .filter((r) => validIds.has(r?.dimension_id))
    .map((r) => ({ dimension_id: r.dimension_id, evidence: String(r.evidence || '').slice(0, 200) }));

  return { redflags, note: String(parsed?.note || '') };
}

// ── 工具 4：确定性结论计算（不交给 LLM） ─────────────────────────────────────
function calculateVerdict(ctx) {
  const decisions = ctx.results.analyze_dimensions?.decisions || [];
  const extraRedflags = ctx.results.check_redlines?.redflags || [];

  let total = 0;
  const redflagSet = new Map();
  const details = [];

  for (const d of decisions) {
    const q = ctx.dimensions.find((x) => x.id === d.dimension_id);
    const opt = q?.options?.[d.option_index];
    if (!q || !opt) continue;
    total += Number(opt.score) || 0;
    if (opt.redflag) redflagSet.set(q.id, q.title);
    details.push({
      dimension_id: q.id,
      dimension_title: q.title,
      option_index: d.option_index,
      option_label: opt.label,
      score: Number(opt.score) || 0,
      redflag: Boolean(opt.redflag),
      reason: d.reason || ''
    });
  }
  for (const r of extraRedflags) {
    const q = ctx.dimensions.find((x) => x.id === r.dimension_id);
    if (q) redflagSet.set(q.id, q.title);
  }

  const hasRedFlag = redflagSet.size > 0;
  const verdict = hasRedFlag || total <= -3 ? 'no' : total >= 6 ? 'can' : 'maybe';

  return {
    verdict,
    total,
    hasRedFlag,
    redflagDimensions: [...redflagSet.values()],
    details
  };
}

// ── 工具 5：服务包推荐（沿用既有映射逻辑） ───────────────────────────────────
function recommendPackages(ctx) {
  const decisions = ctx.results.analyze_dimensions?.decisions || [];
  const find = (id) => decisions.find((d) => d.dimension_id === id);

  const techAnswer = find('tech_scope');
  const solutionAnswer = find('solution_type');
  const valueAnswer = find('value');
  const ids = new Set();

  if (techAnswer?.option_index === 0) {
    ids.add('diagnosis');
    if (solutionAnswer?.option_index === 0) {
      ids.add('rag'); ids.add('agent'); ids.add('evaluation');
    }
  }
  if (techAnswer?.option_index === 1) {
    ids.add('deployment'); ids.add('environment');
  }
  if (valueAnswer?.option_index === 0) ids.add('diagnosis');
  if (ids.size === 0) ids.add('diagnosis');

  const list = [...ids].slice(0, 3).map((id) => PACKAGES[id]).filter(Boolean);
  return { packages: list };
}

// ── 反思：校验摘要与判定结论一致性，输出最终摘要 ─────────────────────────────
function verdictLabel(verdict) {
  return { can: '可以做', maybe: '需要外部支持', no: '不能独立承接' }[verdict] || '未知';
}

function templateSummary(ctx) {
  const v = ctx.results.calculate_verdict;
  if (!v) return '';
  if (v.verdict === 'can') {
    return 'AI 初筛通过：需求场景清晰、边界可控，属于 FDE 能力范围。请继续手动确认以下 ' + ctx.dimensions.length + ' 个维度。';
  }
  if (v.verdict === 'maybe') {
    return 'AI 初筛结论：需求可以参与，但存在不确定性或需外部支持。请结合客户实际情况手动确认以下 ' + ctx.dimensions.length + ' 个维度，最终能否生成交付页由手动确认结果决定。';
  }
  const names = v.redflagDimensions.length ? v.redflagDimensions.join('、') : '红线场景';
  return 'AI 初筛结论：需求触碰到 ' + names + '，不适合由 FDE 小队独立承接。建议转交或重新收敛需求。';
}

async function reflect(ctx) {
  const v = ctx.results.calculate_verdict;
  const draft = ctx.results.analyze_dimensions?.draftSummary || '';
  const fallbackSummary = templateSummary(ctx);
  if (!v) return { summary: fallbackSummary, consistent: false };

  const prompt = `你是神州鲲泰 FDE 判定结果的质检员。请检查分析摘要与判定结论是否一致，并输出最终摘要。

## 判定结论（确定性计算结果，不可更改）
- 结论：${verdictLabel(v.verdict)}（总分 ${v.total}${v.hasRedFlag ? '，触碰红线：' + v.redflagDimensions.join('、') : '，未触碰红线'}）

## 初步摘要
${draft || '（无）'}

## 一致性规则
- 结论为「可以做」→ 摘要必须表达：初筛通过，属于 FDE 能力范围，提示用户继续手动确认 ${ctx.dimensions.length} 个维度
- 结论为「需要外部支持」→ 摘要必须表达：可以参与但存在不确定性或需外部支持，提示用户手动确认 ${ctx.dimensions.length} 个维度，最终结果以人工确认为准
- 结论为「不能独立承接」→ 摘要必须点明触碰的红线维度，并建议转交或重新收敛需求

## 输出要求
只输出 JSON：{ "consistent": true 或 false, "summary": "最终摘要（两三句话，与结论严格一致）" }`;

  const parsed = await chatJson({
    messages: [
      { role: 'system', content: '你是严格输出 JSON 的质检员，不输出任何非 JSON 内容。' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.2,
    maxTokens: 400,
    fallback: null
  });

  const summary = String(parsed?.summary || '').trim();
  return {
    summary: summary || fallbackSummary,
    consistent: Boolean(parsed?.consistent),
    corrected: Boolean(summary && parsed?.consistent === false)
  };
}

const tools = {
  validate_requirement: validateRequirement,
  analyze_dimensions: analyzeDimensions,
  check_redlines: checkRedlines,
  calculate_verdict: calculateVerdict,
  recommend_packages: recommendPackages
};

module.exports = { tools, reflect, templateSummary, verdictLabel, PACKAGES };
