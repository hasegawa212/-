// 反響面談コンソール — フロント（zero-dep, ES Modules）
import { FIELDS, GROUPS } from './fields.js';

const LS_ENDPOINT = 'eic.endpoint';
const LS_N8N = 'eic.n8n';
const LS_TOKEN = 'eic.token';
const LS_SHEET = 'eic.sheet';
const draftKey = (s) => `eic.draft.${s || 'default'}`;

// ── セッション / URL ───────────────────────────────────────────
const params = new URLSearchParams(location.search);
const SESSION = params.get('session') || '';
const VIEW_URL = location.href;

// ── DOM ヘルパ ─────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  for (const k of kids) n.append(k);
  return n;
};

// ── フォーム生成 ───────────────────────────────────────────────
const form = $('#hearing-form');
const inputs = {}; // key -> element

function buildForm() {
  for (const group of GROUPS) {
    const fieldset = el('fieldset', { className: 'section' });
    fieldset.append(el('legend', { textContent: group }));
    const grid = el('div', { className: 'grid' });

    for (const f of FIELDS.filter((x) => x.group === group)) {
      const wrap = el('label', { className: 'field' + (f.type === 'textarea' ? ' field-wide' : '') });
      wrap.append(el('span', { textContent: f.label + (f.system ? '（自動）' : '') }));

      let input;
      if (f.type === 'select') {
        input = el('select');
        for (const opt of f.options) {
          input.append(el('option', { value: opt, textContent: opt || '—' }));
        }
      } else if (f.type === 'textarea') {
        input = el('textarea', { rows: 2 });
      } else {
        input = el('input', { type: f.type === 'number' ? 'number' : f.type });
        if (f.type === 'number') { input.step = 'any'; input.inputMode = 'decimal'; }
      }
      input.dataset.key = f.key;
      input.dataset.col = f.col;
      if (f.placeholder) input.placeholder = f.placeholder;
      if (f.system) input.readOnly = true;
      input.addEventListener('input', saveDraft);

      wrap.append(input);
      if (f.help) wrap.append(el('small', { textContent: f.help }));
      inputs[f.key] = input;
      grid.append(wrap);
    }
    fieldset.append(grid);
    form.append(fieldset);
  }
}

// ── 値の取得 / 設定 ────────────────────────────────────────────
const getVal = (key) => (inputs[key] ? inputs[key].value.trim() : '');
const setVal = (key, v) => { if (inputs[key] != null) inputs[key].value = v ?? ''; };

function collectByKey() {
  const out = {};
  for (const f of FIELDS) out[f.key] = getVal(f.key);
  return out;
}

/** 保存ペイロード用に col→value へ変換（専用列が無い項目は mergeInto 列へ「【ラベル】値」で追記） */
function collectByCol() {
  const cells = {};
  const merges = {}; // col -> ["【ラベル】値", ...]
  for (const f of FIELDS) {
    const v = getVal(f.key);
    if (v === '') continue;
    if (f.col) {
      cells[f.col] = v;
    } else if (f.mergeInto) {
      (merges[f.mergeInto] ||= []).push(`【${f.label}】${v}`);
    }
  }
  // 直接入力の値（例：備考）を先頭に、続けて merge 項目を改行連結
  for (const col in merges) {
    cells[col] = [cells[col], ...merges[col]].filter(Boolean).join('\n');
  }
  return cells;
}

// ── 下書き自動保存 ─────────────────────────────────────────────
let draftTimer = null;
function saveDraft() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    localStorage.setItem(draftKey(SESSION), JSON.stringify(collectByKey()));
  }, 400);
}
function loadDraft() {
  const raw = localStorage.getItem(draftKey(SESSION));
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    for (const k in data) setVal(k, data[k]);
  } catch { /* ignore */ }
}

// ── サマリー生成（Slack 投稿フォーマット）─────────────────────
function buildSummary() {
  const v = (k) => getVal(k) || '-';
  const lines = [
    '━━━━━━━━━━━━━━━━━━━━━━━━',
    '  反響顧客ヒアリングサマリー',
    '  株式会社 Martial Arts',
    '━━━━━━━━━━━━━━━━━━━━━━━━',
    `記入日：${v('kinyubi')}　反響：${v('hankyobi')}（${v('hankyomei')}）`,
    `顧客名：${v('okyakusamamei')}（${v('furigana')}）　担当：${v('tantosha')}`,
    `連絡先：${v('renrakusaki')}　可：${v('renraku_ok')} / 不可：${v('renraku_ng')}`,
    '',
    '■ 現状',
    `・現住居：${v('genjukyo')}　家賃：${v('genyachin')}万円　住所：${v('genjusho')}`,
    `・きっかけ：${v('raiho_kikkake')}`,
    `・検討開始：${v('kento_jiki')}　内見経験：${v('naiken_keiken')}`,
    `・他社比較：${v('tasha_hikaku')}`,
    '',
    '■ 資金計画',
    `・希望価格：${v('yosan_min')}〜${v('yosan_max')}万円`,
    `・自己資金：${v('jikoshikin')}万円　預金：${v('yokin')}万円　月々：${v('tsukizuki')}万円`,
    `・ローン種別：${v('loan_shubetsu')}`,
    `・勤務先：${v('kinmusaki')}　入社：${v('nyusha_jiki')}　${v('koyo_keitai')}`,
    `・源泉A：${v('gensen_a')}万 / B：${v('gensen_b')}万　金融機関：${v('kinyukikan')}`,
    `・既存借入：${v('kizon_kariire')}　延滞：${v('entai')}　確申：${v('kakutei_shinkoku')}　資格：${v('kokka_shikaku')}`,
    '',
    '■ 希望エリア',
    `・エリア：${v('kibo_area')}（理由：${v('area_riyu')}）`,
    `・勤務地：${v('kinmuchi')}　通勤${v('kyoyo_tsukin')}分以内　徒歩${v('eki_toho')}分　手段：${v('tsukin_shudan')}`,
    '',
    '■ 物件条件',
    `・種別：${v('bukken_shubetsu')}　間取り：${v('madori')}　階数：${v('kaisu')}　駐車：${v('chushajo')}台`,
    `・絶対条件：${v('zettai_joken')}`,
    `・希望条件：${v('kibo_joken')}`,
    `・近隣施設：${v('kinrin_shogyo')}`,
    '',
    '■ ライフプラン・本音',
    `・家族構成：${v('kazoku')}　親居住：${v('oyago_chiiki')}`,
    `・動機：${v('douki')}`,
    `・将来像：${v('shorai_zo')}`,
    `・懸念：${v('kenen')}`,
    '',
    '■ 次アクション',
    `・内見候補①：${v('naiken_kanou1')} ／ ②：${v('naiken_kanou2')}`,
    `・★確定内見：${v('naiken_kakutei')}`,
    `・同行者：${v('doukousha')}`,
    `・備考：${v('biko')}`,
    '━━━━━━━━━━━━━━━━━━━━━━━━',
    '炎であれ、昨日を超えろ、爪痕を残せ。',
  ];
  return lines.join('\n');
}

// ── 保存（Apps Script へ POST）─────────────────────────────────
async function saveToSheet() {
  const endpoint = localStorage.getItem(LS_ENDPOINT) || '';
  if (!endpoint) {
    toast('先に「⚙︎ 設定」で Apps Script のURLを登録してください', true);
    openSettings();
    return;
  }
  if (!getVal('okyakusamamei')) {
    toast('お客様名は必須です', true);
    inputs.okyakusamamei.focus();
    return;
  }

  const payload = {
    action: 'saveHearing', // お客様ごとの「サマリー形式」シート生成＋「ヒアリング一覧」自動更新
    sheet: $('#sheet-select').value,
    cells: collectByCol(),
    viewUrl: SESSION ? `${location.origin}${location.pathname}?session=${encodeURIComponent(SESSION)}` : VIEW_URL,
    postSlack: $('#post-slack').checked,
    token: localStorage.getItem(LS_TOKEN) || '',
  };

  const saveBtn = $('#save-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = '保存中…';
  try {
    // ブラウザ→GASの直POSTは302でGETに化け書き込まれないため、
    // 同一オリジンの中継Function経由でサーバー側からGASへPOSTする。
    // 同一オリジンなので応答(JSON)も読めて、本物の成否を表示できる。
    const res = await fetch('/.netlify/functions/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: endpoint, payload }),
    });
    const data = await res.json();
    if (data.ok) {
      const what = data.created ? '新規作成' : '更新';
      toast(`保存しました：「${data.sheet || ''}」を${what}＋一覧に反映`);
    } else {
      toast('保存に失敗：' + (data.error || '不明なエラー'), true);
    }
  } catch (err) {
    toast('送信に失敗しました：' + err.message, true);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '💾 シートに保存';
  }
}

// ── n8n へサマリーを直送（option A）─────────────────────────────
async function sendToN8n() {
  const url = localStorage.getItem(LS_N8N) || '';
  if (!url) {
    toast('先に「⚙︎ 設定」で n8n Webhook URL を登録してください', true);
    openSettings();
    return;
  }
  const text = $('#summary-text').textContent || buildSummary();
  const btn = $('#send-n8n');
  btn.disabled = true;
  btn.textContent = '送信中…';
  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ text, sheet: $('#sheet-select').value }),
    });
    toast('n8nへ送信しました');
  } catch (err) {
    toast('n8n送信エラー：' + err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'n8nへ送信';
  }
}

// ── 設定モーダル ───────────────────────────────────────────────
function openSettings() {
  $('#endpoint-input').value = localStorage.getItem(LS_ENDPOINT) || '';
  $('#n8n-input').value = localStorage.getItem(LS_N8N) || '';
  $('#token-input').value = localStorage.getItem(LS_TOKEN) || '';
  $('#settings-modal').classList.remove('hidden');
}
function closeSettings() { $('#settings-modal').classList.add('hidden'); }
function saveSettings() {
  localStorage.setItem(LS_ENDPOINT, $('#endpoint-input').value.trim());
  localStorage.setItem(LS_N8N, $('#n8n-input').value.trim());
  localStorage.setItem(LS_TOKEN, $('#token-input').value.trim());
  closeSettings();
  toast('設定を保存しました');
}

// ── トースト ───────────────────────────────────────────────────
let toastTimer = null;
function toast(msg, isError = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 4000);
}

// ── 初期化 ─────────────────────────────────────────────────────
function init() {
  buildForm();

  // 記入日に今日を初期セット
  if (!getVal('kinyubi')) {
    setVal('kinyubi', new Date().toISOString().slice(0, 10));
  }
  // システム項目
  setVal('etsuran_url', VIEW_URL);

  loadDraft();

  // セッション表示
  $('#session-chip').textContent = SESSION ? `session: ${SESSION}` : 'session: なし';

  // 保存先の復元
  const savedSheet = localStorage.getItem(LS_SHEET);
  if (savedSheet) $('#sheet-select').value = savedSheet;
  $('#sheet-select').addEventListener('change', (e) => localStorage.setItem(LS_SHEET, e.target.value));

  // ボタン
  $('#save-btn').addEventListener('click', saveToSheet);
  $('#summary-btn').addEventListener('click', () => {
    $('#summary-text').textContent = buildSummary();
    $('#summary-panel').classList.remove('hidden');
  });
  $('#send-n8n').addEventListener('click', sendToN8n);
  $('#copy-summary').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('#summary-text').textContent); toast('コピーしました'); }
    catch { toast('コピーに失敗しました', true); }
  });
  $('#settings-btn').addEventListener('click', openSettings);
  $('#settings-close').addEventListener('click', closeSettings);
  $('#settings-save').addEventListener('click', saveSettings);
}

init();
