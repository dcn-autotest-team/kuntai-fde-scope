// Agent 主循环：检索记忆 → 自主规划 → 工具执行 → 反思 → 沉淀案例
// 通过 emit(event, data) 向调用方（SSE）推送全过程事件
const { createPlan } = require('./planner');
const { tools, reflect, verdictLabel } = require('./tools');
const { retrieveSimilar, retrieveLessons } = require('./retrieve');
const memory = require('./memory');

const TOOL_LABELS = {
  retrieve_similar_cases: '检索历史案例与经验',
  validate_requirement: '需求有效性校验',
  analyze_dimensions: '维度智能分析',
  check_redlines: '红线专项复核',
  calculate_verdict: '计算判定结论',
  recommend_packages: '推荐服务包',
  reflect: '一致性反思'
};

function toolLabel(name) {
  return TOOL_LABELS[name] || name;
}

// 各工具结果的简要摘要（用于前端工具卡片展示）
function summarizeResult(name, result) {
  switch (name) {
    case 'retrieve_similar_cases':
      return result.cases.length
        ? `命中 ${result.cases.length} 个相似案例、${result.lessonCount} 条历史经验`
        : '暂无历史案例，本次判定将沉淀为新的经验';
    case 'validate_requirement':
      return result.valid ? '输入为有效 AI 项目需求' : `无效输入：${result.reason}`;
    case 'analyze_dimensions':
      return `完成 ${result.decisions.length} 个维度分析`;
    case 'check_redlines':
      return result.redflags.length
        ? `发现 ${result.redflags.length} 处红线风险`
        : '未发现红线风险';
    case 'calculate_verdict':
      return `结论：${verdictLabel(result.verdict)}（总分 ${result.total}）`;
    case 'recommend_packages':
      return `推荐 ${result.packages.map((p) => p.title).join('、')}`;
    case 'reflect':
      return result.corrected ? '发现摘要与结论不一致，已自动修正' : '摘要与判定结论一致';
    default:
      return '';
  }
}

// 工具结果中可下发给前端的安全数据（剔除大段文本）
function safeData(name, result) {
  switch (name) {
    case 'retrieve_similar_cases':
      return {
        cases: result.cases.map((c) => ({ excerpt: c.requirementText.slice(0, 80), verdict: c.aiVerdict, similarity: c.similarity })),
        lessons: result.lessons.map((l) => l.lesson)
      };
    case 'validate_requirement':
      return { valid: result.valid, reason: result.reason };
    case 'analyze_dimensions':
      return { decisions: result.decisions };
    case 'check_redlines':
      return { redflags: result.redflags, note: result.note };
    case 'calculate_verdict':
      return { verdict: result.verdict, total: result.total, hasRedFlag: result.hasRedFlag, redflagDimensions: result.redflagDimensions };
    case 'recommend_packages':
      return { packages: result.packages };
    case 'reflect':
      return { summary: result.summary, consistent: result.consistent, corrected: result.corrected };
    default:
      return {};
  }
}

async function runAgent({ text, imageDataUrl, docText, dimensions }, emit) {
  const ctx = {
    text: String(text || '').trim(),
    imageDataUrl: imageDataUrl || null,
    docText: docText ? String(docText).slice(0, 8000) : null,
    dimensions: Array.isArray(dimensions) ? dimensions : [],
    similarCases: [],
    lessons: [],
    results: {}
  };

  if (!ctx.dimensions.length) throw new Error('判定维度配置为空');
  if (!ctx.text && !ctx.imageDataUrl && !ctx.docText) throw new Error('请输入需求描述、上传图片或上传文档');

  // ── 步骤 0：检索记忆（规划前先取历史案例与经验） ──────────────────────────
  emit('tool_start', { tool: 'retrieve_similar_cases', label: toolLabel('retrieve_similar_cases'), purpose: '从记忆库检索相似历史案例与沉淀经验' });
  const queryText = [ctx.text, (ctx.docText || '').slice(0, 500)].filter(Boolean).join(' ');
  ctx.similarCases = retrieveSimilar(queryText, memory.getCases(), 3);
  ctx.lessons = retrieveLessons(queryText, memory.getLessons(), 6);
  const retrievalResult = { cases: ctx.similarCases, lessons: ctx.lessons, lessonCount: ctx.lessons.length };
  ctx.results.retrieve_similar_cases = retrievalResult;
  emit('tool_result', {
    tool: 'retrieve_similar_cases',
    label: toolLabel('retrieve_similar_cases'),
    summary: summarizeResult('retrieve_similar_cases', retrievalResult),
    data: safeData('retrieve_similar_cases', retrievalResult)
  });

  // ── 步骤 1：自主规划 ──────────────────────────────────────────────────────
  emit('plan_start', {});
  let plan;
  try {
    plan = await createPlan(ctx);
  } catch {
    plan = require('./planner').defaultPlan();
  }
  emit('plan', {
    reasoning: plan.reasoning,
    steps: plan.steps.map((s) => ({ tool: s.tool, label: toolLabel(s.tool), purpose: s.purpose })),
    fallback: Boolean(plan.fallback)
  });

  // ── 步骤 2：按计划执行工具 ────────────────────────────────────────────────
  for (const step of plan.steps) {
    const tool = tools[step.tool];
    if (!tool) continue;

    emit('tool_start', { tool: step.tool, label: toolLabel(step.tool), purpose: step.purpose });
    let result;
    try {
      result = await tool(ctx);
    } catch (err) {
      emit('tool_error', { tool: step.tool, label: toolLabel(step.tool), message: err.message });
      throw err;
    }
    ctx.results[step.tool] = result;
    emit('tool_result', {
      tool: step.tool,
      label: toolLabel(step.tool),
      summary: summarizeResult(step.tool, result),
      data: safeData(step.tool, result)
    });

    // 有效性关卡：无效需求直接短路，不再执行后续工具
    if (step.tool === 'validate_requirement' && result.valid === false) {
      emit('reflection', { summary: result.reason, consistent: true, shortCircuited: true });
      emit('done', {
        caseId: null,
        valid: false,
        validityReason: result.reason || '需求描述不清晰或不完整，无法判断是否需要 FDE 参与。'
      });
      return;
    }

    // 兜底：有效性通过后，若计划遗漏维度分析则强制执行
    if (step.tool === 'validate_requirement' && result.valid === true && !plan.steps.some((s) => s.tool === 'analyze_dimensions')) {
      emit('tool_start', { tool: 'analyze_dimensions', label: toolLabel('analyze_dimensions'), purpose: '分析全部判定维度（自动补充）' });
      const dimResult = await tools.analyze_dimensions(ctx);
      ctx.results.analyze_dimensions = dimResult;
      emit('tool_result', {
        tool: 'analyze_dimensions',
        label: toolLabel('analyze_dimensions'),
        summary: summarizeResult('analyze_dimensions', dimResult),
        data: safeData('analyze_dimensions', dimResult)
      });
    }
  }

  // 兜底：计划遗漏结论计算时补算
  if (!ctx.results.calculate_verdict && ctx.results.analyze_dimensions) {
    emit('tool_start', { tool: 'calculate_verdict', label: toolLabel('calculate_verdict'), purpose: '计算判定结论（自动补充）' });
    ctx.results.calculate_verdict = tools.calculate_verdict(ctx);
    emit('tool_result', {
      tool: 'calculate_verdict',
      label: toolLabel('calculate_verdict'),
      summary: summarizeResult('calculate_verdict', ctx.results.calculate_verdict),
      data: safeData('calculate_verdict', ctx.results.calculate_verdict)
    });
  }

  const verdictResult = ctx.results.calculate_verdict;
  if (!verdictResult) throw new Error('未能完成维度分析，请重试');

  // ── 步骤 3：反思（摘要与结论一致性校验） ─────────────────────────────────
  emit('tool_start', { tool: 'reflect', label: toolLabel('reflect'), purpose: '校验分析摘要与判定结论一致性' });
  let reflection;
  try {
    reflection = await reflect(ctx);
  } catch {
    reflection = { summary: require('./tools').templateSummary(ctx), consistent: true, corrected: false };
  }
  emit('tool_result', {
    tool: 'reflect',
    label: toolLabel('reflect'),
    summary: summarizeResult('reflect', reflection),
    data: safeData('reflect', reflection)
  });
  emit('reflection', reflection);

  // ── 步骤 4：沉淀案例到记忆库（等待人工确认反馈） ──────────────────────────
  const decisions = ctx.results.analyze_dimensions?.decisions || [];
  const packages = ctx.results.recommend_packages?.packages || [];
  const caseItem = memory.addCase({
    requirementText: ctx.text || (ctx.docText ? '[文档] ' + ctx.docText.slice(0, 200) : '[图片需求]'),
    hasImage: Boolean(ctx.imageDataUrl),
    hasDoc: Boolean(ctx.docText),
    decisions,
    verdict: verdictResult.verdict,
    summary: reflection.summary,
    packages
  });

  emit('done', {
    caseId: caseItem.id,
    valid: true,
    decisions: verdictResult.details,
    verdict: verdictResult.verdict,
    total: verdictResult.total,
    hasRedFlag: verdictResult.hasRedFlag,
    redflagDimensions: verdictResult.redflagDimensions,
    summary: reflection.summary,
    packages
  });
}

module.exports = { runAgent, toolLabel };
