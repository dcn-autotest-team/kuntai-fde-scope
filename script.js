const clone = typeof structuredClone === 'function'
  ? structuredClone
  : (obj) => JSON.parse(JSON.stringify(obj));

const STORAGE_KEY = 'kuntai-fde-boundary-config-v3';

const defaultConfig = [
  {
    id: 'value',
    title: '需求是否属于 AI 应用落地场景？',
    options: [
      { label: '明确属于 AI 应用落地', score: 2, redflag: false },
      { label: '需要进一步诊断', score: 0, redflag: false },
      { label: '偏纯咨询或纯外包', score: -4, redflag: true }
    ]
  },
  {
    id: 'solution_type',
    title: '交付形态是否适合 PoC / MVP / 试点？',
    options: [
      { label: '适合 PoC/MVP/试点', score: 2, redflag: false },
      { label: '范围需要收敛', score: 0, redflag: false },
      { label: '要求生产级总包', score: -5, redflag: true }
    ]
  },
  {
    id: 'tech_scope',
    title: '技术内容是否落在 RAG / Agent / 测试评估 / 部署验证范围内？',
    options: [
      { label: '高度匹配', score: 2, redflag: false },
      { label: '部分匹配，需外部支持', score: 0, redflag: false },
      { label: '偏底层模型研发或核心系统改造', score: -5, redflag: true }
    ]
  },
  {
    id: 'environment',
    title: '客户环境和数据条件是否可协同、可验证？',
    options: [
      { label: '已授权且可协同', score: 2, redflag: false },
      { label: '审批或环境待确认', score: 0, redflag: false },
      { label: '要求越权操作生产环境', score: -5, redflag: true }
    ]
  },
  {
    id: 'risk',
    title: '是否涉及无人审核的高风险自动决策？',
    options: [
      { label: '有人审核，可追踪', score: 2, redflag: false },
      { label: '风险需进一步评估', score: 0, redflag: false },
      { label: '要求无人审核自动决策', score: -5, redflag: true }
    ]
  },
  {
    id: 'operation',
    title: '上线后责任是否清晰，不要求 FDE 长期托管？',
    options: [
      { label: '可移交客户或运维团队', score: 2, redflag: false },
      { label: '需要短期陪跑', score: 0, redflag: false },
      { label: '要求 7x24 SLA 或长期托管', score: -5, redflag: true }
    ]
  }
];

const cases = {
  diagnosis: {
    status: 'can',
    label: '可以做',
    title: '客户想用 AI，但不知道先做什么',
    body: '适合由 FDE 做场景诊断工作坊：访谈业务流程，形成 AI 场景清单、优先级矩阵、ROI 假设和 MVP 路线图。',
    boundary: 'FDE 可以做诊断和 MVP 规划，不替代客户高层做组织级战略决策。'
  },
  rag: {
    status: 'can',
    label: '可以做',
    title: '客户希望做企业知识库或智能问答 PoC',
    body: '适合由 FDE 负责文档解析、知识库搭建、检索链路、Prompt 方案、评测集和 Badcase 分析。',
    boundary: '复杂多租户、跨系统实时同步和强合规数据项目，需要资深后端、架构、安全或客户合规团队支持。'
  },
  agent: {
    status: 'can',
    label: '可以做',
    title: '客户希望做文档、报告、工单或客服类 Agent MVP',
    body: 'FDE 可以拆解多步骤任务，设计工具调用流程，做 MCP/API 接入原型、人工审核闭环、日志和结果追踪方案。',
    boundary: '建议先做半自动、人机协同 Agent，不一开始承诺全自动闭环。'
  },
  evaluation: {
    status: 'can',
    label: '可以做',
    title: '客户需要量化 AI 应用 PoC 效果或上线前验收',
    body: 'FDE 可以设计测试用例、接口测试、性能压测、模型输出 Badcase 分析、竞品评测、灰度监控和验收标准。',
    boundary: 'FDE 可以做评测体系和报告，不单独承诺模型算法本身必然提升。'
  },
  deployment: {
    status: 'can',
    label: '可以做',
    title: '客户已有服务器或国产算力环境，希望验证能否跑模型',
    body: 'FDE 可以做 Linux / Docker 基础部署、GPU/服务器测试、推理服务验证、性能对比和部署 checklist。',
    boundary: 'FDE 不独立负责底层驱动、内核、硬件故障修复或大规模集群调度平台建设。'
  },
  environment: {
    status: 'maybe',
    label: '谨慎做',
    title: '客户希望 AI 系统接入内部环境或多地访问',
    body: 'FDE 可以做部署环境调研、连通性排查、访问路径梳理，并与客户 IT 团队协同排障。',
    boundary: '不越权操作客户生产环境，不独立承接大型核心网改造总包。'
  },
  platform: {
    status: 'maybe',
    label: '需要外部支持',
    title: '客户要求完整生产级 AI 平台',
    body: 'FDE 可以参与模块开发、部署测试、评估和试点，但完整平台需要资深架构、SRE、平台产品和数据治理支持。',
    boundary: '多租户、高并发、灾备、计费、审计、复杂权限和 7x24 SLA 不应由 FDE 小队独立兜底。'
  },
  core_integration: {
    status: 'no',
    label: '不能独立承接',
    title: '客户要求核心业务系统深度改造',
    body: 'FDE 可以做 API 对接原型、数据读取、流程自动化 Demo 和测试验证，但不适合独立承担核心系统改造。',
    boundary: '核心系统改造应由客户 IT、原系统供应商、数据库管理员、企业架构师和业务系统负责人共同承担。'
  },
  high_risk: {
    status: 'no',
    label: '不能独立承诺',
    title: '客户要求无人审核的自动决策系统',
    body: '金融放款、医疗诊断、法律裁定、人事筛选、风控处罚、交易执行和生产安全控制等场景不适合 FDE 独立承接。',
    boundary: '如需探索，只能做辅助决策、人工审核和可追踪评估，不应做无人审核闭环。'
  },
  sla: {
    status: 'no',
    label: '不能独立承诺',
    title: '客户要求生产环境 7x24 运维 SLA',
    body: 'FDE 可以协助试点上线、部署检查和问题定位，但不能替代 SRE、值班机制、监控系统和 SLA 合同体系。',
    boundary: '如需生产 SLA，必须另配运维团队、监控、故障演练和客户生产授权。'
  },
  model_training: {
    status: 'no',
    label: '不能独立承诺',
    title: '客户要求从零训练大模型或基座模型研发',
    body: 'FDE 更适合模型应用、评估、复现、数据处理和小规模实验，不主打前沿模型算法突破或千卡级训练。',
    boundary: '从零训练大模型、高性能推理框架内核开发和基座模型研发应转交专门研发团队。'
  }
};

let config = loadConfig();
const answers = new Map();

// ── 服务包数据 ──────────────────────────────────────────────────────────────
const packages = {
  diagnosis: { title: 'AI 场景诊断工作坊', duration: '3-5 天', status: 'can' },
  rag:       { title: 'RAG / 知识库 PoC',     duration: '1-3 周', status: 'can' },
  agent:     { title: 'Agent / 流程自动化 MVP',  duration: '2-4 周', status: 'caution' },
  evaluation:{ title: 'AI 应用测试评估',   duration: '1-2 周', status: 'can' },
  deployment:{ title: '私有化推理部署验证', duration: '1-3 周', status: 'caution' },
  environment:{ title: '客户环境接入与部署协同', duration: '视环境而定', status: 'caution' }
};

// 判定结果 -> 服务包映射逻辑
function getRecommendedPackages() {
  const techAnswer = answers.get('tech_scope');
  const solutionAnswer = answers.get('solution_type');
  const ids = new Set();

  // tech_scope: 0=高度匹配, 1=部分匹配, 2=偏底层(不推荐)
  if (techAnswer?.optionIndex === 0) {
    ids.add('diagnosis');
    // solution_type: 0=适合PoC, 1=范围需收敛, 2=生产级总包
    if (solutionAnswer?.optionIndex === 0) {
      ids.add('rag'); ids.add('agent'); ids.add('evaluation');
    }
  }
  if (techAnswer?.optionIndex === 1) {
    ids.add('deployment'); ids.add('environment');
  }

  // value(AI应用落地) 选项补充
  const valueAnswer = answers.get('value');
  if (valueAnswer?.optionIndex === 0) ids.add('diagnosis');

  // 默认至少给一个
  if (ids.size === 0) ids.add('diagnosis');

  return [...ids].slice(0, 3).map(id => packages[id]).filter(Boolean);
}

const questionsPanel = document.querySelector('[data-questions-panel]');
const resultCard = document.querySelector('[data-result-card]');
const decisionStage = document.querySelector('[data-decision-stage]');
const resultLabel = document.querySelector('[data-result-label]');
const resultTitle = document.querySelector('[data-result-title]');
const resultText = document.querySelector('[data-result-text]');
const resultList = document.querySelector('[data-result-list]');
const scorebar = document.querySelector('[data-scorebar]');
const resetButton = document.querySelector('[data-reset]');
const projectGenerateEl = document.querySelector('[data-project-generate]');
const projectGenerateBtn = document.querySelector('[data-project-generate-btn]');
const projectResultEl = document.querySelector('[data-project-result]');
const projectPreviewFrame = document.querySelector('[data-project-preview-frame]');
const projectDownloadBtn = document.querySelector('[data-project-download]');
const projectCopyBtn = document.querySelector('[data-project-copy]');
const projectRegenerateBtn = document.querySelector('[data-project-regenerate]');
const projectCloseBtn = document.querySelector('[data-project-close]');
const projectStatusEl = document.querySelector('[data-project-status]');
const adminModal = document.querySelector('[data-admin-modal]');
const adminOpen = document.querySelector('[data-admin-open]');
const adminPanel = document.querySelector('[data-admin-panel]');
const adminSave = document.querySelector('[data-admin-save]');
const adminReset = document.querySelector('[data-admin-reset]');
const adminLogin = document.querySelector('[data-admin-login]');
const adminPrivate = document.querySelector('[data-admin-private]');
const adminLoginForm = document.querySelector('[data-admin-login-form]');
const adminPassword = document.querySelector('[data-admin-password]');
const adminError = document.querySelector('[data-admin-error]');
const adminLogout = document.querySelector('[data-admin-logout]');
const statQuestions = document.querySelector('[data-stat-questions]');
const casePanel = document.querySelector('[data-case-panel]');

function loadConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : structuredClone(defaultConfig);
  } catch {
    return structuredClone(defaultConfig);
  }
}

function saveConfig() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function renderQuestions() {
  questionsPanel.innerHTML = config.map((question, qIndex) => `
    <div class="question-block">
      <div class="q-head"><span>${qIndex + 1}</span><h3>${escapeHtml(question.title)}</h3></div>
      <div class="choice-row" data-question="${question.id}">
        ${question.options.map((option, oIndex) => `
          <button type="button" data-option-index="${oIndex}" data-score="${option.score}" ${option.redflag ? 'data-redflag="true"' : ''}>${escapeHtml(option.label)}</button>
        `).join('')}
      </div>
    </div>
  `).join('');
  if (statQuestions) statQuestions.textContent = String(config.length);
  bindQuestionEvents();
  restoreSelectedButtons();
  renderResult();
}

function bindQuestionEvents() {
  document.querySelectorAll('.choice-row').forEach((group) => {
    group.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      selectAnswer(group.dataset.question, Number(button.dataset.optionIndex));
    });
  });
}

function selectAnswer(questionId, optionIndex) {
  const question = config.find((item) => item.id === questionId);
  const option = question?.options[optionIndex];
  if (!question || !option) return;
  answers.set(questionId, { score: Number(option.score), redflag: Boolean(option.redflag), optionIndex });
  restoreSelectedButtons();
  renderResult();
}

function restoreSelectedButtons() {
  document.querySelectorAll('.choice-row').forEach((group) => {
    const selected = answers.get(group.dataset.question);
    group.querySelectorAll('button').forEach((button) => {
      button.classList.toggle('selected', selected?.optionIndex === Number(button.dataset.optionIndex));
    });
  });
}

function renderResult() {
  const values = [...answers.values()];
  const complete = answers.size === config.length;
  const total = values.reduce((sum, item) => sum + item.score, 0);
  const hasRedFlag = values.some((item) => item.redflag);
  resultCard.classList.remove('can', 'maybe', 'no');

  if (!complete) {
    resultLabel.textContent = `已确认 ${answers.size}/${config.length}`;
    resultTitle.textContent = '继续确认';
    resultText.textContent = '请继续确认剩余问题。全部确认完成且判定为"可以做"后，可生成交付项目页。';
    resultList.innerHTML = '<li>请根据客户实际情况逐项确认。</li><li>如出现生产级总包、无人审核决策、7x24 SLA 或底层模型研发红线，应暂停推进。</li>';
    scorebar.style.width = `${Math.max(8, answers.size / Math.max(config.length, 1) * 45)}%`;
    scorebar.style.background = 'var(--brand)';
    toggleProjectGenerate(false);
    return;
  }

  const maxPositive = config.length * 2;
  const normalized = Math.max(0, Math.min(100, (total + maxPositive) / (maxPositive * 2) * 100));
  scorebar.style.width = `${normalized}%`;

  if (hasRedFlag || total <= -3) {
    resultCard.classList.add('no');
    resultLabel.textContent = '不能独立承接';
    resultTitle.textContent = '该需求已超出 FDE 独立能力边界';
    resultText.textContent = '不建议由 FDE 小队独立承接。应转交或引入架构、SRE、客户 IT、合规、行业专家或底层研发团队。';
    resultList.innerHTML = '<li>不要独立承诺生产级平台、核心系统改造或 7x24 SLA。</li><li>不要承接无人审核的高风险自动决策。</li><li>不要把 FDE 定位为大模型底层研发、纯咨询或长期运维托管团队。</li>';
    scorebar.style.background = 'var(--red)';
    renderRecommendedPackages('no');
    toggleProjectGenerate(false);
  } else if (total >= 6) {
    resultCard.classList.add('can');
    resultLabel.textContent = '可以做';
    resultTitle.textContent = '该需求属于神州鲲泰 FDE 能力范围';
    resultText.textContent = '可以进入场景诊断、PoC/MVP、测试评估、推理部署验证或客户环境接入协同阶段。';
    resultList.innerHTML = '<li>明确业务场景、技术可行性和 MVP 路线图。</li><li>用 RAG、Agent、测试评估或部署验证形成可验收结果。</li><li>沉淀评测报告、部署 checklist、风险清单和后续迭代建议。</li>';
    scorebar.style.background = 'var(--green)';
    renderRecommendedPackages('can');
    toggleProjectGenerate(true);
  } else {
    resultCard.classList.add('maybe');
    resultLabel.textContent = '需要外部支持';
    resultTitle.textContent = '该需求可以参与，但不宜独立兜底';
    resultText.textContent = '建议先收敛为 PoC/MVP 或试点范围，并明确需要哪些外部角色配合。';
    resultList.innerHTML = '<li>拆分 FDE 能做的原型、评测、部署验证和协同排障部分。</li><li>生产级架构、复杂权限、核心系统改造和 SLA 需由专业团队负责。</li><li>在合同和验收口径中写清责任边界。</li>';
    scorebar.style.background = 'var(--amber)';
    renderRecommendedPackages('maybe');
    toggleProjectGenerate(false);
  }
  maybeSubmitFeedback();
}

function toggleProjectGenerate(show) {
  if (projectGenerateEl) projectGenerateEl.hidden = !show;
  if (!show && projectResultEl) projectResultEl.hidden = true;
}

const recommendedPackagesEl = document.querySelector('[data-recommended-packages]');

function renderRecommendedPackages(verdict) {
  if (!recommendedPackagesEl) return;
  if (verdict === 'no') {
    recommendedPackagesEl.hidden = false;
    recommendedPackagesEl.innerHTML = '<p class="pkg-notice no">该需求已超出服务包范围，建议重新收敛需求或转交其他团队。</p>';
    return;
  }
  const list = verdict === 'can' ? getRecommendedPackages() : [
    packages.deployment, packages.environment
  ].filter(Boolean);
  if (!list.length) { recommendedPackagesEl.hidden = true; return; }
  recommendedPackagesEl.hidden = false;
  recommendedPackagesEl.innerHTML =
    '<p class="pkg-label">推荐服务包</p>' +
    list.map(pkg =>
      `<a class="pkg-chip ${pkg.status}" href="#packages">
        <span>${escapeHtml(pkg.duration)}</span>${escapeHtml(pkg.title)}
      </a>`
    ).join('');
}

// ── 项目交付页生成 ────────────────────────────────────────────────────────────

let lastGeneratedHtml = '';
let lastProjectContext = null;

function renderProjectPreview(html) {
  if (!projectPreviewFrame) return;
  projectPreviewFrame.srcdoc = html;
}

function showProjectStatus(msg, type) {
  if (!projectStatusEl) return;
  projectStatusEl.textContent = msg;
  projectStatusEl.className = 'project-status' + (type ? ' is-' + type : '');
  projectStatusEl.hidden = false;
}

function hideProjectStatus() {
  if (!projectStatusEl) return;
  projectStatusEl.hidden = true;
  projectStatusEl.textContent = '';
}

function openProjectResult() {
  if (projectResultEl) projectResultEl.hidden = false;
  if (projectGenerateEl) projectGenerateEl.hidden = true;
}

function closeProjectResult() {
  if (projectResultEl) projectResultEl.hidden = true;
  if (projectGenerateEl) projectGenerateEl.hidden = false;
  hideProjectStatus();
}

function downloadProjectPage(html, filename) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'kuntai-fde-project.html';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function copyProjectCode(html) {
  try {
    await navigator.clipboard.writeText(html);
    showProjectStatus('代码已复制到剪贴板', 'success');
    setTimeout(hideProjectStatus, 2000);
  } catch {
    showProjectStatus('复制失败，请使用下载按钮', 'error');
  }
}

async function generateProjectPage() {
  if (!serverAIConfig.hasKey) {
    showProjectStatus('请先在「管理员配置」中设置 AI API Key。', 'error');
    return;
  }

  const userText = (aiInput?.value || '').trim();
  const values = [...answers.values()];
  const complete = answers.size === config.length;
  if (!complete) {
    showProjectStatus('请先完成需求判定。', 'error');
    return;
  }

  const total = values.reduce((sum, item) => sum + item.score, 0);
  const hasRedFlag = values.some((item) => item.redflag);
  const verdict = hasRedFlag || total <= -3 ? 'no' : total >= 6 ? 'can' : 'maybe';
  if (verdict === 'no') {
    showProjectStatus('当前需求不满足承接条件，无法生成交付页。', 'error');
    return;
  }

  const recommendedPkgs = verdict === 'can' ? getRecommendedPackages() : [packages.deployment, packages.environment].filter(Boolean);
  lastProjectContext = { userText, verdict, answers, packages: recommendedPkgs };

  openProjectResult();
  showProjectStatus('正在生成交付项目页，请稍候…', 'loading');
  if (projectGenerateBtn) projectGenerateBtn.disabled = true;

  try {
    const answersPayload = config.map((q) => {
      const answer = answers.get(q.id);
      return { dimension_id: q.id, option_index: answer?.optionIndex ?? 0 };
    });
    const resp = await fetch('/api/generate-page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userText,
        verdict,
        answers: answersPayload,
        packages: recommendedPkgs,
        dimensions: config
      })
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data?.ok) throw new Error(data?.message || '生成请求失败 (' + resp.status + ')');

    lastGeneratedHtml = data.html;
    if (!lastGeneratedHtml) throw new Error('未能从响应中提取 HTML 代码');

    renderProjectPreview(lastGeneratedHtml);
    hideProjectStatus();
  } catch (err) {
    showProjectStatus('生成失败: ' + err.message, 'error');
  } finally {
    if (projectGenerateBtn) projectGenerateBtn.disabled = false;
  }
}

projectGenerateBtn?.addEventListener('click', generateProjectPage);
projectRegenerateBtn?.addEventListener('click', generateProjectPage);
projectCloseBtn?.addEventListener('click', closeProjectResult);
projectDownloadBtn?.addEventListener('click', () => {
  if (!lastGeneratedHtml) {
    showProjectStatus('请先生成交付页', 'error');
    return;
  }
  const safeName = (lastProjectContext?.userText || 'kuntai-fde-project').slice(0, 30).replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '_') || 'kuntai-fde-project';
  downloadProjectPage(lastGeneratedHtml, safeName + '.html');
});
projectCopyBtn?.addEventListener('click', () => {
  if (!lastGeneratedHtml) {
    showProjectStatus('请先生成交付页', 'error');
    return;
  }
  copyProjectCode(lastGeneratedHtml);
});

function renderAdmin() {
  if (!adminPanel) return;
  const aiCfg = adminAIConfigCache || { endpoint: serverAIConfig.endpoint, apiKey: '', model: serverAIConfig.model };
  adminPanel.innerHTML = `
    <section class="ai-config-section">
      <h3>AI 智能判定配置</h3>
      <p>配置 OpenAI 兼容 API，密钥保存在服务端，用于 Agent 需求智能判定。</p>
      <div class="ai-config-fields">
        <label>API Endpoint<input data-ai-cfg-endpoint value="${escapeAttr(aiCfg.endpoint)}" placeholder="https://api.openai.com" /></label>
        <label>API Key<input data-ai-cfg-key type="password" value="${escapeAttr(aiCfg.apiKey)}" placeholder="sk-..." /></label>
        <label>Model<input data-ai-cfg-model value="${escapeAttr(aiCfg.model)}" placeholder="gpt-4o-mini" /></label>
      </div>
    </section>
    <section class="ai-config-section lessons-section">
      <h3>经验库管理</h3>
      <p>人工确认沉淀的经验会注入后续 AI 判定，错误经验会污染分析，可在此修正或删除。</p>
      <div class="lessons-list" data-lessons-list><p class="lessons-empty">加载中…</p></div>
    </section>
  ` + config.map((question, qIndex) => `
    <article class="admin-question" data-admin-question="${qIndex}">
      <label>问题 ${qIndex + 1}<input value="${escapeAttr(question.title)}" data-admin-title /></label>
      <div class="admin-options">
        ${question.options.map((option, oIndex) => `
          <div class="admin-option" data-admin-option="${oIndex}">
            <input value="${escapeAttr(option.label)}" data-admin-label aria-label="选项文本" />
            <input type="number" value="${option.score}" data-admin-score aria-label="分值" />
            <label class="check"><input type="checkbox" data-admin-redflag ${option.redflag ? 'checked' : ''} /> 红线</label>
          </div>
        `).join('')}
      </div>
    </article>
  `).join('');
}

function readAdminConfig() {
  return [...document.querySelectorAll('[data-admin-question]')].map((questionEl, qIndex) => ({
    id: config[qIndex]?.id || `question-${qIndex + 1}`,
    title: questionEl.querySelector('[data-admin-title]').value.trim() || `问题 ${qIndex + 1}`,
    options: [...questionEl.querySelectorAll('[data-admin-option]')].map((optionEl) => ({
      label: optionEl.querySelector('[data-admin-label]').value.trim() || '未命名选项',
      score: Number(optionEl.querySelector('[data-admin-score]').value || 0),
      redflag: optionEl.querySelector('[data-admin-redflag]').checked
    }))
  }));
}

function escapeAttr(value) {
  return escapeHtml(value);
}

// ── 经验库管理（管理员策展，复用 adminToken 鉴权） ────────────────────────────
const DIMENSION_TITLES = Object.fromEntries(defaultConfig.map((q) => [q.id, q.title]));
let adminLessonsCache = [];

function formatLessonTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function loadLessons() {
  const listEl = adminPanel?.querySelector('[data-lessons-list]');
  if (!listEl || !adminToken) return;
  try {
    const resp = await fetch('/api/admin/lessons', { headers: { 'x-admin-token': adminToken } });
    const data = await resp.json().catch(() => null);
    if (resp.status === 401) {
      showToast('登录已过期，请重新登录管理员', 'error');
      setAdminVisible(false);
      return;
    }
    if (!resp.ok || !data?.ok) throw new Error(data?.message || '经验库加载失败');
    adminLessonsCache = data.lessons || [];
    renderLessons(listEl, adminLessonsCache);
  } catch (err) {
    listEl.innerHTML = `<p class="lessons-empty">${escapeHtml(err.message || '经验库加载失败')}</p>`;
  }
}

function renderLessons(listEl, lessons) {
  if (!lessons.length) {
    listEl.innerHTML = '<p class="lessons-empty">暂无沉淀的经验。人工确认与 AI 建议不一致时会自动沉淀。</p>';
    return;
  }
  listEl.innerHTML = lessons.map((item) => {
    const dimTitle = item.dimensionId ? (DIMENSION_TITLES[item.dimensionId] || item.dimensionId) : null;
    const src = item.sourceCase;
    const sourceBlock = src ? `
        <details class="lesson-source">
          <summary>来源案例（${src.aiVerdict ? verdictText(src.aiVerdict) : '未判定'}${src.corrections?.length ? ` · ${src.corrections.length} 处人工纠正` : ''}）</summary>
          <p>${escapeHtml((src.requirementText || '').slice(0, 300))}${(src.requirementText || '').length > 300 ? '…' : ''}</p>
        </details>` : (item.context ? `
        <details class="lesson-source">
          <summary>来源上下文</summary>
          <p>${escapeHtml(item.context)}</p>
        </details>` : '');
    return `
    <article class="lesson-card" data-lesson-id="${escapeAttr(item.id)}">
      <p class="lesson-text">${escapeHtml(item.lesson)}</p>
      <div class="lesson-meta">
        ${dimTitle ? `<span class="lesson-dim">${escapeHtml(dimTitle)}</span>` : '<span class="lesson-dim none">未关联维度</span>'}
        <span class="lesson-time">${formatLessonTime(item.createdAt)}</span>
      </div>
      ${sourceBlock}
      <div class="lesson-actions">
        <button class="btn light" type="button" data-lesson-edit>编辑</button>
        <button class="btn light danger" type="button" data-lesson-delete>删除</button>
      </div>
    </article>`;
  }).join('');
}

function renderLessonEdit(card, item) {
  const dimOptions = ['<option value="">（不关联维度）</option>']
    .concat(defaultConfig.map((q) =>
      `<option value="${escapeAttr(q.id)}" ${item.dimensionId === q.id ? 'selected' : ''}>${escapeHtml(q.title)}</option>`))
    .join('');
  card.innerHTML = `
    <div class="lesson-edit">
      <textarea data-lesson-input rows="3">${escapeHtml(item.lesson)}</textarea>
      <select data-lesson-dim>${dimOptions}</select>
      <div class="lesson-actions">
        <button class="btn primary" type="button" data-lesson-save>保存</button>
        <button class="btn light" type="button" data-lesson-cancel>取消</button>
      </div>
    </div>`;
  card.querySelector('[data-lesson-input]')?.focus();
}

// 事件委托：经验卡片的编辑/删除/保存/取消
adminPanel?.addEventListener('click', async (event) => {
  const card = event.target.closest('[data-lesson-id]');
  if (!card) return;
  const id = card.dataset.lessonId;
  const item = adminLessonsCache.find((l) => l.id === id);

  if (event.target.closest('[data-lesson-delete]') && item) {
    if (!window.confirm(`确定删除这条经验吗？删除后不再注入后续判定。\n\n${item.lesson}`)) return;
    try {
      const resp = await fetch(`/api/admin/lessons/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': adminToken || '' }
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data?.ok) throw new Error(data?.message || '删除失败');
      showToast('经验已删除', 'success');
      loadLessons();
      loadEvolutionStats();
    } catch (err) {
      showToast(err.message || '删除失败', 'error');
    }
    return;
  }

  if (event.target.closest('[data-lesson-edit]') && item) {
    renderLessonEdit(card, item);
    return;
  }

  if (event.target.closest('[data-lesson-cancel]')) {
    const listEl = adminPanel.querySelector('[data-lessons-list]');
    if (listEl) renderLessons(listEl, adminLessonsCache);
    return;
  }

  if (event.target.closest('[data-lesson-save]')) {
    const lesson = (card.querySelector('[data-lesson-input]')?.value || '').trim();
    const dimensionId = card.querySelector('[data-lesson-dim]')?.value || null;
    if (!lesson) {
      showToast('经验内容不能为空', 'error');
      return;
    }
    try {
      const resp = await fetch(`/api/admin/lessons/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken || '' },
        body: JSON.stringify({ lesson, dimensionId })
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data?.ok) throw new Error(data?.message || '保存失败');
      showToast('经验已更新', 'success');
      loadLessons();
    } catch (err) {
      showToast(err.message || '保存失败', 'error');
    }
  }
});

resetButton?.addEventListener('click', () => {
  answers.clear();
  if (recommendedPackagesEl) recommendedPackagesEl.hidden = true;
  restoreSelectedButtons();
  renderResult();
});

function setAdminVisible(visible) {
  if (adminLogin) adminLogin.hidden = visible;
  if (adminPrivate) adminPrivate.hidden = !visible;
  if (visible) {
    renderAdmin();
    loadLessons();
  }
}

let previousFocus = null;

function openAdminModal() {
  if (!adminModal) return;
  previousFocus = document.activeElement;
  setAdminVisible(false);
  if (adminPassword) adminPassword.value = '';
  if (adminError) adminError.textContent = '';
  adminModal.hidden = false;
  adminModal.classList.add('is-open');
  document.body.classList.add('modal-open');
  if (adminPassword) adminPassword.focus();
}

function closeAdminModal() {
  if (!adminModal) return;
  setAdminVisible(false);
  if (adminPassword) adminPassword.value = '';
  if (adminError) adminError.textContent = '';
  adminModal.classList.remove('is-open');
  adminModal.hidden = true;
  document.body.classList.remove('modal-open');
  if (previousFocus && typeof previousFocus.focus === 'function') {
    previousFocus.focus();
    previousFocus = null;
  }
}

document.querySelectorAll('[data-admin-open]').forEach((button) => button.addEventListener('click', openAdminModal));
document.querySelectorAll('[data-admin-close]').forEach((button) => button.addEventListener('click', closeAdminModal));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && adminModal && !adminModal.hidden) closeAdminModal();
});

// 管理员认证由服务端完成，前端不存储密码哈希
adminLoginForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const pwd = adminPassword.value;
  if (!pwd) {
    if (adminError) adminError.textContent = '请输入密码';
    return;
  }
  try {
    const resp = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd })
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data?.ok) throw new Error(data?.message || '登录失败，请确认服务端已启动');
    adminToken = data.token;
    if (data.config) {
      adminAIConfigCache = data.config;
      serverAIConfig = { endpoint: data.config.endpoint || '', model: data.config.model || '', hasKey: Boolean(data.config.apiKey) };
    }
    adminPassword.value = '';
    if (adminError) adminError.textContent = '';
    setAdminVisible(true);
  } catch (err) {
    if (adminError) adminError.textContent = err.message || '密码错误，请重试';
    adminPassword.value = '';
  }
});

adminLogout?.addEventListener('click', () => {
  adminToken = null;
  adminAIConfigCache = null;
  setAdminVisible(false);
});

adminSave?.addEventListener('click', async () => {
  config = readAdminConfig();
  saveConfig();
  // AI 配置保存到服务端（需管理员令牌）
  const aiCfgNew = {
    endpoint: (adminPanel.querySelector('[data-ai-cfg-endpoint]')?.value || '').trim(),
    apiKey: (adminPanel.querySelector('[data-ai-cfg-key]')?.value || '').trim(),
    model: (adminPanel.querySelector('[data-ai-cfg-model]')?.value || '').trim()
  };
  try {
    const resp = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken || '' },
      body: JSON.stringify(aiCfgNew)
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data?.ok) throw new Error(data?.message || 'AI 配置保存失败');
    adminAIConfigCache = { ...adminAIConfigCache, ...aiCfgNew };
  } catch (err) {
    showToast(err.message || 'AI 配置保存失败', 'error');
    return;
  }
  answers.clear();
  renderQuestions();
  renderAdmin();
  loadLessons();
  checkAIConfig();
  showToast('配置已保存', 'success');
});

adminReset?.addEventListener('click', () => {
  config = structuredClone(defaultConfig);
  saveConfig();
  answers.clear();
  renderQuestions();
  renderAdmin();
  showToast('已恢复默认判定配置', 'info');
});

document.querySelectorAll('[data-case]').forEach((button) => {
  button.addEventListener('click', () => renderCase(button.dataset.case));
});

function renderCase(caseKey = 'diagnosis') {
  const item = cases[caseKey] || cases.diagnosis;
  document.querySelectorAll('[data-case]').forEach((tab) => {
    const isActive = tab.dataset.case === caseKey;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  });
  casePanel.setAttribute('aria-labelledby', `tab-${caseKey}`);
  casePanel.innerHTML = `<span class="case-status ${item.status}">${item.label}</span><h3>${item.title}</h3><p>${item.body}</p><strong>边界：</strong><p>${item.boundary}</p>`;
}

renderQuestions();
setAdminVisible(false);
renderCase('diagnosis');

const navToggle = document.querySelector('[data-nav-toggle]');
const navLinks = document.querySelector('[data-nav-links]');
navToggle?.addEventListener('click', () => {
  const isOpen = navLinks.classList.toggle('is-open');
  navToggle.setAttribute('aria-expanded', String(isOpen));
});
navLinks?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('is-open');
    navToggle?.setAttribute('aria-expanded', 'false');
  });
});

// ── Toast 反馈提示 ──────────────────────────────────────────────────────────────
const toastEl = document.querySelector('[data-toast]');
let toastTimer = null;

function showToast(msg, type) {
  if (!toastEl) return;
  clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.className = 'toast is-visible' + (type ? ' is-' + type : '');
  toastEl.hidden = false;
  toastTimer = setTimeout(() => {
    toastEl.className = 'toast';
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 300);
  }, 2000);
}

// ── AI 智能判定（Agent 版，由 Node 服务端承载） ────────────────────────────────
// AI 服务配置与密钥均在服务端管理，前端不再存储明文 Key
let serverAIConfig = { endpoint: '', model: '', hasKey: false };
let adminToken = null;
let adminAIConfigCache = null;

const aiInput = document.querySelector('[data-ai-input]');
const aiSubmit = document.querySelector('[data-ai-submit]');
const aiStatus = document.querySelector('[data-ai-status]');
const aiNotice = document.querySelector('[data-ai-notice]');
const aiImageInput = document.querySelector('[data-ai-image]');
const aiImagePreview = document.querySelector('[data-ai-image-preview]');
const aiDocumentInput = document.querySelector('[data-ai-document]');
const aiDocumentPreview = document.querySelector('[data-ai-doc-preview]');
const aiDocumentLoading = document.querySelector('[data-ai-doc-loading]');
const aiDocumentContent = document.querySelector('[data-ai-doc-content]');

let selectedAIImage = null;
let selectedAIDocument = null;

function renderImagePreview(file, dataUrl) {
  if (!aiImagePreview) return;
  selectedAIImage = { file, dataUrl };
  aiImagePreview.innerHTML = `<img src="${dataUrl}" alt="已选图片" /><button type="button" class="ai-image-remove" data-ai-image-remove title="移除图片">×</button>`;
  aiImagePreview.hidden = false;
  aiImagePreview.querySelector('[data-ai-image-remove]')?.addEventListener('click', clearImagePreview);
}

function clearImagePreview() {
  selectedAIImage = null;
  if (aiImagePreview) {
    aiImagePreview.innerHTML = '';
    aiImagePreview.hidden = true;
  }
  if (aiImageInput) aiImageInput.value = '';
}

function renderDocumentPreview(file, text) {
  selectedAIDocument = { file, text };
  if (aiDocumentContent) {
    const excerpt = text.replace(/\s+/g, ' ').slice(0, 120);
    aiDocumentContent.innerHTML = `<div class="ai-doc-info"><strong>📄 ${escapeHtml(file.name)}</strong><span>${escapeHtml(excerpt)}${text.length > 120 ? '…' : ''}</span></div><button type="button" class="ai-image-remove" data-ai-doc-remove title="移除文档">×</button>`;
    aiDocumentContent.hidden = false;
    aiDocumentContent.querySelector('[data-ai-doc-remove]')?.addEventListener('click', clearDocumentPreview);
  }
  if (aiDocumentPreview) aiDocumentPreview.hidden = false;
}

function showDocumentLoading() {
  if (aiDocumentPreview) aiDocumentPreview.hidden = false;
  if (aiDocumentContent) aiDocumentContent.hidden = true;
  if (aiDocumentLoading) aiDocumentLoading.hidden = false;
}

function hideDocumentLoading() {
  if (aiDocumentLoading) aiDocumentLoading.hidden = true;
}

function clearDocumentPreview() {
  selectedAIDocument = null;
  if (aiDocumentContent) {
    aiDocumentContent.innerHTML = '';
    aiDocumentContent.hidden = true;
  }
  if (aiDocumentLoading) aiDocumentLoading.hidden = true;
  if (aiDocumentPreview) aiDocumentPreview.hidden = true;
  if (aiDocumentInput) aiDocumentInput.value = '';
}

async function extractDocumentText(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.md') || name.endsWith('.txt') || file.type.startsWith('text/')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('文档读取失败'));
      reader.readAsText(file);
    });
  }

  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    if (typeof pdfjsLib === 'undefined') throw new Error('PDF 解析库未加载');
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item) => item.str).join(' ') + '\n';
    }
    return text;
  }

  if (name.endsWith('.docx') || name.endsWith('.doc') || file.type.includes('word')) {
    if (typeof mammoth === 'undefined') throw new Error('Word 解析库未加载');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  throw new Error('不支持的文档格式：' + file.name);
}

aiImageInput?.addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    showAIStatus('图片大小不能超过 5MB', 'error');
    aiImageInput.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => renderImagePreview(file, reader.result);
  reader.onerror = () => showAIStatus('图片读取失败', 'error');
  reader.readAsDataURL(file);
});

aiInput?.addEventListener('paste', (event) => {
  const items = event.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      event.preventDefault();
      const file = item.getAsFile();
      if (!file) continue;
      if (file.size > 5 * 1024 * 1024) {
        showAIStatus('粘贴图片大小不能超过 5MB', 'error');
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => renderImagePreview(file, reader.result);
      reader.onerror = () => showAIStatus('图片读取失败', 'error');
      reader.readAsDataURL(file);
      break;
    }
  }
});

aiDocumentInput?.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    showAIStatus('文档大小不能超过 10MB', 'error');
    aiDocumentInput.value = '';
    return;
  }
  try {
    showDocumentLoading();
    const text = await extractDocumentText(file);
    renderDocumentPreview(file, text);
    hideDocumentLoading();
  } catch (err) {
    hideDocumentLoading();
    showAIStatus('文档解析失败: ' + err.message, 'error');
    aiDocumentInput.value = '';
  }
});

async function checkAIConfig() {
  try {
    const resp = await fetch('/api/config');
    if (!resp.ok) throw new Error('config fetch failed');
    const cfg = await resp.json();
    serverAIConfig = { endpoint: cfg.endpoint || '', model: cfg.model || '', hasKey: Boolean(cfg.hasKey) };
    if (aiNotice) aiNotice.hidden = serverAIConfig.hasKey;
  } catch {
    // 服务端不可达时提示启动服务
    if (aiNotice) {
      aiNotice.hidden = false;
      const span = aiNotice.querySelector('span');
      if (span) span.textContent = '⚠️ 无法连接 Agent 服务，请先运行 npm start 启动服务端。';
    }
  }
}
checkAIConfig(); // 初始化时检查服务端配置状态
const aiSummary = document.querySelector('[data-ai-summary]');
const aiSummaryContent = document.querySelector('[data-ai-summary-content]');

function showAIStatus(msg, type) {
  if (!aiStatus) return;
  aiStatus.hidden = false;
  aiStatus.className = 'ai-status' + (type === 'error' ? ' is-error' : ' is-loading');
  aiStatus.textContent = msg;
}

function hideAIStatus() {
  if (!aiStatus) return;
  aiStatus.hidden = true;
  aiStatus.className = 'ai-status';
  aiStatus.textContent = '';
}

// ── Agent 思考过程渲染 ────────────────────────────────────────────────────────
const agentTrace = document.querySelector('[data-agent-trace]');
const agentPlan = document.querySelector('[data-agent-plan]');
const agentPlanReasoning = document.querySelector('[data-agent-plan-reasoning]');
const agentSteps = document.querySelector('[data-agent-steps]');
const agentTools = document.querySelector('[data-agent-tools]');
const agentReflection = document.querySelector('[data-agent-reflection]');
const agentPulse = document.querySelector('[data-agent-pulse]');

const agentStepEls = new Map();

function verdictText(v) {
  return { can: '可以做', maybe: '需要外部支持', no: '不能独立承接' }[v] || '未知';
}

function resetAgentTrace() {
  if (agentTrace) agentTrace.hidden = false;
  if (agentPlan) agentPlan.hidden = true;
  if (agentPlanReasoning) agentPlanReasoning.textContent = '';
  if (agentSteps) agentSteps.innerHTML = '';
  if (agentTools) agentTools.innerHTML = '';
  if (agentReflection) { agentReflection.hidden = true; agentReflection.innerHTML = ''; }
  if (agentPulse) agentPulse.classList.add('is-active');
  agentStepEls.clear();
}

function finishAgentTrace() {
  if (agentPulse) agentPulse.classList.remove('is-active');
}

function renderAgentPlan(data) {
  if (!agentPlan || !agentSteps) return;
  agentPlan.hidden = false;
  if (agentPlanReasoning) agentPlanReasoning.textContent = data.reasoning || '';
  agentSteps.innerHTML = '';
  agentStepEls.clear();
  (data.steps || []).forEach((step) => {
    const li = document.createElement('li');
    li.className = 'agent-step';
    li.innerHTML = '<span class="agent-step-icon"></span><div><strong>' + escapeHtml(step.label || step.tool) + '</strong><p>' + escapeHtml(step.purpose || '') + '</p></div>';
    agentSteps.appendChild(li);
    agentStepEls.set(step.tool, li);
  });
}

function markStep(tool, status) {
  const li = agentStepEls.get(tool);
  if (!li) return;
  li.classList.remove('is-running', 'is-done', 'is-error');
  li.classList.add(status);
}

function renderToolCard(tool, label, purpose) {
  if (!agentTools) return null;
  const card = document.createElement('div');
  card.className = 'agent-tool-card is-running';
  card.innerHTML = '<div class="agent-tool-head"><span class="agent-tool-spinner"></span><strong>' + escapeHtml(label || tool) + '</strong></div>'
    + (purpose ? '<p class="agent-tool-purpose">' + escapeHtml(purpose) + '</p>' : '')
    + '<div class="agent-tool-body" hidden></div>';
  agentTools.appendChild(card);
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  return card;
}

function completeToolCard(card, summary, data, isError) {
  if (!card) return;
  card.classList.remove('is-running');
  if (isError) card.classList.add('is-error');
  const spinner = card.querySelector('.agent-tool-spinner');
  if (spinner) spinner.remove();
  const body = card.querySelector('.agent-tool-body');
  if (body) {
    body.hidden = false;
    body.innerHTML = '<p class="agent-tool-summary">' + escapeHtml(summary || '') + '</p>' + renderToolDetail(data);
  }
}

function renderToolDetail(data) {
  if (!data) return '';
  if (Array.isArray(data.cases) || Array.isArray(data.lessons)) {
    let html = '';
    if (data.cases?.length) {
      html += '<ul class="agent-tool-list">' + data.cases.map((c) =>
        '<li>相似案例：' + escapeHtml(c.excerpt) + '…（结论：' + escapeHtml(verdictText(c.verdict)) + '）</li>').join('') + '</ul>';
    }
    if (data.lessons?.length) {
      html += '<ul class="agent-tool-list lessons">' + data.lessons.map((l) =>
        '<li>经验：' + escapeHtml(l) + '</li>').join('') + '</ul>';
    }
    return html;
  }
  if (Array.isArray(data.decisions)) {
    return '<ul class="agent-tool-list">' + data.decisions.map((d) => {
      const q = config.find((x) => x.id === d.dimension_id);
      const opt = q?.options?.[d.option_index];
      return '<li>' + escapeHtml(q?.title || d.dimension_id) + ' → ' + escapeHtml(opt?.label || ('选项 ' + d.option_index)) + '</li>';
    }).join('') + '</ul>';
  }
  if (Array.isArray(data.redflags) && data.redflags.length) {
    return '<ul class="agent-tool-list red">' + data.redflags.map((r) => {
      const q = config.find((x) => x.id === r.dimension_id);
      return '<li>' + escapeHtml(q?.title || r.dimension_id) + '：' + escapeHtml(r.evidence || '') + '</li>';
    }).join('') + '</ul>';
  }
  return '';
}

function renderReflection(data) {
  if (!agentReflection) return;
  agentReflection.hidden = false;
  agentReflection.innerHTML = '<strong>反思</strong><p>' + escapeHtml(data.summary || '') + '</p>';
}

async function analyzeWithAI(text, imageDataUrl, docText) {
  if (!serverAIConfig.hasKey) {
    showAIStatus('请先在「管理员配置」中设置 AI API Key。', 'error');
    return;
  }

  showAIStatus('Agent 正在启动，请稍候…', 'loading');
  if (aiSummary) aiSummary.hidden = true;
  if (aiSubmit) aiSubmit.disabled = true;
  resetAgentTrace();

  try {
    const resp = await fetch('/api/agent/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, imageDataUrl, docText, dimensions: config })
    });
    if (!resp.ok || !resp.body) {
      const errText = await resp.text().catch(() => '');
      throw new Error('Agent 服务请求失败 (' + resp.status + '): ' + (errText.slice(0, 200) || resp.statusText));
    }
    await consumeAgentStream(resp.body);
  } catch (err) {
    finishAgentTrace();
    showAIStatus('分析失败: ' + err.message, 'error');
  } finally {
    if (aiSubmit) aiSubmit.disabled = false;
  }
}

// 消费 SSE 流：逐事件解析并驱动 Agent 思考过程 UI
async function consumeAgentStream(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const toolCards = new Map();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sepIndex;
    while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = buffer.slice(0, sepIndex);
      buffer = buffer.slice(sepIndex + 2);

      let eventName = 'message';
      let dataStr = '';
      for (const line of rawEvent.split('\n')) {
        if (line.startsWith('event:')) eventName = line.slice(6).trim();
        else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
      }
      if (!dataStr) continue;

      let data;
      try { data = JSON.parse(dataStr); } catch { continue; }

      handleAgentEvent(eventName, data, toolCards);
      if (eventName === 'done' || eventName === 'error') return;
    }
  }
}

function handleAgentEvent(eventName, data, toolCards) {
  switch (eventName) {
    case 'plan_start':
      showAIStatus('Agent 正在制定分析计划…', 'loading');
      break;
    case 'plan':
      renderAgentPlan(data);
      showAIStatus('Agent 正在执行分析计划…', 'loading');
      break;
    case 'tool_start': {
      markStep(data.tool, 'is-running');
      const card = renderToolCard(data.tool, data.label, data.purpose);
      if (card) toolCards.set(data.tool, card);
      break;
    }
    case 'tool_result':
      markStep(data.tool, 'is-done');
      completeToolCard(toolCards.get(data.tool), data.summary, data.data, false);
      break;
    case 'tool_error':
      markStep(data.tool, 'is-error');
      completeToolCard(toolCards.get(data.tool), data.message, null, true);
      break;
    case 'reflection':
      renderReflection(data);
      break;
    case 'done':
      finishAgentTrace();
      hideAIStatus();
      applyAgentResult(data);
      break;
    case 'error':
      finishAgentTrace();
      showAIStatus('分析失败: ' + (data.message || '未知错误'), 'error');
      break;
  }
}

// ── Agent 结果应用与反馈采集 ──────────────────────────────────────────────────
let currentCaseId = null;
let feedbackSentForCase = null;

function applyAgentResult(result) {
  // 需求有效性关卡：无效需求直接拦截，不进入人工确认
  if (result.valid === false) {
    currentCaseId = null;
    if (aiSummary && aiSummaryContent) {
      const reason = result.validityReason || '需求描述不清晰或不完整，无法判断是否需要 FDE 参与。';
      aiSummaryContent.innerHTML = '<p style="margin:0 0 10px;color:var(--muted);font-size:14px;">Agent 初筛结论：当前输入不是一个可执行的 AI 项目需求。</p><p style="margin:0;color:var(--red);font-size:13px;font-weight:600;">' + escapeHtml(reason) + ' 请补充客户场景、目标和预期交付物后再试。</p>';
      aiSummary.hidden = false;
    }
    return;
  }

  const decisions = Array.isArray(result.decisions) ? result.decisions : [];
  if (!decisions.length) {
    showAIStatus('Agent 返回格式异常，无法自动填充判定。', 'error');
    return;
  }

  currentCaseId = result.caseId || null;
  feedbackSentForCase = null;

  // 初筛为"不能独立承接"：直接拦截，不展开人工确认区
  if (result.verdict === 'no') {
    if (decisionStage) decisionStage.hidden = true;
    if (aiSummary && aiSummaryContent) {
      const reasonText = result.hasRedFlag
        ? 'Agent 初筛发现红线风险，建议重新收敛需求或转交其他团队评估。'
        : 'Agent 初筛认为该需求暂不满足承接条件，建议重新收敛需求后再试。';
      aiSummaryContent.innerHTML = '<p style="margin:0 0 10px;color:var(--muted);font-size:14px;">' + escapeHtml(result.summary || '') + '</p><p style="margin:0;color:var(--red);font-size:13px;font-weight:600;">' + reasonText + '</p>';
      aiSummary.hidden = false;
    }
    return;
  }

  // 初筛通过（can / maybe）：展开人工确认区，AI 建议仅作参考，最终由人工确认
  if (decisionStage) decisionStage.hidden = false;
  decisionStage?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  restoreSelectedButtons();
  renderResult();

  if (aiSummary && aiSummaryContent) {
    const items = decisions.map(d =>
      '<li><strong>' + escapeHtml(d.dimension_title || d.dimension_id) + '</strong> → ' + escapeHtml(d.option_label || '') + '（' + escapeHtml(d.reason || '') + '）</li>'
    );
    const confirmHint = '<p style="margin:0 0 10px;color:var(--brand);font-size:13px;font-weight:600;">请手动确认以下 ' + config.length + ' 个问题。全部确认完成后，只有判定为"可以做"才会出现生成按钮。</p>';
    aiSummaryContent.innerHTML = '<p style="margin:0 0 10px;color:var(--muted);font-size:14px;">' + escapeHtml(result.summary || '') + '</p>' + confirmHint + '<ul>' + items.join('') + '</ul>';
    aiSummary.hidden = false;
  }
}

// 人工确认完成全部维度后，将「AI 建议 vs 人工确认」反馈给服务端，驱动 Agent 进化
async function maybeSubmitFeedback() {
  if (!currentCaseId || feedbackSentForCase === currentCaseId) return;
  if (answers.size !== config.length) return;
  feedbackSentForCase = currentCaseId;

  const confirmations = config.map((q) => {
    const answer = answers.get(q.id);
    return { dimension_id: q.id, option_index: answer?.optionIndex ?? 0 };
  });

  try {
    const resp = await fetch('/api/agent/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId: currentCaseId, confirmations })
    });
    const data = await resp.json();
    if (!data?.ok) return;
    if (data.lessons?.length) {
      showToast('Agent 已沉淀 ' + data.lessons.length + ' 条新经验，判定持续进化', 'success');
    } else if (data.corrections === 0) {
      showToast('AI 建议全部被采纳，已计入进化指标', 'info');
    }
    if (data.stats) renderEvolutionStats(data.stats);
  } catch {
    // 反馈失败不影响主流程
  }
}

// ── Agent 进化看板 ────────────────────────────────────────────────────────────
const evoCases = document.querySelector('[data-evo-cases]');
const evoRate = document.querySelector('[data-evo-rate]');
const evoLessons = document.querySelector('[data-evo-lessons]');
const evoTrend = document.querySelector('[data-evo-trend]');

function renderEvolutionStats(stats) {
  if (!stats) return;
  if (evoCases) evoCases.textContent = String(stats.totalCases ?? 0);
  if (evoRate) evoRate.textContent = stats.acceptanceRate === null || stats.acceptanceRate === undefined ? '—' : stats.acceptanceRate + '%';
  if (evoLessons) evoLessons.textContent = String(stats.lessonCount ?? 0);
  if (evoTrend) {
    const weekly = (stats.weekly || []).filter((w) => w.rate !== null);
    if (weekly.length) {
      evoTrend.hidden = false;
      evoTrend.innerHTML = '<span class="evo-trend-label">采纳率趋势</span>' + weekly.map((w) =>
        '<span class="evo-trend-item"><em>' + escapeHtml(w.week) + '</em><strong>' + w.rate + '%</strong></span>'
      ).join('');
    } else {
      evoTrend.hidden = true;
      evoTrend.innerHTML = '';
    }
  }
}

async function loadEvolutionStats() {
  try {
    const resp = await fetch('/api/agent/stats');
    if (!resp.ok) return;
    renderEvolutionStats(await resp.json());
  } catch {
    // 服务端不可达时保持默认展示
  }
}
loadEvolutionStats();

aiSubmit?.addEventListener('click', () => {
  const text = (aiInput?.value || '').trim();
  const imageDataUrl = selectedAIImage?.dataUrl;
  const docText = selectedAIDocument?.text;
  if (!text && !imageDataUrl && !docText) {
    showAIStatus('请先输入需求描述、上传图片或上传文档。', 'error');
    return;
  }
  // 仅文字输入时做基础有效性校验
  if (text && !imageDataUrl && !docText) {
    if (text.length < 15) {
      showAIStatus('需求描述过于简短，请至少说明客户场景、目标和预期交付物。', 'error');
      return;
    }
    const questionPatterns = /(什么意思|怎么办|为什么|吗|？|\?|怎么|如何|是不是|可不可以|能不能|啥|谁|哪里|几个|多少|什么)/;
    if (questionPatterns.test(text)) {
      showAIStatus('输入内容更像疑问而非需求描述，请补充具体的客户需求。', 'error');
      return;
    }
    // 检测无意义重复或乱码
    const repeatPattern = /(.+)\1{2,}/;
    if (repeatPattern.test(text)) {
      showAIStatus('检测到重复或无意义内容，请补充真实客户需求。', 'error');
      return;
    }
    // 检测中英文混杂乱码：中文字符占比过低或存在大量无意义重复音节
    const chineseChars = text.match(/[\u4e00-\u9fa5]/g) || [];
    const totalChars = text.replace(/\s/g, '').length;
    if (totalChars > 0 && chineseChars.length / totalChars < 0.5) {
      showAIStatus('需求描述中文占比过低，疑似乱码或外文堆砌，请用中文补充真实需求。', 'error');
      return;
    }
    // 检测无意义重复音节（如"撒旦""倒萨"等反复出现）
    const syllablePattern = /([\u4e00-\u9fa5]{2,}).*\1.*\1/;
    if (syllablePattern.test(text)) {
      showAIStatus('检测到无意义重复内容，请补充真实客户需求。', 'error');
      return;
    }
    // 必须同时包含动作/交付意向词 和 对象/场景词
    const actionWords = /(需要|想要|希望|做|开发|搭建|部署|实现|分析|处理|生成|构建|设计|制作|训练|验证|测试|集成|接入|落地|交付)/;
    const objectWords = /(客户|项目|系统|平台|工具|网页|网站|应用|小程序|AI|模型|数据|报告|方案|知识库|Agent|RAG|流程|接口|服务|功能|模块|场景)/;
    if (!actionWords.test(text) || !objectWords.test(text)) {
      showAIStatus('需求描述缺少动作或对象，请补充"客户要做什么"以及"做什么东西/系统"。', 'error');
      return;
    }
  }
  analyzeWithAI(text, imageDataUrl, docText);
});

// Allow Ctrl+Enter to submit
aiInput?.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    aiSubmit?.click();
  }
});
