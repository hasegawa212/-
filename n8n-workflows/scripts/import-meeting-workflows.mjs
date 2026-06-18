#!/usr/bin/env node
// Import & activate the /meeting workflows into a live n8n instance via the
// public REST API, auto-discovering real credential IDs / Sheet ID / Slack bot
// token from the existing /daily /apo /feedback workflows so you never have to
// hand-edit the placeholders.
//
// Why this exists: the Claude Code web environment cannot reach the n8n host
// (egress allowlist), so this step has to run from a machine that can.
//
// Usage:
//   export N8N_BASE_URL="https://martial-arts-ghd.app.n8n.cloud"
//   export N8N_API_KEY="<n8n API key from Settings → n8n API>"
//   node n8n-workflows/scripts/import-meeting-workflows.mjs
//
// Optional:
//   DRY_RUN=1   # discover + print plan, but do not create/update/activate
//
// Requires Node 18+ (global fetch). Run from the repo root.
//
// Idempotent: re-running updates the submit-handler in place and reuses the
// existing /meeting trigger if it is already present.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const WF_DIR = join(HERE, '..');

const BASE = (process.env.N8N_BASE_URL || '').replace(/\/+$/, '');
const KEY = process.env.N8N_API_KEY || '';
const DRY_RUN = process.env.DRY_RUN === '1';

if (!BASE || !KEY) {
  console.error('ERROR: set N8N_BASE_URL and N8N_API_KEY environment variables.');
  process.exit(1);
}

const TRIGGER_FILE = 'slack-modal-trigger-meeting.json';
const HANDLER_FILE = 'slack-modal-submit-handler.json';

// --- tiny REST helpers (public API: /api/v1, header X-N8N-API-KEY) -----------
async function api(method, path, body) {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    method,
    headers: {
      'X-N8N-API-KEY': KEY,
      'accept': 'application/json',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!res.ok) {
    throw new Error(`${method} ${path} → HTTP ${res.status}: ${text.slice(0, 400)}`);
  }
  return json;
}

async function listWorkflows() {
  // Public API paginates; one page (limit 250) is plenty for this account.
  const out = [];
  let cursor;
  do {
    const q = new URLSearchParams({ limit: '250' });
    if (cursor) q.set('cursor', cursor);
    const page = await api('GET', `/workflows?${q.toString()}`);
    out.push(...(page.data || []));
    cursor = page.nextCursor;
  } while (cursor);
  return out;
}

// n8n create/update only accept these top-level fields.
function slim(wf) {
  return {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: wf.settings || { executionOrder: 'v1' },
  };
}

function findNode(wf, predicate) {
  return (wf.nodes || []).find(predicate);
}

// --- discovery ---------------------------------------------------------------
function discoverBotToken(triggerWf) {
  // The views.open HTTP node carries "Authorization: Bearer xoxb-..."
  const http = findNode(triggerWf, (n) =>
    n.type === 'n8n-nodes-base.httpRequest' &&
    String(n.parameters?.url || '').includes('views.open'));
  const auth = http?.parameters?.headerParameters?.parameters
    ?.find((p) => String(p.name).toLowerCase() === 'authorization');
  return auth?.value || null; // full "Bearer xoxb-..." string
}

function discoverFromHandler(handlerWf) {
  const sheetsNode = findNode(handlerWf, (n) => n.type === 'n8n-nodes-base.googleSheets');
  const slackNode = findNode(handlerWf, (n) => n.type === 'n8n-nodes-base.slack');
  return {
    sheetId: sheetsNode?.parameters?.documentId?.value || null,
    sheetsCredId: sheetsNode?.credentials?.googleSheetsOAuth2Api?.id || null,
    sheetsCredName: sheetsNode?.credentials?.googleSheetsOAuth2Api?.name || 'Google Sheets',
    slackCredId: slackNode?.credentials?.slackOAuth2Api?.id || null,
    slackCredName: slackNode?.credentials?.slackOAuth2Api?.name || 'Slack',
  };
}

function applyReplacements(jsonText, map) {
  let out = jsonText;
  for (const [needle, value] of Object.entries(map)) {
    if (value == null) continue;
    out = out.split(needle).join(value);
  }
  return out;
}

// --- main --------------------------------------------------------------------
const log = (...a) => console.log(...a);
const mask = (s) => (s ? s.slice(0, 6) + '…' + s.slice(-4) : '(none)');

const all = await listWorkflows();
log(`Found ${all.length} workflow(s) on ${BASE}`);

// Locate the existing pieces we copy real values from.
const existingTrigger = all.find((w) =>
  /trigger-(feedback|daily|apo)/.test(JSON.stringify(w.nodes || []).toLowerCase()) ||
  /open .*modal/i.test(w.name || '')) || null;

const handlerSummary = all.find((w) =>
  /modal submit|submit.*sheets|callback_id/i.test(w.name || '') ||
  (w.nodes || []).some((n) => n.webhookId === 'slack-modal-submit'));

if (!handlerSummary) {
  console.error('ERROR: could not find the existing "Slack Modal Submit" handler workflow.');
  console.error('Import slack-modal-submit-handler.json once via the UI first, or check the API key has access.');
  process.exit(2);
}

// Need full bodies (list view may omit node detail on some versions).
const handlerWf = await api('GET', `/workflows/${handlerSummary.id}`);
const triggerWf = existingTrigger ? await api('GET', `/workflows/${existingTrigger.id}`) : null;

const botToken = triggerWf ? discoverBotToken(triggerWf) : null;
const disc = discoverFromHandler(handlerWf);

log('\nDiscovered values:');
log('  Slack bot token   :', mask(botToken));
log('  Google Sheet ID   :', disc.sheetId || '(none)');
log('  Sheets credential :', disc.sheetsCredId ? `${disc.sheetsCredId} (${disc.sheetsCredName})` : '(none)');
log('  Slack credential  :', disc.slackCredId ? `${disc.slackCredId} (${disc.slackCredName})` : '(none)');

if (!botToken) log('  ⚠️  No bot token found — set it manually in the trigger after import.');
if (!disc.sheetId || !disc.sheetsCredId || !disc.slackCredId) {
  log('  ⚠️  Some handler values missing — verify the existing handler is fully configured.');
}

// Build the meeting trigger body from the repo file.
const triggerText = await readFile(join(WF_DIR, TRIGGER_FILE), 'utf8');
const triggerBody = slim(JSON.parse(applyReplacements(triggerText, {
  REPLACE_WITH_SLACK_BOT_TOKEN: botToken,
})));

// Build the merged handler body: repo structure (adds meeting_check) + real creds.
const handlerText = await readFile(join(WF_DIR, HANDLER_FILE), 'utf8');
const handlerBody = slim(JSON.parse(applyReplacements(handlerText, {
  REPLACE_WITH_GOOGLE_SHEET_ID: disc.sheetId,
  REPLACE_WITH_GOOGLE_SHEETS_CREDENTIAL_ID: disc.sheetsCredId,
  REPLACE_WITH_SLACK_CREDENTIAL_ID: disc.slackCredId,
})));
// Preserve the handler's existing name so we update the same logical workflow.
handlerBody.name = handlerWf.name;

if (DRY_RUN) {
  log('\nDRY_RUN=1 — plan only, nothing was changed:');
  log(`  • PUT  /workflows/${handlerSummary.id}  (update handler, +meeting_check branch)`);
  const existingMeeting = all.find((w) => (w.nodes || []).some((n) => n.webhookId === 'slack-modal-trigger-meeting') || /meeting/i.test(w.name || ''));
  log(existingMeeting
    ? `  • PUT  /workflows/${existingMeeting.id}  (update existing /meeting trigger) + activate`
    : '  • POST /workflows  (create /meeting trigger) + activate');
  process.exit(0);
}

// 1) Update the submit-handler in place.
log(`\nUpdating handler workflow ${handlerSummary.id} …`);
await api('PUT', `/workflows/${handlerSummary.id}`, handlerBody);
log('  ✓ handler updated (meeting_check branch + meeting_checklist sheet)');

// 2) Create or update the /meeting trigger, then activate it.
const existingMeeting = all.find((w) =>
  (w.nodes || []).some((n) => n.webhookId === 'slack-modal-trigger-meeting') ||
  /meeting/i.test(w.name || ''));

let meetingId;
if (existingMeeting) {
  log(`Updating existing /meeting trigger ${existingMeeting.id} …`);
  await api('PUT', `/workflows/${existingMeeting.id}`, triggerBody);
  meetingId = existingMeeting.id;
  log('  ✓ trigger updated');
} else {
  log('Creating /meeting trigger …');
  const created = await api('POST', '/workflows', triggerBody);
  meetingId = created.id;
  log(`  ✓ trigger created (id ${meetingId})`);
}

log(`Activating /meeting trigger ${meetingId} …`);
await api('POST', `/workflows/${meetingId}/activate`);
log('  ✓ trigger active');

// Make sure the handler stays active too (PUT may reset the flag on some versions).
try {
  await api('POST', `/workflows/${handlerSummary.id}/activate`);
  log('  ✓ handler active');
} catch (e) {
  log('  ⚠️  could not re-activate handler automatically:', e.message);
}

log('\nDone. Remaining manual step: register the /meeting slash command in your');
log('Slack App (Request URL …/webhook/slack-modal-trigger-meeting). See SETUP.md.');
