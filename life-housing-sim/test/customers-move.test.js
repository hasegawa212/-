// TDD：保存したお客様を、ほかの端末へ移す（ファイルで書き出し → 別の端末で読み込み）。サーバーには送らない
// 読み込みは今の一覧に足す（同じお客様は新しいほうを残す）。壊れたファイル・別のファイルは受け付けない
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const CU = require("../lib/customers");

let a = [];
a = CU.save(a, { id: "x1", name: "山田", staff: "佐藤", hash: "#s=a", now: "2026-10-01T00:00:00Z" });
a = CU.save(a, { id: "x2", name: "鈴木", staff: "", hash: "#s=b", now: "2026-10-10T00:00:00Z" });
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("書き出し：アプリ名・版・日時・お客様の一覧（条件はリンクの形のまま）", () => {
  const out = JSON.parse(CU.exportText(a, "2026-10-29T00:00:00Z"));
  assert.equal(out.app, "LIFE ROUTE");
  assert.equal(out.kind, "customers");
  assert.equal(out.v, 1);
  assert.equal(out.exported, "2026-10-29T00:00:00Z");
  assert.deepEqual(out.items.map((v) => v.name), ["山田", "鈴木"]);
});

test("読み込み：今の一覧に足す。同じお客様（id）は更新日の新しいほうを残す", () => {
  let b = [];
  b = CU.save(b, { id: "x1", name: "山田", staff: "佐藤", hash: "#s=old", now: "2026-09-01T00:00:00Z" });
  b = CU.save(b, { id: "y9", name: "田中", staff: "", hash: "#s=c", now: "2026-10-05T00:00:00Z" });
  const r = CU.importText(b, CU.exportText(a));
  assert.equal(r.ok, true);
  assert.equal(r.added, 1);
  assert.equal(r.updated, 1);
  assert.deepEqual(r.list.map((v) => v.name).sort(), ["山田", "田中", "鈴木"].sort());
  assert.equal(r.list.find((v) => v.id === "x1").hash, "#s=a");
  const older = CU.importText(a, JSON.stringify({ app: "LIFE ROUTE", kind: "customers", v: 1, items: [{ id: "x1", name: "山田", staff: "", hash: "#s=z", updated: "2020-01-01T00:00:00Z" }] }));
  assert.equal(older.list.find((v) => v.id === "x1").hash, "#s=a", "古いほうでは上書きしない");
});

test("壊れたファイル・別のファイルは受け付けない（一覧はそのまま）", () => {
  for (const t of ["", "abc", "{}", JSON.stringify({ app: "other", kind: "customers", v: 1, items: [] }), JSON.stringify([1, 2])]) {
    const r = CU.importText(a, t);
    assert.equal(r.ok, false, t);
    assert.equal(r.list, a);
    assert.ok(r.error);
  }
  const bad = CU.importText([], JSON.stringify({ app: "LIFE ROUTE", kind: "customers", v: 1, items: [{ id: "q", name: "", hash: "#s=a" }, { id: "r", name: "OK", hash: "javascript:alert(1)" }] }));
  assert.equal(bad.ok, true);
  assert.equal(bad.list.length, 0, "名前のないもの・条件の形でないものは捨てる");
});

test("画面：一覧に「ほかの端末へ移す」（書き出す・読み込む）。サーバーには送らない・名前が入る注意", () => {
  assert.match(html, /id="custExport"/);
  assert.match(html, /id="custImport"/);
  assert.match(html, /type="file"/);
  assert.match(html, /CU\.exportText\(/);
  assert.match(html, /CU\.importText\(/);
  assert.match(html, /ほかの端末へ移す/);
  assert.match(html, /お名前が入ります/);
});
