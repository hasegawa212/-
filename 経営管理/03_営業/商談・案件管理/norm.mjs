import fs from 'node:fs';

const RAW = fs.readFileSync('raw.txt', 'utf8').trim().split('\n');

// 表記ゆれ統合（同一人物）
const NAME_FIX = {
  '綱川大吾': '綱川大悟', '吉村拓也': '吉村拓哉', '加來嵩時': '加来嵩時',
  '岡潤祐': '岡潤佑', '渡邉裕也': '渡邊裕也', '小池雅弘': '小池雅広',
  '宮崎定規': '宮﨑定規',
};
// 担当者の役職ゆれを氏名に寄せる
const OWNER_FIX = (s) => {
  if (!s) return '';
  let t = s.replace(/係長代理|課長|部長|代理|CMO|様|\s/g, '').replace(/^者：/, '');
  const map = { '': '', '-': '', '退職者': '退職者' };
  return map[t] ?? t;
};
const clean = (s) => (s || '')
  .replace(/:[a-z0-9_+-]+:/gi, '')          // Slack絵文字コード
  .replace(/[:：]?(備考|日時)[:：]/g, '')     // ラベル混入
  .replace(/^\s*[-ー]\s*$/, '')
  .replace(/　/g, ' ')
  .trim();

// 予定欄に流れ込んだ定型あいさつ（日付・時刻を含まないもの）は予定ではないので落とす
const PLEASANTRY = /^(?:よろしくお願い|本承認後|承認後|お持物|お客様ご日程|議事録|今後の日程|別途|確認|審査次第|またカードローン|持ち物|次回の決済|をお伝え)/;
const cleanPlan = (s) => {
  const t = clean(s);
  if (!t) return '';
  if (/[0-9\uFF10-\uFF19]/.test(t)) return t;   // 日付・時刻を含むものは予定として残す
  return PLEASANTRY.test(t) ? '' : t;
};

// ステージ定義（進行順）
const STAGE = {
  '事前承認': 1, '契約完了': 2, '専属専任媒介契約完了': 2, '私募債契約決定': 2,
  '本承認': 3, '金消契約完了': 4, '金消完了': 4,
  '決済完了': 5, '完工報告': 5, '案件完了': 6,
};
const STAGE_LABEL = ['', '事前承認', '契約完了', '本承認', '金消契約', '決済完了', '案件完了'];

const rows = RAW.map((line) => {
  const f = line.split('|');
  const g = (i) => clean(f[i]);
  const name = NAME_FIX[g(3)] || g(3);
  return {
    no: Number(f[0]),
    date: g(1).replace(/\//g, '-'),
    kind: g(2),
    customer: name,
    rawCustomer: g(3),
    seller: g(4), broker: g(5), bank: g(6),
    owner: OWNER_FIX(g(7)),
    join1: OWNER_FIX(g(8)), join2: OWNER_FIX(g(9)),
    next: cleanPlan(g(10)), nextAt: cleanPlan(g(11)),
    reporter: clean(g(12)).replace(/\s/g, ''),
    note: g(13),
    stage: STAGE[g(2)] ?? 0,
  };
}).sort((a, b) => a.date.localeCompare(b.date) || a.no - b.no);

// 顧客ごとに案件（ディール）へ分割：終端ステージ到達後の新報告は次の案件
const deals = [];
const open = new Map();
for (const r of rows) {
  let d = open.get(r.customer);
  if (!d || d.closed) {
    d = { customer: r.customer, seq: (deals.filter(x => x.customer === r.customer).length + 1), reports: [], closed: false };
    deals.push(d); open.set(r.customer, d);
  }
  d.reports.push(r);
  if (r.stage >= 5) d.closed = true;   // 決済完了 / 案件完了 / 完工報告
}

const DATA_END = rows.at(-1).date;                      // 2026-08-21
const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

for (const d of deals) {
  const rs = d.reports;
  d.id = `${d.customer}#${d.seq}`;
  d.first = rs[0].date;
  d.last = rs.at(-1).date;
  d.maxStage = Math.max(...rs.map(r => r.stage));
  d.stageLabel = STAGE_LABEL[d.maxStage] || rs.at(-1).kind;
  d.owner = [...rs].reverse().find(r => r.owner)?.owner || '';
  d.bank = [...rs].reverse().find(r => r.bank)?.bank || '';
  d.seller = [...rs].reverse().find(r => r.seller)?.seller || '';
  d.broker = [...rs].reverse().find(r => r.broker)?.broker || '';
  d.next = [...rs].reverse().find(r => r.next)?.next || '';
  d.nextAt = [...rs].reverse().find(r => r.nextAt)?.nextAt || '';
  d.reportCount = rs.length;
  d.leadDays = days(d.first, d.last);
  d.idleDays = days(d.last, DATA_END);
  d.done = d.maxStage >= 5;
  d.trail = rs.map(r => ({ date: r.date, kind: r.kind, stage: r.stage }));
};

fs.writeFileSync('deals.json', JSON.stringify({ rows, deals, DATA_END }, null, 0));
console.log('reports', rows.length, 'deals', deals.length, 'closed', deals.filter(d => d.done).length, 'DATA_END', DATA_END);
console.log('顧客数', new Set(rows.map(r => r.customer)).size);
console.log('複数案件:', deals.filter(d => d.seq > 1).map(d => d.id).join(', '));
console.log('ステージ分布:', JSON.stringify(deals.reduce((a, d) => (a[d.stageLabel] = (a[d.stageLabel] || 0) + 1, a), {})));
console.log('担当:', JSON.stringify(deals.reduce((a, d) => (a[d.owner || '(不明)'] = (a[d.owner || '(不明)'] || 0) + 1, a), {})));
