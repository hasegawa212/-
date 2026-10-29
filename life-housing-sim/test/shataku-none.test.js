// TDD：社宅を出る年齢に「なし」（決まりなし）。0＝なし。社宅に住めるのは在職中だけなので、定年（retireAge）までを社宅として計算する
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const S = require("../lib/engine");

const base = S.preset("shataku");
const none = { ...base, shataku: { ...base.shataku, until: 0 } };
const x = S.compute(none);

test("計算：「なし」は定年まで社宅（家賃＝自己負担）、定年のあとはふつうの家賃", () => {
  const i = x.input;
  for (const y of x.years.filter((v) => v.age < i.retireAge)) {
    if (y.age < x.loan.buyAge || true) assert.equal(y.stage, "shataku", `${y.age}歳`);
    assert.equal(y.rentMonthly, base.shataku.self);
  }
  const after = x.years.find((v) => v.age === i.retireAge);
  assert.notEqual(after.stage, "shataku");
  assert.equal(x.shataku.until, 0);
  assert.equal(x.shataku.end, i.retireAge);
  assert.ok(x.shataku.after > base.shataku.self);
});

test("言葉：「◯歳まで」ではなく「出る年齢の決まりなし（定年まで）」。0歳・NaN は出ない", () => {
  const all = JSON.stringify([S.talk(x), S.proposal(x), S.deck(x), S.home(x, {}, {}), S.conditions(x)]);
  assert.doesNotMatch(all, /(^|[^0-9])0歳(まで|ごろ)|NaN|undefined/);
  assert.match(S.talk(x)[2].say, /決まりはありません/);
  assert.match(S.talk(x)[2].show, /決まりなし/);
  assert.match(S.proposal(x).cover.profile, /定年まで/);
  const ev = S.home(x, {}, {}).events.find((e) => /社宅/.test(e.label));
  assert.ok(!ev || ev.age === x.input.retireAge);
});

test("画面：社宅を出る年齢の選択肢に「なし」", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /\["shataku\.until", "社宅を出る年齢（規定）", \[0, \.\.\.range\(25, 40, 1\)\], \(v\) => \(v \? v \+ "歳" : "なし（決まりなし・定年まで）"\)\]/);
});
