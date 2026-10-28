const test = require("node:test");
const assert = require("node:assert/strict");
const RM = require("../lib/rolemap");

const ev = [{ channel: "#00", date: "2026-10-01", note: "" }];
const fx = () => ({
  people: [
    { id: "ceo", name: "代表A", status: "在籍" },
    { id: "a", name: "社員A", status: "在籍" },
    { id: "b", name: "社員B", status: "在籍" },
  ],
  tasks: [
    { id: "t1", name: "振込", area: "経営", freq: "毎週", owner: "ceo", helpers: ["a"], seat: "K-2", evidence: ev },
    { id: "t2", name: "集計", area: "営業", freq: "毎週", owner: "a", helpers: [], seat: "S-3", evidence: ev },
    { id: "t3", name: "研修", area: "営業", freq: "単発", owner: "ceo", helpers: ["b"], seat: "S-6", evidence: ev },
    { id: "t4", name: "勤怠連絡", area: "全社", freq: "都度", owner: null, helpers: ["a", "b"], seat: null, evidence: ev },
    { id: "t5", name: "使っていないチャンネル", area: "営業", freq: "都度", owner: null, helpers: [], seat: null, evidence: ev },
    { id: "t6", name: "資金調達", area: "経営", freq: "都度", owner: "ceo", helpers: [], seat: null, evidence: ev },
  ],
});
const plan = () => ({
  t1: { kind: "move", seat: "K-2", note: "準備を渡す" },
  t3: { kind: "move", seat: "S-6" },
  t4: { kind: "rule", seat: "E-7", note: "守られているかを見る席" },
  t5: { kind: "stop" },
  t6: { kind: "keep", note: "代表にしかできない" },
});

test("handoff：代表の仕事と担当なしの仕事を、渡す・残す・ルール・やめるに分ける", () => {
  const h = RM.handoff(fx(), plan(), "ceo");
  assert.deepEqual(h.errors, []);
  assert.deepEqual(h.missing, []);
  assert.deepEqual(h.count, { move: 2, keep: 1, rule: 1, stop: 1 });
  assert.deepEqual(h.ceoAfter.map((t) => t.id), ["t6"]);             // 代表に残るのは keep だけ
  assert.equal(h.ceoBefore, 3);
});

test("handoff：席ごとに渡す仕事・ルール、今手伝っている人（参考）をまとめる", () => {
  const s = RM.handoff(fx(), plan(), "ceo").bySeat;
  assert.deepEqual(s["K-2"].move.map((t) => t.id), ["t1"]);
  assert.deepEqual(s["K-2"].helpers, ["a"]);
  assert.deepEqual(s["E-7"].rule.map((t) => t.id), ["t4"]);
  assert.deepEqual(s["E-7"].helpers, []);                            // 全員ルールの手伝いは候補にしない
  assert.equal(s["undefined"], undefined);
});

test("handoff：案が抜けている仕事・存在しない仕事・席なしの move/rule・不正な kind を見つける", () => {
  const p = plan();
  delete p.t3;                                                       // 抜け
  p.zzz = { kind: "move", seat: "S-1" };                             // 存在しない仕事
  p.t4 = { kind: "rule" };                                           // 席なし
  p.t5 = { kind: "たぶん" };                                         // 不正
  const h = RM.handoff(fx(), p, "ceo");
  assert.deepEqual(h.missing, ["t3"]);
  const e = h.errors.join("\n");
  assert.match(e, /zzz.*存在しない/);
  assert.match(e, /t4.*席/);
  assert.match(e, /t5.*kind/);
});

test("handoff：代表でも担当なしでもない仕事への案はエラー", () => {
  const p = plan();
  p.t2 = { kind: "move", seat: "S-3" };
  assert.match(RM.handoff(fx(), p, "ceo").errors.join("\n"), /t2.*対象外/);
});
