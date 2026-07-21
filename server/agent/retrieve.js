// 本地文本相似度检索：中文 bigram + 英文词重叠度（余弦近似），零外部依赖
// 用于从历史案例库中检索与当前需求最相似的案例，作为 few-shot 注入 prompt

function tokenize(text) {
  const clean = String(text || '').toLowerCase();
  const tokens = new Set();

  const chars = clean.match(/[\u4e00-\u9fa5]/g) || [];
  for (let i = 0; i < chars.length - 1; i++) {
    tokens.add(chars[i] + chars[i + 1]);
  }

  const words = clean.match(/[a-z0-9]+/g) || [];
  for (const w of words) {
    if (w.length >= 2) tokens.add(w);
  }
  return tokens;
}

function similarity(a, b) {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.sqrt(ta.size * tb.size);
}

// 从案例库检索 Top-K 相似案例
function retrieveSimilar(queryText, cases, topK = 3) {
  if (!Array.isArray(cases) || !cases.length) return [];
  return cases
    .map((item) => ({ item, score: similarity(queryText, item.requirementText || '') }))
    .filter((x) => x.score > 0.04)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((x) => ({ ...x.item, similarity: Number(x.score.toFixed(3)) }));
}

// 检索与当前需求相关的经验条目（按关键词重叠简单过滤，不足时补足最新条目）
function retrieveLessons(queryText, lessons, topK = 6) {
  if (!Array.isArray(lessons) || !lessons.length) return [];
  const scored = lessons
    .map((item) => ({ item, score: similarity(queryText, (item.lesson || '') + ' ' + (item.context || '')) }))
    .sort((a, b) => b.score - a.score);
  const related = scored.filter((x) => x.score > 0.03).slice(0, topK).map((x) => x.item);
  if (related.length >= Math.min(3, lessons.length)) return related;
  // 相关经验不足时，补充最新的经验，保证进化成果始终参与判定
  const latest = [...lessons].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  for (const l of latest) {
    if (related.length >= topK) break;
    if (!related.includes(l)) related.push(l);
  }
  return related;
}

module.exports = { tokenize, similarity, retrieveSimilar, retrieveLessons };
