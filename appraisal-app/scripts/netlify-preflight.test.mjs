import { test } from 'vitest';
import assert from 'node:assert/strict';
import { preflight } from './netlify-preflight.mjs';
const siteId = 'e6431469-8bb5-4d42-8db1-c370eebd5d04';
const env = { NETLIFY_AUTH_TOKEN: 'private-token', NETLIFY_SITE_ID: siteId };
const site = { id: siteId, name: 'ma-appraisal', ssl_url: 'https://ma-appraisal.netlify.app' };
const mock = (...responses) => async () => { const [status, body] = responses.shift(); return new Response(JSON.stringify(body), { status }); };
test('checks identity then exact site, without returning credentials', async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push(url);
    assert.equal(options.headers.Authorization, 'Bearer private-token');
    assert.equal(options.redirect, 'error');
    return new Response(JSON.stringify(calls.length === 1 ? { id: 'user' } : site));
  };
  const result = await preflight(env, fetcher);
  assert.deepEqual(calls, ['https://api.netlify.com/api/v1/user', `https://api.netlify.com/api/v1/sites/${siteId}`]);
  assert.equal(result.url, site.ssl_url);
  assert.ok(!JSON.stringify(result).includes(env.NETLIFY_AUTH_TOKEN));
});
for (const [name, input] of [['missing token', { ...env, NETLIFY_AUTH_TOKEN: '' }], ['missing site', { ...env, NETLIFY_SITE_ID: '' }], ['invalid site', { ...env, NETLIFY_SITE_ID: '../other' }]]) {
  test(name + ' fails before network', async () => {
    await assert.rejects(preflight(input, () => assert.fail('must not fetch')));
  });
}
for (const status of [401, 403, 404, 429, 500]) {
  test(`site HTTP ${status} stops deploy with actionable status, not response secrets`, async () => {
    await assert.rejects(preflight(env, mock([200, { id: 'user' }], [status, { message: 'private-token' }])), e => e.message.includes(String(status)) && !e.message.includes('private-token'));
  });
}
test('invalid token stops before site lookup', async () => {
  await assert.rejects(preflight(env, mock([401, {}])), /Authentication.*401/);
});
for (const change of [{ id: 'other' }, { name: 'other' }, { ssl_url: 'https://other.netlify.app' }, { ssl_url: 'http://ma-appraisal.netlify.app' }]) {
  test('refuses mismatched production target ' + JSON.stringify(change), async () => {
    await assert.rejects(preflight(env, mock([200, {}], [200, { ...site, ...change }])), /target/);
  });
}
test('transport failures do not echo errors that might contain credentials', async () => {
  await assert.rejects(preflight(env, async () => { throw new Error('private-token'); }), e => /network/.test(e.message) && !e.message.includes('private-token'));
});
