const test = require('node:test');
const assert = require('node:assert/strict');
const { parseQuotaResponse, parseSubscriptionResponse, endpointFor } = require('../src/main/quota');

test('parses session, weekly and time limits', () => {
  const parsed = parseQuotaResponse({
    data: {
      limits: [
        { type: 'TOKENS_LIMIT', unit: 3, number: 5, usage: 1000, currentValue: 250, remaining: 750, percentage: 25, nextResetTime: 123 },
        { type: 'TOKENS_LIMIT', unit: 6, number: 7, usage: 7000, currentValue: 3500, remaining: 3500, percentage: 50, nextResetTime: 456 },
        { type: 'TIME_LIMIT', unit: 5, number: 1, usage: 100, currentValue: 10, remaining: 90, percentage: 10 },
      ],
    },
  });
  assert.equal(parsed.session.percentage, 25);
  assert.equal(parsed.weekly.percentage, 50);
  assert.equal(parsed.tools.used, 10);
});

test('subscription picks active plan', () => {
  const parsed = parseSubscriptionResponse({ data: [{ productName: 'GLM Coding Max', status: 'VALID', nextRenewTime: '2026-10-01' }] });
  assert.equal(parsed.plan, 'GLM Coding Max');
  assert.equal(parsed.nextRenewTime, '2026-10-01');
});

test('chooses platform endpoint and strips trailing slash', () => {
  assert.equal(endpointFor({ platform: 'zhipu' }), 'https://open.bigmodel.cn');
  assert.equal(endpointFor({ platform: 'zai' }), 'https://api.z.ai');
  assert.equal(endpointFor({ endpoint: 'https://example.com/' }), 'https://example.com');
});
