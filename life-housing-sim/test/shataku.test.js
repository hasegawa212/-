// TDD：家賃が平均的な人／社宅の人（だいたい30歳までに出る）
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../lib/engine");
const Share = require("../lib/share");

test("お客様のタイプは3つ：独身・賃貸（家賃平均）／独身・社宅／結婚・子どもあり", () => {
  assert.deepEqual(Object.keys(S.PRESETS), ["single", "shataku", "family"]);
  assert.match(S.PRESETS.single, /家賃.*平均/);
  assert.match(S.PRESETS.shataku, /社宅/);
});

test("家賃の平均：お客様の家賃の中央値 5.8万円を、ひとり暮らしの家賃の初期値にする", () => {
  assert.equal(S.RENT_AVG.single, 58_000);
  assert.equal(S.defaults().rent.single, S.RENT_AVG.single);
  assert.equal(S.preset("shataku").rent.single, S.RENT_AVG.single, "社宅を出たあとは平均的な家賃");
  assert.ok(S.RENT_AVG.source.length > 0, "出どころを書く");
});

test("社宅：30歳までは自己負担（2万円）、30歳からは平均的な家賃。社宅の間は更新料なし", () => {
  const p = S.preset("shataku");
  assert.equal(p.shataku.on, true);
  assert.equal(p.shataku.until, 30);
  assert.equal(p.shataku.self, 20_000);
  const x = S.compute(p);
  const at = (a) => x.years.find((y) => y.age === a);
  assert.equal(at(29).rentMonthly, 20_000);
  assert.equal(at(29).renewPart, 0);
  assert.equal(at(29).stageLabel, "社宅");
  assert.equal(at(30).rentMonthly, S.RENT_AVG.single);
  assert.ok(at(30).renewPart > 0);
  assert.equal(x.shataku.jump, S.RENT_AVG.single - 20_000, "社宅を出ると毎月いくら上がるか");
  assert.equal(x.shataku.until, 30);
});

test("社宅の人：社宅を出る年齢で買う計画が初期値（買うまでは社宅の自己負担）", () => {
  const p = S.preset("shataku");
  assert.equal(p.own.buyAge, p.shataku.until);
  const x = S.compute({ ...p, own: { ...p.own, buyAge: 32 } });
  const pre = x.years.filter((y) => y.age < 32);
  assert.equal(pre.find((y) => y.age === 28).preRent, x.years.find((y) => y.age === 28).rentYear);
  assert.equal(pre.find((y) => y.age === 31).rentMonthly, S.RENT_AVG.single, "社宅を出て買うまでは平均的な家賃");
});

test("社宅ではない人は今までどおり（社宅の欄は使わない）", () => {
  const x = S.compute(S.defaults());
  assert.equal(S.defaults().shataku.on, false);
  assert.ok(x.years.every((y) => y.stageLabel !== "社宅"));
  assert.equal(x.shataku, null);
});

test("説明①：社宅の人には「社宅を出ると家賃が上がる」ことを数字で伝える（あおらない）", () => {
  const t = S.talk(S.compute(S.preset("shataku")));
  const one = t.find((s) => s.title.startsWith("①"));
  assert.match(one.say + one.show, /社宅/);
  assert.match(one.show, /2万円/);
  assert.match(one.show, /5\.8万円/);
  for (const s of t) for (const re of S.FORBIDDEN) assert.doesNotMatch(s.say + s.show + s.ask, re);
  const single = S.talk(S.compute(S.defaults())).find((s) => s.title.startsWith("①"));
  assert.match(single.show, /平均/);
});

test("提案書：社宅の人は表紙のプロフィールに社宅と出る年齢が入る", () => {
  const p = S.proposal(S.compute(S.preset("shataku")));
  assert.match(p.cover.profile, /社宅.*30歳/);
  assert.ok(p.notes.some((n) => /社宅/.test(n)));
});

test("共有リンク：社宅の条件も行き来できる（範囲外は無視）", () => {
  const st = S.preset("shataku");
  const back = Share.decode(Share.encode(st), S.defaults()).state;
  assert.deepEqual(back.shataku, st.shataku);
  const bad = Share.decode("#s=" + Buffer.from(JSON.stringify({ shataku: { on: "yes", self: -1 } })).toString("base64"), S.defaults()).state;
  assert.deepEqual(bad.shataku, S.defaults().shataku);
});
