import { pathToFileURL } from 'node:url';

// Read-only checks: never create/link a replacement site or change domain settings.
export async function preflight(env = process.env, fetcher = fetch) {
  const token = env.NETLIFY_AUTH_TOKEN;
  const siteId = env.NETLIFY_SITE_ID;
  if (!token || token.trim() !== token) throw new Error('Set NETLIFY_AUTH_TOKEN to a valid token without surrounding whitespace.');
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(siteId || '')) {
    throw new Error('Set NETLIFY_SITE_ID to the existing ma-appraisal Project ID (UUID). Do not create a new site.');
  }
  async function get(path, label) {
    let response;
    try {
      response = await fetcher(`https://api.netlify.com/api/v1${path}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        redirect: 'error', signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new Error(`${label}: network/timeout error. No deploy attempted.`);
    }
    if (!response.ok) {
      const advice = response.status === 401 ? 'Check token expiry/revocation.'
        : response.status === 403 ? 'Check token owner team access and SSO authorization.'
        : response.status === 404 ? 'Check existing Project ID and token access to its team; do not create another site.'
        : 'Check Netlify availability/rate limits before retrying.';
      // Do not log API bodies, headers, token values, or user profile data.
      throw new Error(`${label}: HTTP ${response.status}. ${advice}`);
    }
    try { return await response.json(); }
    catch { throw new Error(`${label}: invalid JSON response. No deploy attempted.`); }
  }
  await get('/user', 'Authentication');
  const site = await get(`/sites/${siteId}`, 'Site access');
  if (site.id !== siteId || site.name !== 'ma-appraisal' || site.ssl_url !== 'https://ma-appraisal.netlify.app') {
    throw new Error('Production target mismatch: expected existing ma-appraisal at https://ma-appraisal.netlify.app. Verify Project ID and domain settings before deploying.');
  }
  return { siteId: site.id, url: site.ssl_url };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await preflight();
    console.log(`Netlify preflight passed: ${result.url}`);
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}
