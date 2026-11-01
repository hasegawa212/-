const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const RM = require("../lib/rolemap");
const D = require("../data/roles");
const PLAN = require("../data/handoff");
const SEATS = require("../data/seats");
const { buildSeatSheet, esc, OUT } = require("../tools/seat-sheet");

const html = buildSeatSheet();
const h = RM.handoff(D, PLAN, D.ceoId);

test("席ごとのやること：割り当て案のすべての席と仕事がのっている", () => {
  for (const [seat, v] of Object.entries(h.bySeat)) {
    assert.ok(html.includes(`>${seat}<`), seat);
    for (const t of [...v.move, ...v.rule]) assert.ok(html.includes(esc(t.name)), t.id);
  }
});

test("席ごとのやること：公募のすべての席がのり、案で仕事がない席は職務を公募一覧で見るよう案内する", () => {
  for (const seat of Object.keys(SEATS)) {
    assert.ok(html.includes(`>${seat}<`), seat);
    assert.ok(html.includes(esc(SEATS[seat])), seat);
  }
  const empty = Object.keys(SEATS).filter((s) => !h.bySeat[s]);
  assert.ok(empty.length > 0);
  const n = (html.match(/class="none"/g) || []).length;
  assert.equal(n, empty.length, "仕事がない席の数だけ案内がある");
});

test("席ごとのやること：社員に配る紙なので、人の名前（名字・2文字以上の名）・代表に残す仕事・今手伝っている人は出さない", () => {
  for (const p of D.people) {
    const [sur, given] = p.name.split(" ");
    assert.ok(!html.includes(sur), `名字 ${sur}`);
    if (given && given.length >= 2) assert.ok(!html.includes(given), `名 ${given}`);
  }
  for (const t of h.ceoAfter) assert.ok(!html.includes(esc(t.name)), t.id);
  assert.doesNotMatch(html, /手伝っている人|代表に残す/);
});

test("席ごとのやること：A4 で印刷でき、外部への通信をしない", () => {
  assert.match(html, /@page\s*\{\s*size:\s*A4/);
  assert.doesNotMatch(html, /fetch\(|XMLHttpRequest|<script src="http/);
});

test("席ごとのやること：リポジトリに入れた別紙は、今の割り当て案から作ったものと同じ（npm run sheet で作り直す）", () => {
  assert.equal(fs.readFileSync(OUT, "utf8"), html);
});

test("esc：HTML の特殊文字をすべて置き換える", () => {
  assert.equal(esc(`a&b<c>d"e`), "a&amp;b&lt;c&gt;d&quot;e");
});
