#!/usr/bin/env node
// Build & activate a *form-based* /meeting workflow on a live n8n instance,
// reusing the Google Sheets (and optionally Slack) credentials already present
// in the account. No Slack app config, slash command, or bot token required.
//
// The form asks: 会議名・議題 / 開催日 / 参加者 / 確認事項①②③(必須) / 担当・次アクション,
// then appends a row to the meeting_checklist sheet and (if a Slack credential
// is found) posts a summary to the meeting channel.
//
// Usage:
//   export N8N_BASE_URL="https://martial-arts-ghd.app.n8n.cloud"
//   export N8N_API_KEY="<n8n API key>"
//   node n8n-workflows/scripts/import-meeting-form.mjs        # create/update + activate
//   DRY_RUN=1 node n8n-workflows/scripts/import-meeting-form.mjs   # discover + plan only
//
// Optional env:
//   N8N_SHEET_ID         (default 1NMzF5QRt8dzf7lhNtaYh1Xbn5LdTQjSGExdsff5Hgi8)
//   MEETING_CHANNEL_ID   (default C0B9RAHM13K  = #martial-arts-meeting-checklist)
//
// Requires Node 18+ (global fetch).

const BASE = (process.env.N8N_BASE_URL || '').replace(/\/+$/, '');
const KEY = process.env.N8N_API_KEY || '';
const DRY_RUN = process.env.DRY_RUN === '1';
const SHEET_ID = process.env.N8N_SHEET_ID || '1NMzF5QRt8dzf7lhNtaYh1Xbn5LdTQjSGExdsff5Hgi8';
const CHANNEL_ID = process.env.MEETING_CHANNEL_ID || 'C0B9RAHM13K';
const FORM_PATH = 'meeting-checklist-form';
const WF_NAME = '会議チェックリスト（フォーム → Sheets + Slack）';

if (!BASE || !KEY) {
  console.error('ERROR: set N8N_BASE_URL and N8N_API_KEY environment variables.');
  process.exit(1);
}

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
  if (!res.ok) throw new Error(`${method} ${path} → HTTP ${res.status}: ${text.slice(0, 400)}`);
  return json;
}

async function listWorkflows() {
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

// Scan every workflow's nodes (present in list view) for reusable credentials.
// Prefer credentials taken from an *active* workflow — more likely to be valid.
function discoverCredentials(all) {
  const sorted = [...all].sort((a, b) => Number(b.active) - Number(a.active));
  let sheets = null;
  let slack = null; // { type, id, name }
  for (const w of sorted) {
    for (const n of w.nodes || []) {
      if (!sheets && n.type === 'n8n-nodes-base.googleSheets' && n.credentials?.googleSheetsOAuth2Api?.id) {
        sheets = { ...n.credentials.googleSheetsOAuth2Api, from: w.name };
      }
      if (!slack && n.type === 'n8n-nodes-base.slack') {
        if (n.credentials?.slackApi?.id) slack = { authType: 'accessToken', key: 'slackApi', ...n.credentials.slackApi, from: w.name };
        else if (n.credentials?.slackOAuth2Api?.id) slack = { authType: 'oAuth2', key: 'slackOAuth2Api', ...n.credentials.slackOAuth2Api, from: w.name };
      }
    }
    if (sheets && slack) break;
  }
  return { sheets, slack };
}

function f(label) { return `={{ $json[${JSON.stringify(label)}] }}`; }

function buildWorkflow({ sheets, slack }) {
  const nodes = [
    {
      parameters: {
        path: FORM_PATH,
        formTitle: '会議の確認事項',
        formDescription: '会議では必ず3つの質問・確認事項を記録します（①〜③は必須入力）。',
        formFields: {
          values: [
            { fieldLabel: '会議名・議題', fieldType: 'text', requiredField: true },
            { fieldLabel: '開催日', fieldType: 'date', requiredField: true },
            { fieldLabel: '参加者', fieldType: 'text', requiredField: false },
            { fieldLabel: '確認事項①', fieldType: 'textarea', requiredField: true },
            { fieldLabel: '確認事項②', fieldType: 'textarea', requiredField: true },
            { fieldLabel: '確認事項③', fieldType: 'textarea', requiredField: true },
            { fieldLabel: '担当・次アクション', fieldType: 'textarea', requiredField: false },
          ],
        },
        options: {},
      },
      id: 'form-trigger-001',
      name: '会議フォーム',
      type: 'n8n-nodes-base.formTrigger',
      typeVersion: 2.2,
      position: [240, 300],
      webhookId: FORM_PATH,
    },
    {
      parameters: {
        assignments: {
          assignments: [
            { id: 'r1', name: 'timestamp', value: '={{ $now.toISO() }}', type: 'string' },
            { id: 'r2', name: 'callback_id', value: 'meeting_form', type: 'string' },
            { id: 'r3', name: 'staff_slack_id', value: '', type: 'string' },
            { id: 'r4', name: 'staff_slack_name', value: '', type: 'string' },
            { id: 'r5', name: 'channel_id', value: '', type: 'string' },
            { id: 'r6', name: 'notify_channel', value: CHANNEL_ID, type: 'string' },
            { id: 'r7', name: 'meeting_title', value: f('会議名・議題'), type: 'string' },
            { id: 'r8', name: 'meeting_date', value: f('開催日'), type: 'string' },
            { id: 'r9', name: 'attendees', value: f('参加者'), type: 'string' },
            { id: 'r10', name: 'check_1', value: f('確認事項①'), type: 'string' },
            { id: 'r11', name: 'check_2', value: f('確認事項②'), type: 'string' },
            { id: 'r12', name: 'check_3', value: f('確認事項③'), type: 'string' },
            { id: 'r13', name: 'owner', value: f('担当・次アクション'), type: 'string' },
          ],
        },
        options: {},
      },
      id: 'build-row-001',
      name: '行を組み立て',
      type: 'n8n-nodes-base.set',
      typeVersion: 3.4,
      position: [480, 300],
    },
    {
      parameters: {
        operation: 'append',
        documentId: { __rl: true, value: SHEET_ID, mode: 'id' },
        sheetName: { __rl: true, value: 'meeting_checklist', mode: 'name' },
        columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: [], schema: [] },
        options: {},
      },
      id: 'sheets-append-001',
      name: 'meeting_checklist に追記',
      type: 'n8n-nodes-base.googleSheets',
      typeVersion: 4.5,
      position: [720, 300],
      credentials: { googleSheetsOAuth2Api: { id: sheets.id, name: sheets.name } },
    },
  ];

  const connections = {
    '会議フォーム': { main: [[{ node: '行を組み立て', type: 'main', index: 0 }]] },
    '行を組み立て': { main: [[{ node: 'meeting_checklist に追記', type: 'main', index: 0 }]] },
  };

  if (slack) {
    nodes.push({
      parameters: {
        authentication: slack.authType,
        select: 'channel',
        channelId: { __rl: true, value: CHANNEL_ID, mode: 'id' },
        text: "=✅ *会議の確認事項* ({{ $('行を組み立て').item.json.meeting_date }})\n*会議:* {{ $('行を組み立て').item.json.meeting_title }}  *参加者:* {{ $('行を組み立て').item.json.attendees }}\n① {{ $('行を組み立て').item.json.check_1 }}\n② {{ $('行を組み立て').item.json.check_2 }}\n③ {{ $('行を組み立て').item.json.check_3 }}",
        otherOptions: { mrkdwn: true },
      },
      id: 'slack-notify-001',
      name: 'Slack 通知',
      type: 'n8n-nodes-base.slack',
      typeVersion: 2.3,
      position: [960, 300],
      credentials: { [slack.key]: { id: slack.id, name: slack.name } },
    });
    connections['meeting_checklist に追記'] = { main: [[{ node: 'Slack 通知', type: 'main', index: 0 }]] };
  }

  return { name: WF_NAME, nodes, connections, settings: { executionOrder: 'v1' } };
}

// --- main --------------------------------------------------------------------
const mask = (s) => (s ? String(s).slice(0, 4) + '…' + String(s).slice(-4) : '(none)');
const all = await listWorkflows();
console.log(`Found ${all.length} workflow(s) on ${BASE}`);

const creds = discoverCredentials(all);
console.log('\nDiscovered credentials:');
console.log('  Google Sheets :', creds.sheets ? `${mask(creds.sheets.id)} (${creds.sheets.name}) ← from "${creds.sheets.from}"` : '(none)');
console.log('  Slack         :', creds.slack ? `${mask(creds.slack.id)} (${creds.slack.name}) [${creds.slack.key}] ← from "${creds.slack.from}"` : '(none — sheets-only)');
console.log('  Sheet target  :', SHEET_ID, '/ tab meeting_checklist');
console.log('  Notify channel:', CHANNEL_ID);

if (!creds.sheets) {
  console.error('\nERROR: no Google Sheets credential found in the account. Cannot build the form workflow.');
  process.exit(2);
}

const wf = buildWorkflow(creds);
const existing = all.find((w) =>
  w.name === WF_NAME ||
  (w.nodes || []).some((n) => n.type === 'n8n-nodes-base.formTrigger' && (n.webhookId === FORM_PATH || n.parameters?.path === FORM_PATH)));

const formUrl = `${BASE}/form/${FORM_PATH}`;

if (DRY_RUN) {
  console.log('\nDRY_RUN=1 — plan only, nothing was changed:');
  console.log(existing ? `  • PUT  /workflows/${existing.id}  (update) + activate` : '  • POST /workflows  (create) + activate');
  console.log('  • Nodes:', wf.nodes.map((n) => n.name).join(' → '));
  console.log('  • Form URL (after activate):', formUrl);
  process.exit(0);
}

let id;
if (existing) {
  await api('PUT', `/workflows/${existing.id}`, wf);
  id = existing.id;
  console.log(`\n✓ updated workflow ${id}`);
} else {
  const created = await api('POST', '/workflows', wf);
  id = created.id;
  console.log(`\n✓ created workflow ${id}`);
}

try {
  await api('POST', `/workflows/${id}/activate`);
  console.log('✓ activated');
} catch (e) {
  console.log('⚠️  could not activate automatically:', e.message);
  console.log('   Open the workflow in n8n and toggle Active manually.');
}

console.log('\nDone! 会議チェックリストのフォーム URL:');
console.log('  ' + formUrl);
console.log('\nこの URL を共有してください。確認事項①〜③は必須なので、3つ揃わないと送信できません。');
console.log('送信 → meeting_checklist シートに記録' + (creds.slack ? ' + Slack 通知' : '（Slack認証が無いためシート記録のみ）') + '。');
