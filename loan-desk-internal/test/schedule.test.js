const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../lib/schedule.js");
const LSA = require("../../loan-screening-app/lib/screening.js");
const R = require("../lib/recommend.js");

test("決済月だけなら25日（土日は前の金曜）を決済の目安にする", () => {
  assert.equal(S.settleDateOf("2026-12").toISOString().slice(0, 10), "2026-12-25");
  assert.equal(S.settleDateOf("2027-04").toISOString().slice(0, 10), "2027-04-23", "4/25は日曜 → 金曜");
  assert.equal(S.settleDateOf("2026-12-10").toISOString().slice(0, 10), "2026-12-10");
  assert.equal(S.settleDateOf("12月"), null);
});

test("信金は全体で約4週＋前後: 決済から逆算して 書類→事前→本申込→金消→決済 が古い順に並ぶ", () => {
  const s = S.schedule({ settle: "2026-12-25", type: "shinkin", today: "2026-11-01" });
  const d = s.steps.map((x) => x.iso);
  assert.deepEqual(d, [...d].sort());
  assert.equal(s.steps[4].iso, "2026-12-25");
  assert.equal(s.steps[3].iso, "2026-12-18", "金消は決済の1週前");
  assert.equal(s.steps[1].iso, "2026-11-13", "事前審査は本申込の2週前");
  assert.equal(s.weeks, 7);
  for (const x of s.steps) assert.ok(![0, 6].includes(new Date(x.iso).getUTCDay()), `${x.iso} が土日`);
});

test("事前審査の日を過ぎていたら「間に合わない」と決済をずらす提案。余裕がなければ tight", () => {
  const late = S.schedule({ settle: "2026-11-25", type: "shinkin", today: "2026-11-01" });
  assert.equal(late.status, "late");
  assert.match(late.message, /翌月/);
  const tight = S.schedule({ settle: "2026-12-25", type: "shinkin", today: "2026-11-01", retry: true });
  assert.equal(tight.status, "tight");
  const ok = S.schedule({ settle: "2027-02-25", type: "shinkin", today: "2026-11-01", retry: true });
  assert.equal(ok.status, "ok");
  assert.match(ok.message, /余裕/);
});

test("日数は約束ではない（目安・確認する）と必ず書く。断定しない", () => {
  const s = S.schedule({ settle: "2027-01", type: "net", today: "2026-11-01" });
  assert.match(s.note, /目安/);
  assert.match(s.note, /確認/);
  assert.doesNotMatch(JSON.stringify(s), /必ず間に合|確実/);
});

test("出す順番に、1位の金融機関の型で逆算した日程が付く（決済の目安を入れたときだけ）", () => {
  const x = Object.assign({}, LSA.SAMPLE, { pref: "茨城", age: 27, income: 355, incomePrev: 355, incomePrev2: 355, tenure: 5, employ: "contract", single: true, price: 2290, down: 0, costs: 0, collateral: 2290, car: 0, scholarship: 0 });
  assert.equal(R.recommend(x).schedule, null);
  const r = R.recommend(Object.assign({}, x, { settle: "2027-01" }), { today: "2026-11-01" });
  assert.equal(r.schedule.type, r.candidates[0].lender.type);
  assert.equal(r.schedule.steps.length, 5);
});
