const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../lib/policy.js");

const KEYS = ["id", "label", "note", "stressRate", "dti", "multipleMax", "multipleHard", "minIncome", "ageMin", "ageMax",
  "payoffAgeMax", "termMax", "tenureEmployee", "tenureSelf", "contractOk", "nonPR", "danshinRequired", "incomeBasis",
  "cardLimitRate", "jointGuarantor", "jointCodebtor", "ltvMax", "ltvWithCosts", "allowChosei", "allowLeasehold",
  "minFloorHouse", "minFloorMansion", "unitCost", "life", "simpleRate", "guarantee", "authority", "docsExtra"];

test("5つの型が同じ項目を持つ", () => {
  assert.deepEqual(Object.keys(P.PRESETS).sort(), ["flat35", "megabank", "net", "regional", "shinkin"].sort());
  for (const k of ["guarantor", "adminFee", "loanMin", "loanMax", "termMin", "ltvBase", "requireNewQuake", "highLtv", "requireArea", "memberThreshold"]) for (const p of Object.values(P.PRESETS)) assert.ok(k in p, `${p.id} に ${k} がない`);
  for (const [id, p] of Object.entries(P.PRESETS)) {
    for (const k of KEYS) assert.ok(k in p, `${id} に ${k} がない`);
    assert.equal(p.id, id);
    assert.match(p.label, /型$/);
  }
});

test("実在の金融機関の名前を使わない", () => {
  const s = JSON.stringify(P.PRESETS);
  for (const w of [/三菱/, /三井住友/, /みずほ/, /りそな/, /住信/, /楽天/, /PayPay/, /auじぶん/, /ソニー/, /イオン/, /ARUHI/, /横浜銀行/, /千葉銀行/, /常陽/]) assert.doesNotMatch(s, w);
});

test("フラット35型は実際の金利で審査し、勤続年数を問わず、団信は任意", () => {
  const f = P.PRESETS.flat35;
  assert.equal(f.stressRate, null);
  assert.equal(f.tenureEmployee, 0);
  assert.equal(f.danshinRequired, false);
  assert.equal(f.multipleMax, Infinity);
  assert.ok(f.minFloorHouse >= 70);
  assert.ok(f.docsExtra.some((d) => /適合証明/.test(d)));
});

test("resolvePolicy は型に上書きを重ね、元の型を変えない", () => {
  const r = P.resolvePolicy("megabank", { stressRate: 3.0 });
  assert.equal(r.stressRate, 3.0);
  assert.equal(P.PRESETS.megabank.stressRate, 3.5);
  assert.equal(r.version, P.POLICY_VERSION);
  assert.equal(P.resolvePolicy("nope").id, "megabank");
  const r2 = P.resolvePolicy("megabank", { dti: [{ under: 400, max: 28 }, { under: Infinity, max: 33 }] });
  assert.equal(r2.dti[0].max, 28);
  assert.equal(P.PRESETS.megabank.dti[0].max, 25);
});

test("保証会社の表は格付A〜Dを持ち、上乗せは格付が下がるほど大きい", () => {
  for (const p of Object.values(P.PRESETS)) {
    const g = p.guarantee;
    for (const k of ["A", "B", "C", "D"]) assert.ok(g[k] && typeof g[k].fee === "number" && typeof g[k].add === "number");
    assert.ok(g.A.fee + g.A.add <= g.B.fee + g.B.add && g.B.fee + g.B.add <= g.C.fee + g.C.add && g.C.fee + g.C.add <= g.D.fee + g.D.add);
  }
});

test("決裁権限は金額の帯で上がる", () => {
  const a = P.PRESETS.megabank.authority;
  assert.ok(a.length >= 3);
  for (let i = 1; i < a.length; i++) assert.ok(a[i].upTo > a[i - 1].upTo);
});
