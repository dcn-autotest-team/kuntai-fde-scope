// 神州鲲泰 FDE 能力边界判定系统 - Agent 服务端
// 静态托管 + Agent API（SSE 流式）+ 记忆进化 API + 配置管理
const express = require('express');
const path = require('path');
const crypto = require('crypto');

const { runAgent } = require('./agent/core');
const memory = require('./agent/memory');
const { chatCompletion, chatJson, extractJson } = require('./agent/llm');
const { loadAIConfig, saveAIConfig, publicConfig } = require('./agent/config');

const PORT = process.env.PORT || 8080;
const ROOT = path.join(__dirname, '..');

// 管理员密码哈希（SHA-256），与既有前端保持一致
const ADMIN_PWD_HASH = 'c638bc74f30482cae5ec685f12c435196bca31a591b6943157e6f38c973ad467';
const adminTokens = new Map(); // token -> 过期时间
const TOKEN_TTL = 2 * 60 * 60 * 1000;

const app = express();
app.use(express.json({ limit: '25mb' }));

function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password), 'utf8').digest('hex');
}

function issueToken() {
  const token = crypto.randomUUID();
  adminTokens.set(token, Date.now() + TOKEN_TTL);
  return token;
}

function validToken(req) {
  const token = req.get('x-admin-token');
  if (!token) return false;
  const expire = adminTokens.get(token);
  if (!expire) return false;
  if (Date.now() > expire) {
    adminTokens.delete(token);
    return false;
  }
  return true;
}

// ── 健康检查 ─────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ ok: true, agent: true, time: Date.now() });
});

// ── 公开配置（不含密钥） ─────────────────────────────────────────────────────
app.get('/api/config', (req, res) => {
  res.json(publicConfig());
});

// ── 管理员登录：返回令牌与完整配置 ───────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
  const password = req.body?.password;
  if (!password || hashPassword(password) !== ADMIN_PWD_HASH) {
    return res.status(401).json({ ok: false, message: '密码错误，请重试' });
  }
  const cfg = loadAIConfig();
  res.json({ ok: true, token: issueToken(), config: { endpoint: cfg.endpoint, apiKey: cfg.apiKey, model: cfg.model } });
});

// ── 更新 AI 服务配置（需管理员令牌） ─────────────────────────────────────────
app.post('/api/config', (req, res) => {
  if (!validToken(req)) return res.status(401).json({ ok: false, message: '未授权，请重新登录管理员' });
  const saved = saveAIConfig(req.body || {});
  res.json({ ok: true, config: { endpoint: saved.endpoint, model: saved.model, hasKey: Boolean(saved.apiKey) } });
});

// ── Agent 判定分析（SSE 流式） ───────────────────────────────────────────────
app.post('/api/agent/analyze', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write(': connected\n\n');

  let closed = false;
  // 注意：必须监听 res 的 close；req 的 close 在请求体读取完成即触发，不能用于判断连接状态
  res.on('close', () => { closed = true; });
  const emit = (event, data) => {
    if (closed) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const { text, imageDataUrl, docText, dimensions } = req.body || {};
    await runAgent({ text, imageDataUrl, docText, dimensions }, emit);
  } catch (err) {
    emit('error', { message: err.message || '分析失败，请重试' });
  } finally {
    if (!closed) res.end();
  }
});

// ── 人工确认反馈：沉淀经验、更新进化指标 ─────────────────────────────────────
app.post('/api/agent/feedback', async (req, res) => {
  try {
    const { caseId, confirmations } = req.body || {};
    if (!caseId || !Array.isArray(confirmations)) {
      return res.status(400).json({ ok: false, message: '参数不完整' });
    }
    const result = memory.applyFeedback(caseId, confirmations);
    if (!result) return res.status(404).json({ ok: false, message: '案例不存在' });

    const { case: caseItem, corrections } = result;
    let newLessons = [];

    // 有纠正时，由 LLM 反思沉淀可复用经验
    if (corrections.length) {
      try {
        newLessons = await generateLessons(caseItem, corrections);
      } catch {
        // 经验生成失败不影响反馈保存
      }
    }

    res.json({
      ok: true,
      corrections: corrections.length,
      lessons: newLessons,
      stats: memory.getStats()
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// 根据人工纠正生成经验条目
async function generateLessons(caseItem, corrections) {
  const detailText = corrections.map((c) => {
    const aiDecision = (caseItem.aiDecisions || []).find((d) => d.dimension_id === c.dimension_id);
    return `- 维度「${c.dimension_id}」：AI 选择第 ${c.ai_option_index} 项（${aiDecision?.reason || '无理由'}），人工纠正为第 ${c.user_option_index} 项`;
  }).join('\n');

  const prompt = `你是神州鲲泰 FDE 需求判定 Agent 的反思模块。人工专家纠正了 AI 的判定，请沉淀出可复用的判定经验。

## 当时的需求
${caseItem.requirementText.slice(0, 500)}

## 纠正明细
${detailText}

## 输出要求
只输出 JSON：{ "lessons": [ { "dimension_id": "维度id", "lesson": "一条具体、可复用的判定经验（说明什么类型的需求在该维度应如何选择）" } ] }
每条经验一句话，聚焦「什么样的需求特征 → 应选什么」，不要复述本次案例细节。`;

  const parsed = await chatJson({
    messages: [
      { role: 'system', content: '你是严格输出 JSON 的反思模块，不输出任何非 JSON 内容。' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3,
    maxTokens: 600,
    fallback: null
  });

  const saved = [];
  const list = Array.isArray(parsed?.lessons) ? parsed.lessons : [];
  for (const item of list) {
    const lesson = memory.addLesson({
      lesson: item.lesson,
      context: caseItem.requirementText.slice(0, 200),
      dimensionId: item.dimension_id || null
    });
    if (lesson) saved.push(lesson.lesson);
  }
  return saved;
}

// ── 进化看板数据 ─────────────────────────────────────────────────────────────
app.get('/api/agent/stats', (req, res) => {
  res.json(memory.getStats());
});

// ── 管理员经验库策展（需管理员令牌） ─────────────────────────────────────────
// 经验会被 few-shot 注入后续判定 prompt，错误经验会污染分析，需人工策展手段
app.get('/api/admin/lessons', (req, res) => {
  if (!validToken(req)) return res.status(401).json({ ok: false, message: '未授权，请重新登录管理员' });
  const cases = memory.getCases();
  const lessons = memory.getLessons().map((lesson) => {
    // 通过 context（来源需求文本前 200 字）匹配来源案例，取最近一个
    const sourceCase = lesson.context
      ? [...cases].reverse().find((c) =>
          (c.requirementText || '').slice(0, 200) === lesson.context
          || (c.requirementText || '').startsWith(lesson.context.slice(0, 60)))
      : null;
    return {
      ...lesson,
      sourceCase: sourceCase ? {
        id: sourceCase.id,
        requirementText: sourceCase.requirementText,
        aiVerdict: sourceCase.aiVerdict,
        corrections: sourceCase.corrections,
        createdAt: sourceCase.createdAt,
        feedbackAt: sourceCase.feedbackAt
      } : null
    };
  });
  lessons.reverse(); // 最新沉淀的排在前面
  res.json({ ok: true, lessons });
});

app.put('/api/admin/lessons/:id', (req, res) => {
  if (!validToken(req)) return res.status(401).json({ ok: false, message: '未授权，请重新登录管理员' });
  const { lesson, context, dimensionId } = req.body || {};
  if (!String(lesson || '').trim()) {
    return res.status(400).json({ ok: false, message: '经验内容不能为空' });
  }
  const updated = memory.updateLesson(req.params.id, { lesson, context, dimensionId });
  if (!updated) return res.status(404).json({ ok: false, message: '经验条目不存在' });
  res.json({ ok: true, lesson: updated });
});

app.delete('/api/admin/lessons/:id', (req, res) => {
  if (!validToken(req)) return res.status(401).json({ ok: false, message: '未授权，请重新登录管理员' });
  const removed = memory.deleteLesson(req.params.id);
  if (!removed) return res.status(404).json({ ok: false, message: '经验条目不存在' });
  res.json({ ok: true });
});

// ── 交付项目页生成（代理 LLM，密钥不出服务端） ───────────────────────────────
app.post('/api/generate-page', async (req, res) => {
  try {
    const { userText, verdict, answers, packages, dimensions } = req.body || {};
    if (!Array.isArray(dimensions) || !dimensions.length) {
      return res.status(400).json({ ok: false, message: '判定维度配置缺失' });
    }

    const answerMap = new Map((Array.isArray(answers) ? answers : []).map((a) => [a.dimension_id, a]));
    const dimensionDetails = dimensions.map((q, i) => {
      const answer = answerMap.get(q.id);
      const selected = answer ? q.options[Number(answer.option_index)] : null;
      return `${i + 1}. ${q.title}\n   客户选择：${selected ? selected.label : '未选择'}${selected ? '（分值 ' + selected.score + (selected.redflag ? '，红线' : '') + '）' : ''}`;
    }).join('\n');

    const packageList = (Array.isArray(packages) ? packages : [])
      .map((pkg) => `- ${pkg.title}（周期：${pkg.duration}）`).join('\n') || '无';

    const prompt = `你是一位面向企业客户的神州鲲泰 FDE 解决方案架构师。

请基于以下需求判定结果，生成一个完整的、独立的、可直接部署的 HTML 项目展示页。

## 客户需求描述
${userText || '（未提供文字描述）'}

## 判定结论
- 综合结果：${verdict === 'can' ? '可以做（属于 FDE 能力范围）' : '需要外部支持（可参与但不宜独立兜底）'}
- 判定维度详情：
${dimensionDetails}

## 推荐服务包
${packageList}

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
请只输出完整 HTML 代码，不要任何解释文字。代码用 \`\`\`html 包裹。`;

    const content = await chatCompletion({
      messages: [
        { role: 'system', content: '你是一个严格按要求输出 HTML 代码的解决方案架构师，只输出完整 HTML 代码，不输出任何解释。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5,
      maxTokens: 4000
    });

    const match = content.match(/```html\s*([\s\S]*?)```/);
    const html = (match ? match[1] : content).trim();
    if (!html) throw new Error('未能从响应中提取 HTML 代码');

    res.json({ ok: true, html });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message || '生成失败' });
  }
});

// ── 静态资源 ─────────────────────────────────────────────────────────────────
app.use(express.static(ROOT));

app.listen(PORT, () => {
  console.log(`[kuntai-fde] Agent 服务已启动: http://localhost:${PORT}`);
});
