const test = require("node:test");
const assert = require("node:assert/strict");
const RM = require("../lib/rolemap");
const D = require("../data/roles");
const PLAN = require("../data/handoff");
const { buildSeatSheet } = require("../tools/seat-sheet");

const html = buildSeatSheet();
const h = RM.handoff(D, PLAN, D.ceoId);

test("席ごとのやること：割り当て案のすべての席と仕事がのっている", () => {
  for (const [seat, v] of Object.entries(h.bySeat)) {
    assert.ok(html.includes(`>${seat}<`), seat);
    for (const t of [...v.move, ...v.rule]) assert.ok(html.includes(t.name.replace(/&/g, "&amp;").replace(/</g, "&lt;")), t.id);
  }
});

test("席ごとのやること：社員に配る紙なので、人の名前・代表に残す仕事・今手伝っている人は出さない", () => {
  for (const p of D.people) {
    assert.ok(!html.includes(p.name), p.name);
    assert.ok(!html.includes(p.name.split(" ")[0] + "さん"), p.name);
  }
  for (const t of h.ceoAfter) assert.ok(!html.includes(t.name), t.id);
  assert.doesNotMatch(html, /手伝っている人|代表に残す/);
});

test("席ごとのやること：A4 で印刷でき、外部への通信をしない", () => {
  assert.match(html, /@page\s*\{\s*size:\s*A4/);
  assert.doesNotMatch(html, /fetch\(|XMLHttpRequest|<script src="http/);
});
