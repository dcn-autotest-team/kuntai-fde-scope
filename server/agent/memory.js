// Agent 记忆与进化系统：案例库、经验条目、进化指标，JSON 文件持久化
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ensureDataDir, DATA_DIR } = require('./config');

const CASES_FILE = path.join(DATA_DIR, 'cases.json');
const LESSONS_FILE = path.join(DATA_DIR, 'lessons.json');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');

const MAX_CASES = 500;
const MAX_LESSONS = 200;

function readJson(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    // 文件损坏时回退默认值
  }
  return fallback;
}

function writeJson(file, data) {
  ensureDataDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// ── 案例库 ──────────────────────────────────────────────────────────────────

function getCases() {
  return readJson(CASES_FILE, []);
}

function getCase(caseId) {
  return getCases().find((c) => c.id === caseId) || null;
}

// 新建案例（AI 初筛完成后调用，等待用户人工确认反馈）
function addCase({ requirementText, hasImage, hasDoc, decisions, verdict, summary, packages }) {
  const cases = getCases();
  const item = {
    id: crypto.randomUUID(),
    requirementText: String(requirementText || '').slice(0, 2000),
    hasImage: Boolean(hasImage),
    hasDoc: Boolean(hasDoc),
    aiDecisions: decisions || [],
    aiVerdict: verdict || null,
    aiSummary: summary || '',
    aiPackages: packages || [],
    confirmations: null,       // 用户最终确认：[{ dimension_id, option_index }]
    corrections: null,         // 与 AI 建议不一致的维度
    createdAt: Date.now(),
    feedbackAt: null
  };
  cases.push(item);
  while (cases.length > MAX_CASES) cases.shift();
  writeJson(CASES_FILE, cases);
  return item;
}

// 写入用户确认结果，返回与 AI 建议的差异列表
function applyFeedback(caseId, confirmations) {
  const cases = getCases();
  const item = cases.find((c) => c.id === caseId);
  if (!item) return null;

  const confirmed = Array.isArray(confirmations) ? confirmations : [];
  const corrections = [];
  for (const conf of confirmed) {
    const ai = (item.aiDecisions || []).find((d) => d.dimension_id === conf.dimension_id);
    if (ai && Number(ai.option_index) !== Number(conf.option_index)) {
      corrections.push({
        dimension_id: conf.dimension_id,
        ai_option_index: Number(ai.option_index),
        user_option_index: Number(conf.option_index)
      });
    }
  }

  item.confirmations = confirmed;
  item.corrections = corrections;
  item.feedbackAt = Date.now();
  writeJson(CASES_FILE, cases);

  updateStatsWithFeedback(item);
  return { case: item, corrections };
}

// ── 经验条目 ────────────────────────────────────────────────────────────────

function getLessons() {
  return readJson(LESSONS_FILE, []);
}

function addLesson({ lesson, context, dimensionId }) {
  const lessons = getLessons();
  const text = String(lesson || '').trim();
  if (!text) return null;
  // 去重：完全相同的经验不重复沉淀
  if (lessons.some((l) => l.lesson === text)) return null;
  const item = {
    id: crypto.randomUUID(),
    lesson: text.slice(0, 500),
    context: String(context || '').slice(0, 300),
    dimensionId: dimensionId || null,
    createdAt: Date.now()
  };
  lessons.push(item);
  while (lessons.length > MAX_LESSONS) lessons.shift();
  writeJson(LESSONS_FILE, lessons);
  return item;
}

// 更新经验条目（管理员策展：错误经验会污染后续判定，需可修正）
function updateLesson(id, { lesson, context, dimensionId }) {
  const lessons = getLessons();
  const item = lessons.find((l) => l.id === id);
  if (!item) return null;
  const text = String(lesson || '').trim();
  if (!text) return null;
  item.lesson = text.slice(0, 500);
  if (context !== undefined) item.context = String(context || '').slice(0, 300);
  if (dimensionId !== undefined) item.dimensionId = dimensionId || null;
  writeJson(LESSONS_FILE, lessons);
  return item;
}

// 删除经验条目（管理员策展）
function deleteLesson(id) {
  const lessons = getLessons();
  const index = lessons.findIndex((l) => l.id === id);
  if (index === -1) return false;
  lessons.splice(index, 1);
  writeJson(LESSONS_FILE, lessons);
  return true;
}

// ── 进化指标 ────────────────────────────────────────────────────────────────

function defaultStats() {
  return { totalFeedbacks: 0, totalSuggestions: 0, acceptedSuggestions: 0, weekly: [] };
}

function getWeekKey(ts) {
  const d = new Date(ts);
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  return d.getFullYear() + '-W' + String(week).padStart(2, '0');
}

function updateStatsWithFeedback(caseItem) {
  const stats = readJson(STATS_FILE, defaultStats());
  const total = (caseItem.aiDecisions || []).length;
  const corrected = (caseItem.corrections || []).length;
  const accepted = Math.max(0, total - corrected);

  stats.totalFeedbacks += 1;
  stats.totalSuggestions += total;
  stats.acceptedSuggestions += accepted;

  const weekKey = getWeekKey(Date.now());
  let week = stats.weekly.find((w) => w.week === weekKey);
  if (!week) {
    week = { week: weekKey, feedbacks: 0, suggestions: 0, accepted: 0 };
    stats.weekly.push(week);
  }
  week.feedbacks += 1;
  week.suggestions += total;
  week.accepted += accepted;
  while (stats.weekly.length > 12) stats.weekly.shift();

  writeJson(STATS_FILE, stats);
}

function getStats() {
  const stats = readJson(STATS_FILE, defaultStats());
  const cases = getCases();
  const lessons = getLessons();
  const rate = stats.totalSuggestions > 0
    ? Math.round((stats.acceptedSuggestions / stats.totalSuggestions) * 100)
    : null;
  return {
    totalCases: cases.length,
    confirmedCases: cases.filter((c) => c.confirmations).length,
    lessonCount: lessons.length,
    totalSuggestions: stats.totalSuggestions,
    acceptedSuggestions: stats.acceptedSuggestions,
    acceptanceRate: rate,
    weekly: stats.weekly.map((w) => ({
      week: w.week,
      feedbacks: w.feedbacks,
      rate: w.suggestions > 0 ? Math.round((w.accepted / w.suggestions) * 100) : null
    }))
  };
}

module.exports = {
  getCases, getCase, addCase, applyFeedback,
  getLessons, addLesson, updateLesson, deleteLesson,
  getStats
};
