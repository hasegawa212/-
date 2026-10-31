const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../lib/screening.js");
const NOW = "2026-10-31T09:00:00+09:00";
const run = (p, pol, opt) => L.screen(Object.assign({}, L.SAMPLE, p), pol || "megabank", Object.assign({ now: NOW }, opt));
const allDocs = { income: true, id: true, property: true, contract: true, danshin: true, tax: true, corp: true, fit: true };

test("元利均等の返済額と借入可能額は逆算で一致する", () => {
  const m = L.pmt(3000, 1, 35);
  assert.ok(Math.abs(m - 8.469) < 0.01);
  assert.ok(Math.abs(L.pv(m, 1, 35) - 3000) < 1e-6);
  assert.equal(L.pmt(1200, 0, 10), 10);
});

test("審査ラインは9工程をこの順で持ち、各工程に状態がある", () => {
  const r = run({});
  assert.deepEqual(r.stages.map((s) => s.key), ["kyc", "credit", "person", "income", "capacity", "property", "guarantee", "docs", "authority"]);
  for (const s of r.stages) assert.ok(["ok", "warn", "ng", "skip"].includes(s.status), s.key);
});

test("返済比率は審査金利で計算し、他の借入を含む。フラット35型は実際の金利", () => {
  const r = run({ price: 3000, down: 0, term: 35, income: 500, car: 3, scholarship: 0, rate: 1.8 });
  const exp = ((L.pmt(3000, 3.5, 35) + 3) * 12) / 500 * 100;
  assert.ok(Math.abs(r.dti - exp) < 1e-9);
  // フラット35は flatRate（＋融資率9割超の上乗せ）が実際の金利
  const f = run({ price: 3000, down: 0, term: 35, income: 500, car: 3, scholarship: 0, flatRate: 1.8, floor: 100 }, "flat35");
  assert.ok(Math.abs(f.dti - ((L.pmt(3000, 1.8 + L.PRESETS.flat35.highLtv.add, 35) + 3) * 12) / 500 * 100) < 1e-9);
});

test("カードローンの利用枠は型の率で返済に算入する", () => {
  const a = run({ cashing: 100 }, { id: "megabank", cardLimitRate: 0 });
  const b = run({ cashing: 100 }, { id: "megabank", cardLimitRate: 3 });
  assert.ok(Math.abs(b.debt - a.debt - 3) < 1e-9);
});

test("足切り: 反社・異動・官報・年齢・最低年収・投資用・接道 → 否決、融資可能額0", () => {
  const cases = [{ antisocial: true }, { credit: { cic: { late: "jiko", apply: 0 }, jicc: { late: "none", apply: 0 }, ksc: { late: "none", apply: 0, kanpo: false } } },
    { credit: { cic: { late: "none", apply: 0 }, jicc: { late: "none", apply: 0 }, ksc: { late: "none", apply: 0, kanpo: true } } },
    { age: 72 }, { income: 120, incomePrev: 120, incomePrev2: 120 }, { purpose: "invest" }, { road: 1 }];
  for (const p of cases) {
    const r = run(p);
    assert.equal(r.decision, "reject", JSON.stringify(p));
    assert.ok(r.knockouts.length >= 1);
    assert.equal(r.maxLoan, 0);
  }
});

test("団信に入れない: 銀行型は否決、フラット35型は否決にしない", () => {
  assert.equal(run({ danshin: "no" }).decision, "reject");
  assert.notEqual(run({ danshin: "no", floor: 100 }, "flat35").decision, "reject");
});

test("永住権なし: 型の設定で否決か △", () => {
  assert.equal(run({ nationality: "other" }, { id: "megabank", nonPR: "ng" }).decision, "reject");
  const r = run({ nationality: "other" }, { id: "megabank", nonPR: "warn" });
  assert.notEqual(r.decision, "reject");
});

test("余裕のある申込みは承認見込み・格付A/B、保証料と適用金利の目安が出る", () => {
  const r = run({ employ: "public", tenure: 12, income: 750, incomePrev: 740, price: 3500, down: 700, car: 0, scholarship: 0 });
  assert.equal(r.decision, "approve");
  assert.ok(["A", "B"].includes(r.grade));
  assert.ok(r.maxLoan >= r.loan);
  assert.equal(r.guarantee.grade, r.grade);
  assert.ok(Math.abs(r.guarantee.rate - (r.input.rate + r.guarantee.add + r.guarantee.fee)) < 1e-9);
});

test("金額だけ超える場合は減額の条件付き承認、融資可能額で借りれば上限内", () => {
  const base = { employ: "large", tenure: 8, income: 450, incomePrev: 440, price: 4200, down: 200, car: 0, scholarship: 0, landArea: 0 };
  const r = run(base);
  assert.equal(r.decision, "conditional");
  assert.ok(r.maxLoan < r.loan && r.maxLoan > 0);
  assert.ok(r.conditions.some((c) => c.includes("減額")));
  const again = run(Object.assign({}, base, { price: r.maxLoan + 200 }));
  assert.ok(again.dti <= again.limit + 1e-9);
});

test("経営者は法人の赤字2期以上で保留、1期で △", () => {
  assert.equal(run({ employ: "owner", tenure: 6, corpLoss: 2 }).decision, "hold");
  const one = run({ employ: "owner", tenure: 6, corpLoss: 1 });
  assert.equal(one.stages.find((s) => s.key === "income").checks.find((c) => c.key === "corp").status, "warn");
});

test("契約社員: 型によって × か △", () => {
  const st = (pol) => run({ employ: "contract" }, pol).stages.find((s) => s.key === "person").checks.find((c) => c.key === "employ").status;
  assert.equal(st({ id: "net", contractOk: false }), "ng");
  assert.equal(st({ id: "regional", contractOk: true }), "warn");
});

test("本審査: 書類の確認が済んでいなければ保留、すべて済めば保留にならない", () => {
  const good = { employ: "public", tenure: 12, income: 750, incomePrev: 740, price: 3500, down: 700, car: 0, scholarship: 0 };
  const pend = run(Object.assign({ stage: "main", docs: {} }, good));
  assert.equal(pend.decision, "hold");
  assert.equal(pend.stages.find((s) => s.key === "docs").status, "ng");
  const done = run(Object.assign({ stage: "main", docs: allDocs }, good));
  assert.equal(done.decision, "approve");
  // 事前審査では書類は問わない
  assert.equal(run(Object.assign({ stage: "pre", docs: {} }, good)).decision, "approve");
});

test("必要書類は職業で変わる（自営業は確定申告3期・納税証明、経営者は法人決算書）", () => {
  const names = (p) => run(p).docsRequired.map((d) => d.label).join("／");
  assert.match(names({ employ: "regular" }), /源泉徴収票/);
  assert.match(names({ employ: "self", tenure: 5 }), /確定申告書/);
  assert.match(names({ employ: "self", tenure: 5 }), /納税証明書/);
  assert.match(names({ employ: "owner", tenure: 5 }), /決算書/);
  assert.match(run({ floor: 100 }, "flat35").docsRequired.map((d) => d.label).join(), /適合証明/);
});

test("決裁権限は金額で上がり、例外（△を承認）があれば1段上がる", () => {
  const small = run({ employ: "public", tenure: 12, income: 750, incomePrev: 740, price: 2000, down: 400, car: 0, scholarship: 0 });
  const big = run({ employ: "public", tenure: 12, income: 1500, incomePrev: 1500, price: 9500, down: 1500, car: 0, scholarship: 0, landArea: 0 });
  assert.ok(big.authority.level > small.authority.level);
  const exc = run({ employ: "public", tenure: 12, income: 750, incomePrev: 740, price: 2000, down: 400, car: 0, scholarship: 0, phoneLate: true });
  assert.ok(exc.authority.level >= small.authority.level + 1 || exc.authority.level === small.authority.max);
});

test("審査記録: 同じ入力と日時なら同じハッシュ、入力が変われば変わる", () => {
  const a = run({}), b = run({}), c = run({ income: 481 });
  assert.equal(a.audit.inputHash, b.audit.inputHash);
  assert.notEqual(a.audit.inputHash, c.audit.inputHash);
  assert.equal(a.audit.at, NOW);
  assert.equal(a.audit.policyId, "megabank");
  assert.equal(a.audit.engine, L.ENGINE_VERSION);
});

test("型を変えると結果が変わることがある（審査金利の違い）", () => {
  const p = { income: 420, incomePrev: 420, price: 3600, down: 100, car: 0, scholarship: 0, floor: 100, flatRate: 2.0 };
  assert.ok(run(p, "flat35").dti < run(p, "megabank").dti);
});

test("改善シミュレーションは判定か融資可能額が変わるものだけ出す", () => {
  const r = run({});
  assert.ok(r.whatIf.length > 0);
  for (const w of r.whatIf) assert.ok(w.decision !== r.decision || w.maxLoan !== r.maxLoan);
});

test("表示文に断定・約束の言葉を使わない。NOTE を常に返す", () => {
  for (const r of [run({}), run({ antisocial: true }), run({ stage: "main" })]) {
    const text = JSON.stringify([r.conditions, r.strengths, r.concerns, r.decisionInfo, r.stages, r.note]);
    for (const w of [/必ず通/, /絶対/, /確実に/, /審査に通ります/, /保証します/]) assert.doesNotMatch(text, w);
    assert.match(r.note, /約束するものではなく/);
  }
});
