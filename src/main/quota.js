const PROVIDERS = {
  zhipu: { kind: 'glm', endpoint: 'https://open.bigmodel.cn' },
  zai: { kind: 'glm', endpoint: 'https://api.z.ai' },
  kimi: { kind: 'kimi', endpoint: 'https://api.moonshot.cn' },
  'kimi-intl': { kind: 'kimi', endpoint: 'https://api.moonshot.ai' },
  deepseek: { kind: 'deepseek', endpoint: 'https://api.deepseek.com' },
};

const PROVIDER_PLATFORMS = Object.keys(PROVIDERS);

const DEFAULT_ENDPOINTS = Object.fromEntries(
  Object.entries(PROVIDERS).map(([platform, provider]) => [platform, provider.endpoint]),
);

function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
}

function normalizeLimit(limit) {
  if (!limit || typeof limit !== 'object') return null;
  return {
    type: limit.type || '',
    unit: Number(limit.unit),
    number: Number(limit.number),
    total: Number(limit.usage ?? 0),
    used: Number(limit.currentValue ?? 0),
    remaining: Number(limit.remaining ?? 0),
    percentage: clampPercent(limit.percentage),
    nextResetTime: Number.isFinite(Number(limit.nextResetTime)) ? Number(limit.nextResetTime) : null,
    usageDetails: Array.isArray(limit.usageDetails) ? limit.usageDetails : [],
  };
}

function parseQuotaResponse(payload) {
  const limits = payload?.data?.limits;
  if (!Array.isArray(limits)) {
    throw new Error('Invalid quota response: data.limits is missing');
  }

  const normalized = limits.map(normalizeLimit).filter(Boolean);
  const session = normalized.find((item) => item.type === 'TOKENS_LIMIT' && item.unit === 3 && item.number === 5) || null;
  const weekly = normalized.find((item) => item.type === 'TOKENS_LIMIT' && item.unit === 6 && item.number === 7) || null;
  const tools = normalized.find((item) => item.type === 'TIME_LIMIT') || null;

  return { session, weekly, tools, rawLimits: normalized };
}

function parseSubscriptionResponse(payload) {
  const records = Array.isArray(payload?.data) ? payload.data : [];
  const active = records.find((item) => item?.inCurrentPeriod || item?.status === 'VALID') || records[0] || null;
  return {
    plan: active?.productName || null,
    nextRenewTime: active?.nextRenewTime || null,
  };
}

function providerFor(account) {
  return PROVIDERS[account?.platform] || PROVIDERS.zhipu;
}

function endpointFor(account) {
  const explicit = String(account?.endpoint || '').trim().replace(/\/$/, '');
  if (explicit) return explicit;
  return providerFor(account).endpoint;
}

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseKimiBalance(payload) {
  const data = payload?.data;
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid balance response: data is missing');
  }
  return {
    currency: 'CNY',
    available: toFiniteNumber(data.available_balance),
    cash: toFiniteNumber(data.cash_balance),
    voucher: toFiniteNumber(data.voucher_balance),
    isAvailable: toFiniteNumber(data.available_balance) != null
      ? toFiniteNumber(data.available_balance) > 0
      : null,
  };
}

function parseDeepseekBalance(payload) {
  const infos = payload?.balance_infos;
  if (!Array.isArray(infos) || !infos.length) {
    throw new Error('Invalid balance response: balance_infos is missing');
  }
  const info = infos.find((item) => item?.currency === 'CNY') || infos[0];
  return {
    currency: info?.currency || 'CNY',
    available: toFiniteNumber(info?.total_balance),
    cash: toFiniteNumber(info?.topped_up_balance),
    voucher: toFiniteNumber(info?.granted_balance),
    isAvailable: typeof payload?.is_available === 'boolean' ? payload.is_available : null,
  };
}

async function fetchJson(url, apiKey, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'User-Agent': 'GLM-Quota-Widget/0.1',
      },
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) {
      const error = new Error('API Key 无效或没有权限');
      error.code = 'AUTH';
      throw error;
    }
    if (!response.ok) {
      const error = new Error(`请求失败：HTTP ${response.status}`);
      error.code = 'HTTP';
      throw error;
    }
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('请求超时');
      timeoutError.code = 'TIMEOUT';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAccountQuota(account, apiKey) {
  const base = endpointFor(account);
  const provider = providerFor(account);

  if (provider.kind === 'kimi') {
    const payload = await fetchJson(`${base}/v1/users/me/balance`, apiKey);
    return {
      kind: 'balance',
      balance: parseKimiBalance(payload),
      plan: null,
      endpoint: base,
      fetchedAt: Date.now(),
    };
  }

  if (provider.kind === 'deepseek') {
    const payload = await fetchJson(`${base}/user/balance`, apiKey);
    return {
      kind: 'balance',
      balance: parseDeepseekBalance(payload),
      plan: null,
      endpoint: base,
      fetchedAt: Date.now(),
    };
  }

  const quotaUrl = `${base}/api/monitor/usage/quota/limit`;
  const subscriptionUrl = `${base}/api/biz/subscription/list`;

  const [quotaPayload, subscriptionResult] = await Promise.all([
    fetchJson(quotaUrl, apiKey),
    fetchJson(subscriptionUrl, apiKey).catch(() => null),
  ]);

  const quota = parseQuotaResponse(quotaPayload);
  const subscription = subscriptionResult ? parseSubscriptionResponse(subscriptionResult) : { plan: null, nextRenewTime: null };

  return {
    kind: 'glm',
    ...quota,
    ...subscription,
    endpoint: base,
    fetchedAt: Date.now(),
  };
}

module.exports = {
  PROVIDERS,
  PROVIDER_PLATFORMS,
  DEFAULT_ENDPOINTS,
  providerFor,
  endpointFor,
  parseQuotaResponse,
  parseSubscriptionResponse,
  parseKimiBalance,
  parseDeepseekBalance,
  fetchAccountQuota,
};
