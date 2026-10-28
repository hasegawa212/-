// TDD：いちばん上に「ライフパートナー」の絵（トップの看板）。見本の金額（総資産・目標など）が入らない部分だけを使う
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("トップの看板：画像があり、本文（ヘッダー・トップページ）より前に置く", () => {
  assert.ok(fs.existsSync(path.join(root, "img/top-hero.jpg")));
  const i = html.indexOf('id="tophero"');
  assert.ok(i > 0 && i < html.indexOf('<section id="home">') && i < html.indexOf("<header>"));
  assert.match(html, /src="img\/top-hero\.jpg"/);
  assert.match(html, /id="tophero"><div class="hwrap" id="hwrap"><img src="img\/top-hero\.jpg" alt="[^"]*GOAL[^"]*"/);
});

test("看板は説明・資料・提案書・画面共有・印刷では出さない（お客様に見せる画面を邪魔しない）", () => {
  for (const c of ["present", "deck-view", "proposal-view"]) assert.match(html, new RegExp(`body\\.${c} #tophero`));
  assert.match(html, /@media print[^}]*#tophero/);
});

test("dist に画像を埋め込む", () => {
  assert.match(fs.readFileSync(path.join(root, "tools/bundle.js"), "utf8"), /img\/top-hero\.jpg/);
});

test("主人公の横の相棒はオリジナル（おうちの形のキャラ）。元の絵（SVG）を img/buddy.svg に残す", () => {
  const svg = fs.readFileSync(path.join(root, "img/buddy.svg"), "utf8");
  assert.match(svg, /<svg/);
  assert.match(svg, /roof/, "屋根のあるおうちの形");
  assert.match(html, /おうちの相棒/);
});

test("看板の絵の中のエリア（NISA・不動産・保険・ライフプラン・現預金・海外投資）と左のメニューが押せる", () => {
  const m = html.match(/const HOTSPOTS = \[([\s\S]*?)\n  \];/);
  assert.ok(m, "HOTSPOTS がある");
  for (const a of ["NISAエリア", "不動産エリア", "保険エリア", "ライフプランエリア", "現預金エリア", "海外投資エリア", "マイページ", "不動産", "生命保険", "ライフプラン", "シミュレーション"]) assert.match(m[1], new RegExp(`"${a}"`), a);
  for (const k of ["nisa", "home", "ins", "plan", "cash"]) assert.match(m[1], new RegExp(`area: "${k}"`), k);
  assert.match(html, /class="hot\$\{/);
  assert.match(html, /aria-label=/);
});
