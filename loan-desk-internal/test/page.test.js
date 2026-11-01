// index.html の静的な検査（ファイル版と共有版のどちらでも動くための約束）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");

test("共有版では使えない confirm・alert・prompt・print を使わない", () => {
  assert.doesNotMatch(js, /\b(confirm|alert|prompt)\s*\(/);
  assert.doesNotMatch(js, /window\.print\s*\(/);
});

test("削除は2回押し（1回目で「本当に消す」に変わる）", () => {
  assert.match(js, /本当に消す/);
});

test("書き出しは画面にも内容を出す（共有版ではダウンロードが動かないため）", () => {
  assert.match(html, /id="expBox"/);
  assert.match(js, /showExport\(/);
  assert.equal((js.match(/showExport\(/g) || []).length >= 3, true, "記録とお客様の両方から呼ぶ");
});

test("表示設定（ダーク）に合わせる: :root[data-theme=\"dark\"] がある", () => {
  assert.match(html, /:root\[data-theme="dark"\]\{/);
});

test("保存はすべて persist() を通す（端末に直接書かない）", () => {
  assert.equal((js.match(/R\.store\(null, customers\)/g) || []).length, 1, "端末への保存は persist の中の1か所だけ");
  const body = js.slice(js.indexOf("function persist("));
  assert.ok(body.indexOf("R.store(null, customers)") < body.indexOf("R.diff("), "persist の中にある");
  assert.match(js, /R\.diff\(/);
});

test("共有データは claude.use で取り、なければファイル版として動く。閲覧だけの人はボタンを隠す", () => {
  assert.match(js, /claude\.use\("db"\)/);
  assert.match(js, /can\("data\.write"\)/);
  assert.match(js, /R\.viewState\(/);
  assert.match(html, /body\.ro #cSave/);
  assert.match(js, /onSnapshot\(/);
});

test("lib/sync.js を customers.js のあとに読む", () => {
  const order = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  assert.ok(order.indexOf("lib/sync.js") > order.indexOf("lib/customers.js"));
});

test("共有版の書き出しはページの保存機能（downloads）を使い、ファイル版だけふつうのダウンロードにする", () => {
  assert.match(js, /claude\.use\("downloads"\)/);
  assert.match(js, /dl\.save\(\{ filename, data: text \}\)/);
});
