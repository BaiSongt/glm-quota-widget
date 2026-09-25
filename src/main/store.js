const fs = require('node:fs');
const path = require('node:path');
const { app, safeStorage } = require('electron');

const DEFAULT_CONFIG = {
  refreshMinutes: 5,
  warnAt: 80,
  criticalAt: 90,
  launchAtLogin: false,
  theme: 'clear',
  accounts: [],
  window: { x: null, y: null },
};

function configPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

function loadConfig() {
  try {
    const raw = fs.readFileSync(configPath(), 'utf8');
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      window: { ...DEFAULT_CONFIG.window, ...(parsed.window || {}) },
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
      theme: ['clear', 'prism', 'midnight'].includes(parsed.theme) ? parsed.theme : 'clear',
    };
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }
}

function saveConfig(config) {
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  const tmp = `${configPath()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(config, null, 2), 'utf8');
  fs.renameSync(tmp, configPath());
}

function encryptSecret(value) {
  if (!value) return '';
  if (safeStorage.isEncryptionAvailable()) {
    return `enc:${safeStorage.encryptString(value).toString('base64')}`;
  }
  return `plain:${Buffer.from(value, 'utf8').toString('base64')}`;
}

function decryptSecret(value) {
  if (!value) return '';
  if (value.startsWith('enc:')) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('系统安全存储当前不可用');
    return safeStorage.decryptString(Buffer.from(value.slice(4), 'base64'));
  }
  if (value.startsWith('plain:')) {
    return Buffer.from(value.slice(6), 'base64').toString('utf8');
  }
  return '';
}

function publicConfig(config) {
  return {
    refreshMinutes: config.refreshMinutes,
    warnAt: config.warnAt,
    criticalAt: config.criticalAt,
    launchAtLogin: config.launchAtLogin,
    theme: ['clear', 'prism', 'midnight'].includes(config.theme) ? config.theme : 'clear',
    accounts: config.accounts.map(({ secret, ...account }) => ({ ...account, hasKey: Boolean(secret) })),
  };
}

module.exports = {
  loadConfig,
  saveConfig,
  encryptSecret,
  decryptSecret,
  publicConfig,
};
