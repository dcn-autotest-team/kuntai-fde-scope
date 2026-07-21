// OpenAI 兼容 LLM 客户端（仅服务端调用，密钥不出服务端）
const { loadAIConfig } = require('./config');

async function chatCompletion({ messages, temperature = 0.3, maxTokens = 1500 }) {
  const cfg = loadAIConfig();
  if (!cfg.apiKey) throw new Error('AI 服务未配置 API Key，请先在管理员配置中设置。');

  const url = cfg.endpoint.replace(/\/+$/, '') + '/v1/chat/completions';
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + cfg.apiKey
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      temperature,
      max_tokens: maxTokens
    }),
    signal: AbortSignal.timeout(120000) // 单次 LLM 调用最长 120s，避免挂死
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error('API 请求失败 (' + resp.status + '): ' + (errText.slice(0, 200) || resp.statusText));
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('API 返回内容为空');
  return content;
}

// 多模态消息构造：文本 + 可选图片 dataURL
function buildUserContent(text, imageDataUrl) {
  const content = [{ type: 'text', text }];
  if (imageDataUrl) {
    content.push({ type: 'image_url', image_url: { url: imageDataUrl } });
  }
  return content;
}

// 从 LLM 输出中容错提取 JSON 对象
function extractJson(content) {
  let jsonStr = String(content || '').trim();
  const blockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (blockMatch) jsonStr = blockMatch[1].trim();

  jsonStr = jsonStr
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/,\s*([}\]])/g, '$1');

  if (!jsonStr.startsWith('{')) {
    const objMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objMatch) jsonStr = objMatch[0];
  }
  return JSON.parse(jsonStr);
}

// 调用 LLM 并解析 JSON，失败时返回 fallback
async function chatJson({ messages, temperature = 0.3, maxTokens = 1500, fallback = null }) {
  try {
    const content = await chatCompletion({ messages, temperature, maxTokens });
    return extractJson(content);
  } catch (err) {
    if (fallback !== null) return fallback;
    throw err;
  }
}

module.exports = { chatCompletion, chatJson, buildUserContent, extractJson };
