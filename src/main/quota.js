const DEFAULT_ENDPOINTS = {
  zhipu: 'https://open.bigmodel.cn',
  zai: 'https://api.z.ai',
};

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

function endpointFor(account) {
  const explicit = String(account?.endpoint || '').trim().replace(/\/$/, '');
  if (explicit) return explicit;
  return DEFAULT_ENDPOINTS[account?.platform] || DEFAULT_ENDPOINTS.zhipu;
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
  const quotaUrl = `${base}/api/monitor/usage/quota/limit`;
  const subscriptionUrl = `${base}/api/biz/subscription/list`;

  const [quotaPayload, subscriptionResult] = await Promise.all([
    fetchJson(quotaUrl, apiKey),
    fetchJson(subscriptionUrl, apiKey).catch(() => null),
  ]);

  const quota = parseQuotaResponse(quotaPayload);
  const subscription = subscriptionResult ? parseSubscriptionResponse(subscriptionResult) : { plan: null, nextRenewTime: null };

  return {
    ...quota,
    ...subscription,
    endpoint: base,
    fetchedAt: Date.now(),
  };
}

module.exports = {
  DEFAULT_ENDPOINTS,
  endpointFor,
  parseQuotaResponse,
  parseSubscriptionResponse,
  fetchAccountQuota,
};
