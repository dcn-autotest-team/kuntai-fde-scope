// 服务端 AI 服务配置管理：密钥只存服务端，不下发到前端
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

const defaultAIConfig = {
  endpoint: 'https://api.senseaudio.cn',
  apiKey: 'sk-pBbqubOlHanAsYraq0tB0iyTAiu5KM7D51762019C73b48Eb9b940040Cf43E39a',
  model: 'senseaudio-s2-lite'
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadAIConfig() {
  ensureDataDir();
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      return { ...defaultAIConfig, ...saved };
    }
  } catch {
    // 配置文件损坏时回退默认配置
  }
  return { ...defaultAIConfig };
}

function saveAIConfig(cfg) {
  ensureDataDir();
  const merged = {
    endpoint: String(cfg.endpoint || '').trim() || defaultAIConfig.endpoint,
    apiKey: String(cfg.apiKey || '').trim(),
    model: String(cfg.model || '').trim() || defaultAIConfig.model
  };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf8');
  return merged;
}

// 返回给前端的公开配置（不泄露密钥本体）
function publicConfig() {
  const cfg = loadAIConfig();
  return {
    endpoint: cfg.endpoint,
    model: cfg.model,
    hasKey: Boolean(cfg.apiKey && cfg.apiKey.trim())
  };
}

module.exports = { DATA_DIR, defaultAIConfig, loadAIConfig, saveAIConfig, publicConfig, ensureDataDir };
