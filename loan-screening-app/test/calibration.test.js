// 当社の実績（Slack #21・#37・#05、営業報告ログ。2024/7〜2026/10）で答え合わせをして直した基準
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../lib/screening.js");
const run = (p, pol) => L.screen(Object.assign({}, L.SAMPLE, { collateral: 3180 }, p), pol || "regional", { now: "x" });
const chk = (r, stage, key) => r.stages.find((s) => s.key === stage).checks.find((c) => c.key === key);

test("契約・派遣社員でも勤続2年以上なら、契約社員を受け付ける型では ○（実績: 労金・信金・地銀で10件以上が承認）", () => {
  for (const pol of ["regional", "shinkin", "rokin", "megabank"]) {
    assert.equal(chk(run({ employ: "contract", tenure: 3 }, pol), "person", "employ").status, "ok", pol);
    assert.equal(chk(run({ employ: "contract", tenure: 1 }, pol), "person", "employ").status, "warn", pol);
  }
  assert.equal(chk(run({ employ: "contract", tenure: 3 }, "net"), "person", "employ").status, "ng"); // ネット銀行型は否決の実績どおり
});

test("労働金庫型がある（実績: 当社の申込で承認が多い）", () => {
  const p = L.PRESETS.rokin;
  assert.equal(p.label, "労働金庫型");
  assert.equal(p.contractOk, true);
  // 年収300万円台の契約社員・2,200万円・他の借入なしで、承認見込みか条件付き
  const r = run({ employ: "contract", tenure: 2, income: 303, incomePrev: 303, incomePrev2: 303, price: 2200, down: 0, car: 0, scholarship: 0, collateral: 2200 }, "rokin");
  assert.ok(["approve", "conditional"].includes(r.decision), r.decision);
});

test("直近の否決: 1件は △、2件以上は ×（実績: 一度否決が出ると他行も続けて否決）", () => {
  assert.equal(chk(run({ priorRejects: 0 }), "credit", "priorRejects"), undefined);
  assert.equal(chk(run({ priorRejects: 1 }), "credit", "priorRejects").status, "warn");
  assert.equal(chk(run({ priorRejects: 2 }), "credit", "priorRejects").status, "ng");
  assert.notEqual(run({ priorRejects: 2 }).decision, "approve");
});

test("単身で購入動機書がないと △、用意すれば ○（実績: 単身を理由にした否決あり）", () => {
  assert.equal(chk(run({ single: true, motiveDoc: false }), "person", "single").status, "warn");
  assert.equal(chk(run({ single: true, motiveDoc: true }), "person", "single").status, "ok");
  assert.equal(chk(run({ single: false }), "person", "single"), undefined);
  assert.ok(run({ single: true, motiveDoc: false }).conditions.some((c) => /購入動機/.test(c)));
});

test("答え合わせの結果をエンジンが持っている（件数・一致率・データの範囲）", () => {
  const c = L.CALIBRATION;
  assert.ok(c.n >= 20 && c.match <= c.n);
  assert.ok(c.period && c.note);
  assert.match(c.note, /件数が少ない/);
});
