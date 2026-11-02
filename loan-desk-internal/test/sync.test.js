const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../lib/customers.js");
const S = require("../lib/sync.js");

const mk = (ini, staff, input, at) => C.save([], { initials: ini, staff, input }, at).item;

test("docId: 日本語や | を含む id を、共有データで使える c+16進8桁にする。同じ id はいつも同じ", () => {
  const a = S.docId("斎藤|上田|2026-10-01");
  assert.match(a, /^c[0-9a-f]{8}$/);
  assert.equal(a, S.docId("斎藤|上田|2026-10-01"));
  assert.notEqual(a, S.docId("斎藤|上田|2026-10-02"));
  assert.notEqual(S.docId("佐藤|坂本|2026-03-29"), S.docId("佐藤|坂本|2025-09-30"));
});

test("diff: 新しい行・変わった行は保存、同じ行は何もしない、なくなった行は消す", () => {
  const a = mk("斎藤", "上田", { age: 27 }, "a"), b = mk("ST", "犬塚", { age: 30 }, "b");
  const first = S.diff(new Map(), [a, b]);
  assert.equal(first.sets.length, 2); assert.equal(first.deletes.length, 0);
  assert.equal(S.diff(first.next, [a, b]).sets.length, 0, "変わっていなければ書かない");
  const a2 = mk("斎藤", "上田", { age: 28 }, "c");
  const second = S.diff(first.next, [a2]);
  assert.deepEqual(second.sets.map((x) => x.docId), [S.docId(a2.id)]);
  assert.deepEqual(second.deletes, [S.docId(b.id)]);
  assert.ok(!second.next.has(S.docId(b.id)));
});

test("diff: 渡した同期の記録（Map）は書き換えない", () => {
  const a = mk("斎藤", "上田", { age: 27 }, "a");
  const synced = new Map();
  S.diff(synced, [a]);
  assert.equal(synced.size, 0);
});

test("fromSnapshot: 共有データの行を customers.js と同じきまりで整える（余計な項目・名前は落とす）", () => {
  const good = mk("斎藤", "上田", { age: 27, history: [{ lender: "JA", stage: "pre", result: "reject", month: "2026-10", reason: "borrower_single" }] }, "2026-10-20 00:00");
  const docs = [
    { id: S.docId(good.id), data: JSON.parse(JSON.stringify(good)) },
    { id: "cbad", data: { initials: "山田太郎さん", staff: "x", input: {} } },
    { id: "cx", data: Object.assign({}, mk("KY", "犬塚", { age: 30 }, "2026-10-21 00:00"), { input: { age: 30, tel: "090-1111-2222", memo: "x" } }) },
  ];
  const r = S.fromSnapshot(docs);
  assert.equal(r.customers.length, 2);
  assert.equal(r.customers[0].initials, "K.Y", "新しい順");
  assert.doesNotMatch(JSON.stringify(r.customers), /090|memo|山田太郎/);
  assert.equal(r.customers[1].input.history.length, 1);
});

test("fromSnapshot → diff: 読んだばかりの一覧は書き直さない（無駄な書き込みをしない）", () => {
  const a = mk("斎藤", "上田", { age: 27 }, "2026-10-20 00:00");
  const docs = [{ id: S.docId(a.id), data: JSON.parse(JSON.stringify(a)) }];
  const r = S.fromSnapshot(docs);
  const d = S.diff(r.synced, r.customers);
  assert.equal(d.sets.length, 0); assert.equal(d.deletes.length, 0);
});

test("viewState: ファイル版は「この端末だけ」、共有版は「全員で共有」。書けない人だけ見るだけにする", () => {
  assert.match(S.viewState({ shared: false }).head, /この端末だけ/);
  assert.equal(S.viewState({ shared: false }).readOnly, false);
  const w = S.viewState({ shared: true, canWrite: true });
  assert.match(w.head, /全員で共有/); assert.equal(w.readOnly, false);
  const ro = S.viewState({ shared: true, canWrite: false });
  assert.equal(ro.readOnly, true); assert.match(ro.msg, /見るだけ/); assert.match(ro.msg, /編集/);
  assert.equal(S.viewState({ shared: true, canWrite: null }).readOnly, false, "分からないときは出しておき、断られたら知らせる");
});

test("errorText: 上限・それ以外で、何が起きてどうすればよいかを書く", () => {
  assert.match(S.errorText("quota_exceeded"), /上限/);
  assert.match(S.errorText("revoked"), /権限/);
  assert.match(S.errorText("anything"), /保存できませんでした/);
});
