const els = {
  accounts: document.getElementById('accounts'),
  summary: document.getElementById('summary'),
  updatedAt: document.getElementById('updatedAt'),
  refreshBtn: document.getElementById('refreshBtn'),
  themeBtn: document.getElementById('themeBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  hideBtn: document.getElementById('hideBtn'),
  quitBtn: document.getElementById('quitBtn'),
  addBtn: document.getElementById('addBtn'),
  backdrop: document.getElementById('modalBackdrop'),
  accountModal: document.getElementById('accountModal'),
  settingsModal: document.getElementById('settingsModal'),
  accountForm: document.getElementById('accountForm'),
  settingsForm: document.getElementById('settingsForm'),
  accountModalTitle: document.getElementById('accountModalTitle'),
  accountId: document.getElementById('accountId'),
  accountName: document.getElementById('accountName'),
  platform: document.getElementById('platform'),
  endpoint: document.getElementById('endpoint'),
  apiKey: document.getElementById('apiKey'),
  refreshMinutes: document.getElementById('refreshMinutes'),
  warnAt: document.getElementById('warnAt'),
  criticalAt: document.getElementById('criticalAt'),
  launchAtLogin: document.getElementById('launchAtLogin'),
  themeOptions: Array.from(document.querySelectorAll('input[name="theme"]')),
  appShell: document.querySelector('.app-shell'),
  rippleLayer: document.querySelector('.ripple-layer'),
};

let state = { config: { accounts: [] }, quota: {} };

function normalizeTheme(value) {
  return value === 'prism' ? 'prism' : 'clear';
}

function applyTheme(value) {
  const theme = normalizeTheme(value);
  document.documentElement.dataset.theme = theme;
  if (els.themeBtn) {
    els.themeBtn.textContent = theme === 'prism' ? '✦' : '◐';
    els.themeBtn.title = theme === 'prism' ? '当前：棱彩 Prism · 点击切换' : '当前：澄明 Clear · 点击切换';
  }
}


const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const pointerState = {
  targetX: 0,
  targetY: 0,
  currentX: 0,
  currentY: 0,
  active: false,
  raf: 0,
};

function paintPointerInteraction() {
  pointerState.raf = 0;
  if (!els.appShell || reducedMotion.matches) return;

  const ease = pointerState.active ? 0.15 : 0.09;
  pointerState.currentX += (pointerState.targetX - pointerState.currentX) * ease;
  pointerState.currentY += (pointerState.targetY - pointerState.currentY) * ease;

  const rect = els.appShell.getBoundingClientRect();
  const safeWidth = Math.max(rect.width, 1);
  const safeHeight = Math.max(rect.height, 1);
  const nx = (pointerState.currentX / safeWidth - 0.5) * 2;
  const ny = (pointerState.currentY / safeHeight - 0.5) * 2;

  els.appShell.style.setProperty('--pointer-x', `${pointerState.currentX}px`);
  els.appShell.style.setProperty('--pointer-y', `${pointerState.currentY}px`);
  els.appShell.style.setProperty('--parallax-x', `${(nx * 8).toFixed(2)}px`);
  els.appShell.style.setProperty('--parallax-y', `${(ny * 8).toFixed(2)}px`);
  els.appShell.classList.toggle('is-pointer-active', pointerState.active);

  const distance = Math.abs(pointerState.targetX - pointerState.currentX)
    + Math.abs(pointerState.targetY - pointerState.currentY);
  if (pointerState.active || distance > 0.45) {
    pointerState.raf = requestAnimationFrame(paintPointerInteraction);
  }
}

function schedulePointerPaint() {
  if (!pointerState.raf) pointerState.raf = requestAnimationFrame(paintPointerInteraction);
}

function initializePointerInteraction() {
  if (!els.appShell) return;

  const rect = els.appShell.getBoundingClientRect();
  pointerState.targetX = pointerState.currentX = rect.width / 2;
  pointerState.targetY = pointerState.currentY = rect.height / 2;
  els.appShell.style.setProperty('--pointer-x', `${rect.width / 2}px`);
  els.appShell.style.setProperty('--pointer-y', `${rect.height / 2}px`);

  els.appShell.addEventListener('pointerenter', (event) => {
    if (reducedMotion.matches) return;
    const bounds = els.appShell.getBoundingClientRect();
    pointerState.targetX = event.clientX - bounds.left;
    pointerState.targetY = event.clientY - bounds.top;
    pointerState.active = true;
    schedulePointerPaint();
  });

  els.appShell.addEventListener('pointermove', (event) => {
    if (reducedMotion.matches || event.pointerType === 'touch') return;
    const bounds = els.appShell.getBoundingClientRect();
    pointerState.targetX = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left));
    pointerState.targetY = Math.max(0, Math.min(bounds.height, event.clientY - bounds.top));
    pointerState.active = true;
    schedulePointerPaint();
  });

  els.appShell.addEventListener('pointerleave', () => {
    if (reducedMotion.matches) return;
    pointerState.active = false;
    pointerState.targetX = els.appShell.clientWidth / 2;
    pointerState.targetY = els.appShell.clientHeight / 2;
    schedulePointerPaint();
  });

  els.appShell.addEventListener('pointerdown', (event) => {
    if (reducedMotion.matches || !els.rippleLayer) return;
    const bounds = els.appShell.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'liquid-ripple';
    ripple.style.left = `${event.clientX - bounds.left}px`;
    ripple.style.top = `${event.clientY - bounds.top}px`;

    while (els.rippleLayer.childElementCount >= 5) {
      els.rippleLayer.firstElementChild?.remove();
    }
    els.rippleLayer.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
  });

  reducedMotion.addEventListener?.('change', () => {
    if (reducedMotion.matches) {
      pointerState.active = false;
      if (pointerState.raf) cancelAnimationFrame(pointerState.raf);
      pointerState.raf = 0;
      els.appShell.classList.remove('is-pointer-active');
      els.appShell.style.removeProperty('--parallax-x');
      els.appShell.style.removeProperty('--parallax-y');
      els.rippleLayer?.replaceChildren();
    }
  });
}

initializePointerInteraction();

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
}

function severity(percent) {
  if (!Number.isFinite(percent)) return '';
  if (percent >= state.config.criticalAt) return 'critical';
  if (percent >= state.config.warnAt) return 'warn';
  return '';
}

function fmtReset(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const diff = ms - Date.now();
  if (diff <= 0) return '即将重置';
  const min = Math.floor(diff / 60000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}m 后重置`;
}

function metric(label, data, fallback = '—') {
  const pct = Number.isFinite(data?.percentage) ? data.percentage : null;
  const value = pct == null ? fallback : `${pct}%`;
  const cls = severity(pct);
  return `
    <div class="metric">
      <div class="metric-label">${label}</div>
      <div class="bar ${cls}"><i style="width:${pct == null ? 0 : pct}%"></i></div>
      <div class="metric-value">${value}</div>
    </div>
    ${data?.nextResetTime ? `<div class="reset">${fmtReset(data.nextResetTime)}</div>` : ''}
  `;
}

function toolsMetric(tools) {
  if (!tools) return metric('MCP / Web', null);
  const used = Number(tools.used || 0).toLocaleString();
  const total = Number(tools.total || 0).toLocaleString();
  const pct = Number.isFinite(tools.percentage) ? tools.percentage : null;
  const cls = severity(pct);
  return `
    <div class="metric">
      <div class="metric-label">MCP / Web</div>
      <div class="bar ${cls}"><i style="width:${pct ?? 0}%"></i></div>
      <div class="metric-value">${used}/${total}</div>
    </div>`;
}

function renderSummary(accounts) {
  const states = accounts.map((a) => state.quota[a.id]).filter(Boolean);
  const sessionPcts = states.map((s) => s?.data?.session?.percentage).filter(Number.isFinite);
  const best = sessionPcts.length ? Math.min(...sessionPcts) : null;
  const online = states.filter((s) => s?.data && !s?.error).length;
  els.summary.innerHTML = `
    <div class="summary-card"><span>账号</span><strong>${accounts.length}</strong></div>
    <div class="summary-card"><span>可用</span><strong>${online}</strong></div>
    <div class="summary-card"><span>最低 5h</span><strong>${best == null ? '—' : `${best}%`}</strong></div>`;
}

function render() {
  applyTheme(state.config.theme);
  const accounts = state.config.accounts || [];
  renderSummary(accounts);

  if (!accounts.length) {
    els.accounts.innerHTML = `
      <div class="empty">
        <div class="empty-content">
          <div class="empty-mark" aria-hidden="true"><span>G</span></div>
          <div class="empty-title">还没有 GLM 账号</div>
          <div class="empty-copy">添加 API Key 后，可同时查看多个账号的<br><strong>5 小时额度 · 7 天额度 · MCP / Web 用量</strong></div>
        </div>
      </div>`;
    els.updatedAt.textContent = '尚未配置账号';
    return;
  }

  const pcts = accounts.map((a) => state.quota[a.id]?.data?.session?.percentage).filter(Number.isFinite);
  const minPct = pcts.length ? Math.min(...pcts) : null;
  let latest = 0;

  els.accounts.innerHTML = accounts.map((account) => {
    const q = state.quota[account.id] || {};
    const d = q.data || {};
    latest = Math.max(latest, Number(d.fetchedAt || 0));
    const isBest = Number.isFinite(d.session?.percentage) && d.session.percentage === minPct;
    const platformLabel = account.platform === 'zai' ? 'Z.ai' : 'BigModel';
    return `
      <article class="account-card ${q.loading ? 'loading' : ''}">
        <div class="account-head">
          <div>
            <div class="account-title">${esc(account.name)}${isBest ? '<span class="best">当前最空闲</span>' : ''}</div>
            <div class="account-meta">${platformLabel}${d.plan ? ` · ${esc(d.plan)}` : ''}</div>
          </div>
          <div class="account-actions">
            <button class="small-btn" data-action="refresh" data-id="${account.id}">刷新</button>
            <button class="small-btn" data-action="edit" data-id="${account.id}">编辑</button>
            <button class="small-btn" data-action="delete" data-id="${account.id}">删除</button>
          </div>
        </div>
        ${metric('5 小时', d.session)}
        ${metric('7 天', d.weekly)}
        ${toolsMetric(d.tools)}
        ${q.error ? `<div class="error">${esc(q.error)}</div>` : ''}
      </article>`;
  }).join('');

  els.updatedAt.textContent = latest ? `最近刷新 ${new Date(latest).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '等待首次刷新';
}

function closeModal() {
  applyTheme(state.config.theme);
  els.backdrop.classList.add('hidden');
  els.accountModal.classList.add('hidden');
  els.settingsModal.classList.add('hidden');
}

function showAccountModal(account = null) {
  els.backdrop.classList.remove('hidden');
  els.accountModal.classList.remove('hidden');
  els.settingsModal.classList.add('hidden');
  els.accountModalTitle.textContent = account ? '编辑账号' : '添加账号';
  els.accountId.value = account?.id || '';
  els.accountName.value = account?.name || '';
  els.platform.value = account?.platform || 'zhipu';
  els.endpoint.value = account?.endpoint || '';
  els.apiKey.value = '';
  els.apiKey.placeholder = account?.hasKey ? '留空表示保留现有 Key' : '粘贴 GLM API Key';
  setTimeout(() => els.accountName.focus(), 0);
}

function showSettingsModal() {
  els.backdrop.classList.remove('hidden');
  els.accountModal.classList.add('hidden');
  els.settingsModal.classList.remove('hidden');
  els.refreshMinutes.value = state.config.refreshMinutes;
  els.warnAt.value = state.config.warnAt;
  els.criticalAt.value = state.config.criticalAt;
  els.launchAtLogin.checked = Boolean(state.config.launchAtLogin);
  const currentTheme = normalizeTheme(state.config.theme);
  els.themeOptions.forEach((option) => { option.checked = option.value === currentTheme; });
}

els.addBtn.addEventListener('click', () => showAccountModal());
els.settingsBtn.addEventListener('click', showSettingsModal);
els.refreshBtn.addEventListener('click', () => window.glmQuota.refresh());
els.themeBtn.addEventListener('click', async () => {
  const nextTheme = normalizeTheme(state.config.theme) === 'clear' ? 'prism' : 'clear';
  applyTheme(nextTheme);
  try {
    state = await window.glmQuota.saveSettings({
      refreshMinutes: state.config.refreshMinutes,
      warnAt: state.config.warnAt,
      criticalAt: state.config.criticalAt,
      launchAtLogin: Boolean(state.config.launchAtLogin),
      theme: nextTheme,
    });
    render();
  } catch (error) {
    applyTheme(state.config.theme);
    alert(error.message || String(error));
  }
});
els.themeOptions.forEach((option) => option.addEventListener('change', () => {
  if (option.checked) applyTheme(option.value);
}));
els.hideBtn.addEventListener('click', () => window.glmQuota.hide());
els.quitBtn.addEventListener('click', () => window.glmQuota.quit());

document.querySelectorAll('.close-modal').forEach((button) => button.addEventListener('click', closeModal));
els.backdrop.addEventListener('click', (event) => { if (event.target === els.backdrop) closeModal(); });

els.accounts.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const id = button.dataset.id;
  const action = button.dataset.action;
  const account = state.config.accounts.find((a) => a.id === id);
  if (action === 'refresh') await window.glmQuota.refresh(id);
  if (action === 'edit' && account) showAccountModal(account);
  if (action === 'delete' && account && confirm(`删除账号“${account.name}”？`)) await window.glmQuota.deleteAccount(id);
});

els.accountForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = els.accountForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  submit.textContent = '验证中…';
  try {
    state = await window.glmQuota.saveAccount({
      id: els.accountId.value || null,
      name: els.accountName.value,
      platform: els.platform.value,
      endpoint: els.endpoint.value,
      apiKey: els.apiKey.value,
    });
    render();
    closeModal();
  } catch (error) {
    alert(error.message || String(error));
  } finally {
    submit.disabled = false;
    submit.textContent = '保存并测试';
  }
});

els.settingsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    state = await window.glmQuota.saveSettings({
      refreshMinutes: els.refreshMinutes.value,
      warnAt: els.warnAt.value,
      criticalAt: els.criticalAt.value,
      launchAtLogin: els.launchAtLogin.checked,
      theme: document.querySelector('input[name="theme"]:checked')?.value || 'clear',
    });
    render();
    closeModal();
  } catch (error) {
    alert(error.message || String(error));
  }
});

window.glmQuota.onState((nextState) => {
  state = nextState;
  render();
});

window.glmQuota.getState().then((initial) => {
  state = initial;
  render();
});

setInterval(render, 60 * 1000);
