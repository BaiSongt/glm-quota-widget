const path = require('node:path');
const crypto = require('node:crypto');
const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, Notification, screen } = require('electron');
const { fetchAccountQuota } = require('./quota');
const { loadConfig, saveConfig, encryptSecret, decryptSecret, publicConfig } = require('./store');

let mainWindow;
let tray;
let config;
let refreshTimer;
let isQuitting = false;
const quotaByAccount = new Map();
const notifiedBucket = new Map();

function assetPath(name) {
  return path.join(__dirname, '../../assets/icons', name);
}

function trayImage() {
  const image = nativeImage.createFromPath(assetPath('tray.png'));
  if (!image.isEmpty()) {
    return image.resize({ width: 20, height: 20, quality: 'best' });
  }
  const fallbackSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <rect x="2" y="2" width="28" height="28" rx="9" fill="#5b9cf3" stroke="#f8fbff" stroke-width="2"/>
    <path d="M22.5 10.5a8 8 0 1 0 0 11v-5.2h-6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
  </svg>`;
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(fallbackSvg).toString('base64')}`);
}

function getWindowBounds() {
  const display = screen.getPrimaryDisplay();
  const width = 420;
  const height = 620;
  const fallback = {
    x: Math.round(display.workArea.x + display.workArea.width - width - 18),
    y: Math.round(display.workArea.y + 18),
  };
  const x = Number.isFinite(config.window?.x) ? config.window.x : fallback.x;
  const y = Number.isFinite(config.window?.y) ? config.window.y : fallback.y;
  return { width, height, x, y };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    ...getWindowBounds(),
    minWidth: 360,
    minHeight: 420,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: true,
    title: 'GLM Quota Widget',
    icon: assetPath('app.png'),
    backgroundColor: '#00000000',
    backgroundMaterial: process.platform === 'win32' ? 'acrylic' : 'auto',
    roundedCorners: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('moved', () => {
    if (!mainWindow) return;
    const [x, y] = mainWindow.getPosition();
    config.window = { x, y };
    saveConfig(config);
  });
}

function showWindow() {
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.focus();
}

function toggleWindow() {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) mainWindow.hide();
  else showWindow();
}

function createTray() {
  tray = new Tray(trayImage());
  tray.setToolTip('GLM Quota Widget');
  tray.on('click', toggleWindow);
  tray.on('double-click', showWindow);
  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray) return;
  const accountItems = config.accounts.slice(0, 6).map((account) => {
    const state = quotaByAccount.get(account.id);
    const pct = state?.data?.session?.percentage;
    return {
      label: `${account.name}: ${Number.isFinite(pct) ? `${pct}%` : state?.loading ? '刷新中' : '—'}`,
      enabled: false,
    };
  });

  tray.setContextMenu(Menu.buildFromTemplate([
    ...accountItems,
    ...(accountItems.length ? [{ type: 'separator' }] : []),
    { label: '打开面板', click: showWindow },
    { label: '刷新全部', click: () => refreshAll(true) },
    { type: 'separator' },
    { label: '退出', click: () => { isQuitting = true; app.quit(); } },
  ]));

  const percentages = config.accounts
    .map((a) => quotaByAccount.get(a.id)?.data?.session?.percentage)
    .filter(Number.isFinite);
  if (percentages.length) {
    const min = Math.min(...percentages);
    tray.setToolTip(`GLM Quota · 最空闲账号已用 ${min}%`);
  }
}

function buildState() {
  return {
    config: publicConfig(config),
    quota: Object.fromEntries(quotaByAccount.entries()),
  };
}

function publishState() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('state:changed', buildState());
  }
  updateTrayMenu();
}

function severityFor(percent) {
  if (!Number.isFinite(percent)) return 'unknown';
  if (percent >= config.criticalAt) return 'critical';
  if (percent >= config.warnAt) return 'warn';
  return 'ok';
}

function maybeNotify(account, data) {
  const pct = data?.session?.percentage;
  if (!Number.isFinite(pct)) return;
  const severity = severityFor(pct);
  if (severity === 'ok' || severity === 'unknown') return;
  const reset = data.session?.nextResetTime || 0;
  const bucket = `${severity}:${reset}`;
  if (notifiedBucket.get(account.id) === bucket) return;
  notifiedBucket.set(account.id, bucket);

  if (Notification.isSupported()) {
    new Notification({
      title: `${account.name} · GLM 额度提醒`,
      body: `5 小时窗口已使用 ${pct}%${data.session?.remaining ? `，剩余 ${data.session.remaining.toLocaleString()} token` : ''}`,
    }).show();
  }
}

async function refreshAccount(account, userInitiated = false) {
  const previous = quotaByAccount.get(account.id) || {};
  quotaByAccount.set(account.id, { ...previous, loading: true, error: null });
  publishState();

  try {
    const apiKey = decryptSecret(account.secret);
    if (!apiKey) throw new Error('未配置 API Key');
    const data = await fetchAccountQuota(account, apiKey);
    quotaByAccount.set(account.id, { loading: false, error: null, data });
    maybeNotify(account, data);
  } catch (error) {
    quotaByAccount.set(account.id, {
      loading: false,
      data: previous.data || null,
      error: error?.message || '刷新失败',
      userInitiated,
    });
  }
  publishState();
}

async function refreshAll(userInitiated = false) {
  await Promise.all(config.accounts.map((account) => refreshAccount(account, userInitiated)));
}

function scheduleRefresh() {
  clearInterval(refreshTimer);
  const minutes = Math.max(1, Math.min(60, Number(config.refreshMinutes) || 5));
  refreshTimer = setInterval(() => refreshAll(false), minutes * 60 * 1000);
}

function setupIpc() {
  ipcMain.handle('state:get', () => buildState());
  ipcMain.handle('quota:refresh', async (_event, accountId) => {
    if (accountId) {
      const account = config.accounts.find((a) => a.id === accountId);
      if (account) await refreshAccount(account, true);
    } else {
      await refreshAll(true);
    }
    return buildState();
  });

  ipcMain.handle('account:save', async (_event, input) => {
    const name = String(input?.name || '').trim();
    if (!name) throw new Error('账号名称不能为空');
    const existing = input?.id ? config.accounts.find((a) => a.id === input.id) : null;
    const account = {
      id: existing?.id || crypto.randomUUID(),
      name,
      platform: input?.platform === 'zai' ? 'zai' : 'zhipu',
      endpoint: String(input?.endpoint || '').trim(),
      secret: existing?.secret || '',
    };
    if (String(input?.apiKey || '').trim()) {
      account.secret = encryptSecret(String(input.apiKey).trim());
    }
    if (!account.secret) throw new Error('API Key 不能为空');

    const idx = config.accounts.findIndex((a) => a.id === account.id);
    if (idx >= 0) config.accounts[idx] = account;
    else config.accounts.push(account);
    saveConfig(config);
    await refreshAccount(account, true);
    return buildState();
  });

  ipcMain.handle('account:delete', (_event, accountId) => {
    config.accounts = config.accounts.filter((a) => a.id !== accountId);
    quotaByAccount.delete(accountId);
    saveConfig(config);
    publishState();
    return buildState();
  });

  ipcMain.handle('settings:save', (_event, settings) => {
    config.refreshMinutes = Math.max(1, Math.min(60, Number(settings.refreshMinutes) || 5));
    config.warnAt = Math.max(1, Math.min(99, Number(settings.warnAt) || 80));
    config.criticalAt = Math.max(config.warnAt + 1, Math.min(100, Number(settings.criticalAt) || 90));
    config.launchAtLogin = Boolean(settings.launchAtLogin);
    config.theme = settings.theme === 'prism' ? 'prism' : 'clear';
    app.setLoginItemSettings({ openAtLogin: config.launchAtLogin });
    saveConfig(config);
    scheduleRefresh();
    publishState();
    return buildState();
  });

  ipcMain.handle('window:hide', () => mainWindow?.hide());
  ipcMain.handle('app:quit', () => {
    isQuitting = true;
    app.quit();
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.whenReady().then(async () => {
    if (process.platform === 'win32') app.setAppUserModelId('com.baisongt.glmquotawidget');
    config = loadConfig();
    setupIpc();
    createWindow();
    createTray();
    scheduleRefresh();
    showWindow();
    if (config.accounts.length) refreshAll(false);
  });
}

app.on('activate', showWindow);
app.on('window-all-closed', () => {});
app.on('before-quit', () => { isQuitting = true; });
