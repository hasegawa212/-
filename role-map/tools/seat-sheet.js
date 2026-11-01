#!/usr/bin/env node
// 立候補シートの別紙「席ごとのやること」：割り当て案（data/handoff.js）から、席ごとに引き受ける仕事と見るルールを A4 で出す
// 社員に配る紙なので、人の名前・代表に残す仕事・今手伝っている人は出さない
// node tools/seat-sheet.js > "../経営管理/05_人事・労務/評価・教育/立候補シート_別紙_席ごとのやること.html"
const RM = require("../lib/rolemap");
const D = require("../data/roles");
const PLAN = require("../data/handoff");
const SEATS = require("../data/seats");

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const GROUPS = [["E", "いまある役職・役割"], ["M", "経営"], ["S", "営業"], ["P", "仕入れ・業務"], ["K", "管理"]];

function buildSeatSheet() {
  const h = RM.handoff(D, PLAN, D.ceoId);
  const order = Object.keys(SEATS);
  const item = (t) => `<li><span class="nm">${esc(t.name)}</span><span class="fq">${esc(t.freq)}</span>${PLAN[t.id].note ? `<small>${esc(PLAN[t.id].note)}</small>` : ""}</li>`;
  const block = (seat) => {
    const v = h.bySeat[seat];
    return `<section class="seat"><div class="sh"><span class="id">${esc(seat)}</span><span class="sn">${esc(SEATS[seat])}</span></div>` +
      (v.move.length ? `<h4>引き受ける仕事</h4><ul>${v.move.map(item).join("")}</ul>` : "") +
      (v.rule.length ? `<h4 class="r">全員のルール：守られているかを見る</h4><ul>${v.rule.map(item).join("")}</ul>` : "") + "</section>";
  };
  const body = GROUPS.map(([p, label]) => {
    const seats = order.filter((s) => s.startsWith(p + "-") && h.bySeat[s]);
    return seats.length ? `<h2>${esc(label)}</h2><div class="grid">${seats.map(block).join("")}</div>` : "";
  }).join("");
  const stops = D.tasks.filter((t) => PLAN[t.id] && PLAN[t.id].kind === "stop");
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>立候補シート 別紙｜席ごとのやること</title>
<style>
  :root{--ink:#1b1b1f;--sub:#5b5b66;--line:#e3dfd4;--gold:#a8863a;--gold-soft:#f5efe1;--paper:#fff;--bg:#ecebe7}
  *{box-sizing:border-box}
  html,body{margin:0;background:var(--bg);color:var(--ink);font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo","IPAGothic",sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .doc{max-width:794px;margin:24px auto;background:var(--paper);padding:40px 48px 32px;box-shadow:0 2px 10px rgba(0,0,0,.12)}
  .head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid var(--gold);padding-bottom:10px;gap:12px}
  .head h1{margin:0;font-size:24px;letter-spacing:.08em}
  .head .co{font-size:11px;color:var(--sub);text-align:right;line-height:1.6}
  .lead{margin:12px 0 4px;font-size:12px;line-height:1.75;color:var(--sub)}
  .lead b{color:var(--ink)}
  h2{font-size:14px;margin:16px 0 8px;padding-left:10px;border-left:4px solid var(--gold);break-after:avoid}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .seat{border:1px solid var(--line);border-radius:8px;padding:9px 11px;break-inside:avoid}
  .sh{display:flex;gap:8px;align-items:baseline;margin-bottom:4px}
  .sh .id{font-weight:800;color:var(--gold);font-size:13px}
  .sh .sn{font-weight:700;font-size:13px}
  h4{margin:6px 0 2px;font-size:10.5px;color:var(--sub);font-weight:700}
  h4.r{color:#8a5a00}
  ul{margin:0;padding-left:16px}
  li{font-size:11.5px;line-height:1.5;margin:2px 0}
  li .fq{display:inline-block;margin-left:6px;font-size:9.5px;color:var(--sub);border:1px solid var(--line);border-radius:999px;padding:0 6px;vertical-align:1px}
  li small{display:block;color:var(--sub);font-size:10.5px}
  .stop{margin-top:14px;font-size:11.5px;color:var(--sub)}
  .foot{margin-top:16px;font-size:10px;color:var(--sub);border-top:1px solid var(--line);padding-top:8px;line-height:1.6}
  @media (max-width:640px){.doc{margin:0;padding:20px 16px}.grid{grid-template-columns:1fr}.head{flex-direction:column;align-items:flex-start}.head .co{text-align:left}}
  @page{size:A4;margin:12mm}
  @media print{html,body{background:#fff}.doc{margin:0;max-width:none;padding:0;box-shadow:none}}
</style>
</head>
<body>
<div class="doc">
  <div class="head"><h1>席ごとのやること</h1><div class="co">立候補シート 別紙（案）<br>株式会社 Martial Arts　${esc(D.asOf)} 時点</div></div>
  <p class="lead">Slack（${esc(D.period)}）で実際に動いている仕事をもとに、<b>それぞれの席が何を引き受けるか</b>をまとめました。立候補するときは、この仕事を自分がやる前提で書いてください。<br>
  「全員のルール」は全員が守るもので、その席の人は<b>守られているかを毎日・毎週見て、声をかける</b>役目です。頻度は今のペースです。</p>
  ${body}
  ${stops.length ? `<p class="stop">やめるもの：${stops.map((t) => esc(t.name) + (PLAN[t.id].note ? `（${esc(PLAN[t.id].note)}）` : "")).join("／")}</p>` : ""}
  <p class="foot">席の一覧と立候補のルールは「社内公募ポジション一覧と立候補制度」と「立候補シート」を見てください。この別紙は案で、席が決まったあと本人と話して調整します。社外秘。</p>
</div>
</body>
</html>
`;
}

module.exports = { buildSeatSheet };
if (require.main === module) process.stdout.write(buildSeatSheet());
