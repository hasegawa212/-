#!/usr/bin/env node
// Diagnostic: list workflows on a live n8n whose name (or, when available,
// nodes) look related to the Slack modal / meeting setup, so we can find the
// real handler/trigger names + IDs when auto-detection fails.
//
// Usage:
//   export N8N_BASE_URL="https://martial-arts-ghd.app.n8n.cloud"
//   export N8N_API_KEY="<n8n API key>"
//   node n8n-workflows/scripts/list-meeting-related.mjs
//
// Requires Node 18+ (global fetch).

const BASE = (process.env.N8N_BASE_URL || '').replace(/\/+$/, '');
const KEY = process.env.N8N_API_KEY || '';

if (!BASE || !KEY) {
  console.error('ERROR: set N8N_BASE_URL and N8N_API_KEY environment variables.');
  process.exit(1);
}

async function api(path) {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    headers: { 'X-N8N-API-KEY': KEY, 'accept': 'application/json' },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

const all = [];
let cursor;
do {
  const q = new URLSearchParams({ limit: '250' });
  if (cursor) q.set('cursor', cursor);
  const page = await api(`/workflows?${q.toString()}`);
  all.push(...(page.data || []));
  cursor = page.nextCursor;
} while (cursor);

console.log(`Total workflows: ${all.length}`);

const KEYWORDS = /slack|modal|meeting|daily|apo|feedback|submit|sheet|checklist|会議|モーダル|日報|フィードバック/i;
const hits = all.filter((w) => {
  if (KEYWORDS.test(w.name || '')) return true;
  // nodes may or may not be present in list view; check if they are.
  const nodesStr = w.nodes ? JSON.stringify(w.nodes) : '';
  return /slack-modal|callback_id|meeting/i.test(nodesStr);
});

console.log(`Related candidates: ${hits.length}`);
console.log('---------------------------------------------');
for (const w of hits) {
  console.log(`${w.id}\tactive=${w.active}\t${w.name}`);
}
console.log('---------------------------------------------');
console.log('nodes present in list view:', all[0] && Object.prototype.hasOwnProperty.call(all[0], 'nodes'));
