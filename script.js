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
const resultLabel = document.querySelector('[data-result-label]');
const resultTitle = document.querySelector('[data-result-title]');
const resultText = document.querySelector('[data-result-text]');
const resultList = document.querySelector('[data-result-list]');
const scorebar = document.querySelector('[data-scorebar]');
const resetButton = document.querySelector('[data-reset]');
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
    resultLabel.textContent = `已选择 ${answers.size}/${config.length}`;
    resultTitle.textContent = '继续完成判定';
    resultText.textContent = '还需要选择剩余问题。优先判断是否属于 AI 应用落地、PoC/MVP、测试评估或部署协同范围。';
    resultList.innerHTML = '<li>没有完成全部问题前，不建议承诺客户范围。</li><li>如出现生产级总包、无人审核决策、7x24 SLA 或底层模型研发红线，应暂停推进。</li>';
    scorebar.style.width = `${Math.max(8, answers.size / Math.max(config.length, 1) * 45)}%`;
    scorebar.style.background = 'var(--brand)';
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
  } else if (total >= 8) {
    resultCard.classList.add('can');
    resultLabel.textContent = '可以做';
    resultTitle.textContent = '该需求属于神州鲲泰 FDE 能力范围';
    resultText.textContent = '可以进入场景诊断、PoC/MVP、测试评估、推理部署验证或客户环境接入协同阶段。';
    resultList.innerHTML = '<li>明确业务场景、技术可行性和 MVP 路线图。</li><li>用 RAG、Agent、测试评估或部署验证形成可验收结果。</li><li>沉淀评测报告、部署 checklist、风险清单和后续迭代建议。</li>';
    scorebar.style.background = 'var(--green)';
    renderRecommendedPackages('can');
  } else {
    resultCard.classList.add('maybe');
    resultLabel.textContent = '需要外部支持';
    resultTitle.textContent = '该需求可以参与，但不宜独立兜底';
    resultText.textContent = '建议先收敛为 PoC/MVP 或试点范围，并明确需要哪些外部角色配合。';
    resultList.innerHTML = '<li>拆分 FDE 能做的原型、评测、部署验证和协同排障部分。</li><li>生产级架构、复杂权限、核心系统改造和 SLA 需由专业团队负责。</li><li>在合同和验收口径中写清责任边界。</li>';
    scorebar.style.background = 'var(--amber)';
    renderRecommendedPackages('maybe');
  }
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

function renderAdmin() {
  if (!adminPanel) return;
  const aiCfg = loadAIConfig();
  adminPanel.innerHTML = `
    <section class="ai-config-section">
      <h3>AI 智能判定配置</h3>
      <p>配置 OpenAI 兼容 API，用于需求智能判定功能。</p>
      <div class="ai-config-fields">
        <label>API Endpoint<input data-ai-cfg-endpoint value="${escapeAttr(aiCfg.endpoint)}" placeholder="https://api.openai.com" /></label>
        <label>API Key<input data-ai-cfg-key type="password" value="${escapeAttr(aiCfg.apiKey)}" placeholder="sk-..." /></label>
        <label>Model<input data-ai-cfg-model value="${escapeAttr(aiCfg.model)}" placeholder="gpt-4o-mini" /></label>
      </div>
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

resetButton?.addEventListener('click', () => {
  answers.clear();
  if (recommendedPackagesEl) recommendedPackagesEl.hidden = true;
  restoreSelectedButtons();
  renderResult();
});

function setAdminVisible(visible) {
  if (adminLogin) adminLogin.hidden = visible;
  if (adminPrivate) adminPrivate.hidden = !visible;
  if (visible) renderAdmin();
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

adminOpen?.addEventListener('click', openAdminModal);
document.querySelectorAll('[data-admin-close]').forEach((button) => button.addEventListener('click', closeAdminModal));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && adminModal && !adminModal.hidden) closeAdminModal();
});

// 管理员密码哈希 (SHA-256)，明文不存储在源码中
const ADMIN_PWD_HASH = 'c638bc74f30482cae5ec685f12c435196bca31a591b6943157e6f38c973ad467';

async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

adminLoginForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const pwd = adminPassword.value;
  if (!pwd) {
    if (adminError) adminError.textContent = '请输入密码';
    return;
  }
  const hash = await hashPassword(pwd);
  if (hash === ADMIN_PWD_HASH) {
    adminPassword.value = '';
    if (adminError) adminError.textContent = '';
    setAdminVisible(true);
  } else {
    if (adminError) adminError.textContent = '密码错误，请重试';
    adminPassword.value = '';
  }
});

adminLogout?.addEventListener('click', () => setAdminVisible(false));

adminSave?.addEventListener('click', () => {
  config = readAdminConfig();
  saveConfig();
  // Save AI config
  const aiCfgNew = {
    endpoint: (adminPanel.querySelector('[data-ai-cfg-endpoint]')?.value || '').trim() || defaultAIConfig.endpoint,
    apiKey: (adminPanel.querySelector('[data-ai-cfg-key]')?.value || '').trim(),
    model: (adminPanel.querySelector('[data-ai-cfg-model]')?.value || '').trim() || defaultAIConfig.model
  };
  saveAIConfig(aiCfgNew);
  answers.clear();
  renderQuestions();
  renderAdmin();
  checkAIConfig();
  showToast('配置已保存', 'success');
});

adminReset?.addEventListener('click', () => {
  config = structuredClone(defaultConfig);
  saveConfig();
  saveAIConfig(defaultAIConfig);
  answers.clear();
  renderQuestions();
  renderAdmin();
  showToast('已恢复默认配置', 'info');
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

// ── AI 智能判定 ────────────────────────────────────────────────────────────────
const AI_STORAGE_KEY = 'kuntai-fde-ai-config';

const defaultAIConfig = {
  endpoint: 'https://api.openai.com',
  apiKey: '',
  model: 'gpt-4o-mini'
};

function loadAIConfig() {
  try {
    const saved = localStorage.getItem(AI_STORAGE_KEY);
    return saved ? { ...defaultAIConfig, ...JSON.parse(saved) } : { ...defaultAIConfig };
  } catch {
    return { ...defaultAIConfig };
  }
}

function saveAIConfig(cfg) {
  localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(cfg));
}

const aiInput = document.querySelector('[data-ai-input]');
const aiSubmit = document.querySelector('[data-ai-submit]');
const aiStatus = document.querySelector('[data-ai-status]');
const aiNotice = document.querySelector('[data-ai-notice]');

function checkAIConfig() {
  if (!aiNotice) return;
  const cfg = loadAIConfig();
  aiNotice.hidden = !!(cfg.apiKey && cfg.apiKey.trim());
}
checkAIConfig(); // 初始化时检查 API Key 状态
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

function buildAIPrompt(userText) {
  const dimensions = config.map((q, i) =>
    `${i + 1}. ${q.title}\n   选项：${q.options.map((o, j) => `[${j}] ${o.label}（分值 ${o.score}${o.redflag ? '，红线' : ''}）`).join(' | ')}`
  ).join('\n');

  return `你是一个专业的需求分析助手。用户将描述一个客户需求，你需要根据以下 ${config.length} 个判定维度分析该需求，并为每个维度选择最合适的选项。

## 判定维度与选项
${dimensions}

## 用户描述
${userText}

## 输出要求
请严格按照以下 JSON 格式输出，不要输出其他内容：
{
  "decisions": [
    { "dimension_id": "维度id", "option_index": 选项序号（从0开始）, "reason": "简短理由" }
  ],
  "summary": "整体分析摘要（一两句话）"
}

注意：
- 每个维度必须选择一个选项
- option_index 对应选项序号（从 0 开始）
- 如果需求触发任何红线选项，请如实标记
- summary 用中文简要说明分析结论`;
}

async function analyzeWithAI(text) {
  const aiCfg = loadAIConfig();
  if (!aiCfg.apiKey) {
    showAIStatus('请先在「管理员配置」中设置 AI API Key。', 'error');
    return;
  }

  const prompt = buildAIPrompt(text);
  showAIStatus('AI 正在分析需求，请稍候…', 'loading');
  if (aiSummary) aiSummary.hidden = true;
  if (aiSubmit) aiSubmit.disabled = true;

  try {
    const url = aiCfg.endpoint.replace(/\/+$/, '') + '/v1/chat/completions';
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + aiCfg.apiKey
      },
      body: JSON.stringify({
        model: aiCfg.model,
        messages: [
          { role: 'system', content: '你是一个严格按要求输出 JSON 的分析助手，不要输出任何非 JSON 内容。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1500
      })
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error('API 请求失败 (' + resp.status + '): ' + (errText.slice(0, 200) || resp.statusText));
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('API 返回内容为空');

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = content.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    const parsed = JSON.parse(jsonStr);
    applyAIResult(parsed);
  } catch (err) {
    showAIStatus('分析失败: ' + err.message, 'error');
  } finally {
    if (aiSubmit) aiSubmit.disabled = false;
  }
}

function applyAIResult(result) {
  const decisions = result?.decisions;
  if (!Array.isArray(decisions) || !decisions.length) {
    showAIStatus('AI 返回格式异常，无法自动填充判定。', 'error');
    return;
  }

  // Clear previous answers
  answers.clear();

  const appliedIds = [];
  for (const decision of decisions) {
    const question = config.find(q => q.id === decision.dimension_id);
    if (!question) continue;
    const optIdx = Number(decision.option_index);
    const option = question.options[optIdx];
    if (!option) continue;
    answers.set(question.id, {
      score: Number(option.score),
      redflag: Boolean(option.redflag),
      optionIndex: optIdx
    });
    appliedIds.push(question.id);
  }

  restoreSelectedButtons();
  renderResult();

  // Show summary
  hideAIStatus();
  if (aiSummary && aiSummaryContent) {
    const summaryText = result?.summary || '分析完成';
    const items = decisions
      .filter(d => {
        const q = config.find(q2 => q2.id === d.dimension_id);
        return q && q.options[Number(d.option_index)];
      })
      .map(d => {
        const q = config.find(q2 => q2.id === d.dimension_id);
        const opt = q.options[Number(d.option_index)];
        return '<li><strong>' + escapeHtml(q.title) + '</strong> → ' + escapeHtml(opt.label) + '（' + escapeHtml(d.reason || '') + '）</li>';
      });
    aiSummaryContent.innerHTML = '<p style="margin:0 0 10px;color:var(--muted);font-size:14px;">' + escapeHtml(summaryText) + '</p><ul>' + items.join('') + '</ul>';
    aiSummary.hidden = false;
  }
}

aiSubmit?.addEventListener('click', () => {
  const text = (aiInput?.value || '').trim();
  if (!text) {
    showAIStatus('请先输入需求描述。', 'error');
    return;
  }
  analyzeWithAI(text);
});

// Allow Ctrl+Enter to submit
aiInput?.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    aiSubmit?.click();
  }
});
