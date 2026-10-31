// 社外秘：当社の実績と審査エンジンから「出す金融機関の順番」と「仲介会社」を出す
// 順番 = 実績の通過率（件数が少ないほど控えめ: ウィルソン下限）× 審査エンジンでの相性 × 地元の金融機関
(function (root, factory) {
  const isNode = typeof module === "object" && module.exports;
  const LSA = isNode ? require("../../loan-screening-app/lib/screening.js") : root.LSA;
  const D = isNode ? Object.assign({}, require("../data/lenders.js"), require("../data/guarantors.js")) : root.LDI;
  const m = factory(LSA, D);
  if (isNode) module.exports = m;
  else Object.assign((root.LDI = root.LDI || {}), m);
})(typeof self !== "undefined" ? self : this, function (LSA, D) {
  "use strict";
  const FIT = { approve: 1, conditional: 0.8, hold: 0.5, reject: 0 };
  const HOME = 1.1;          // 物件と同じ県が地元の金融機関
  const AVOID_N = 2, AVOID_RATE = 0.2; // 2件以上の実績で通過2割以下は「避ける」

  // 画面に出す通過率（ならし）: (通過+1)/(通過+否決+2)
  const passRate = (l) => (l.pass + 1) / (l.pass + l.reject + 2);
  // 順番に使う控えめな通過率（ウィルソン下限・z=1.64。件数が少ないほど低く見る）
  function lowerBound(l) {
    const n = l.pass + l.reject; if (!n) return 0.25;
    const p = l.pass / n, z = 1.64;
    return (p + z * z / (2 * n) - z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / (1 + z * z / n);
  }

  const gName = (id) => (D.GUARANTORS[id] || { name: id }).name;
  const guarantorsOf = (name) => (D.LENDER_GUARANTORS[name] || []).map((g) => Object.assign({ name: gName(g.id) }, g));

  // 否決された保証会社: 指定されたもの＋否決された金融機関の保証会社（確定ルートが1つだけの場合）
  function rejectedSet(x) {
    const set = new Set(x.rejectedGuarantors || []);
    for (const ln of x.rejectedLenders || []) {
      const confirmed = guarantorsOf(ln).filter((g) => g.src !== "要確認");
      if (confirmed.length === 1) set.add(confirmed[0].id);
    }
    return set;
  }

  function recommend(x, opts) {
    const lenders = (opts && opts.lenders) || D.LENDERS;
    const pref = x.pref || "";
    const rejected = rejectedSet(x);
    const rejectedLenders = new Set(x.rejectedLenders || []);
    const candidates = [], excluded = [], avoid = [], outOfArea = [];
    for (const l of lenders) {
      if (!(l.areas.includes(pref) || l.areas.includes("全国"))) { outOfArea.push({ lender: l }); continue; }
      const guarantors = guarantorsOf(l.name);
      if (rejectedLenders.has(l.name)) { excluded.push({ lender: l, guarantors, reason: "この金融機関で否決済み" }); continue; }
      const confirmed = guarantors.filter((g) => g.src !== "要確認");
      const hit = confirmed.filter((g) => rejected.has(g.id));
      let guarantorNote = "";
      if (confirmed.length && hit.length === confirmed.length) {
        const alt = guarantors.filter((g) => g.src === "要確認" && !rejected.has(g.id));
        if (!alt.length) { excluded.push({ lender: l, guarantors, reason: `同じ保証会社（${hit.map((g) => g.name).join("・")}）で否決済み` }); continue; }
        guarantorNote = `${hit.map((g) => g.name).join("・")}で否決済み。${alt.map((g) => g.name).join("・")}のルートが使えるか、出す前に確認する`;
      } else if (hit.length) {
        guarantorNote = `${hit.map((g) => g.name).join("・")}は否決済み。${confirmed.filter((g) => !rejected.has(g.id)).map((g) => g.name).join("・")}のルートで出す`;
      }
      const screen = LSA.screen(Object.assign({}, x, { inArea: true }), l.type, { now: (opts && opts.now) || "x" });
      const n = l.pass + l.reject;
      const item = { lender: l, guarantors, guarantorNote, screen, rate: passRate(l), n, broker: l.broker || "増子建設", brokerAlt: l.alt || "",
        score: lowerBound(l) * FIT[screen.decision] * (l.areas[0] === pref ? HOME : 1) };
      if (screen.decision === "reject" || screen.decision === "hold") { item.reason = screen.knockouts[0] || screen.checks.filter((c) => c.status === "ng").map((c) => c.label).join("・") || (screen.holdReason || "審査エンジンで否決・保留の見込み"); excluded.push(item); continue; }
      if (n >= AVOID_N && l.pass / n <= AVOID_RATE) { item.reason = `当社の実績で ${n}件中 通過${l.pass}件`; avoid.push(item); continue; }
      candidates.push(item);
    }
    candidates.sort((a, b) => b.score - a.score);
    const top = candidates[0];
    // 出す順番: 2番目以降は、それまでと別の保証会社の金融機関を優先する
    const planItems = [], seen = new Set();
    const ids = (c) => c.guarantors.filter((g) => g.src !== "要確認").map((g) => g.id);
    const pool = candidates.slice();
    while (planItems.length < 3 && pool.length) {
      let i = pool.findIndex((c) => !ids(c).length || !ids(c).every((id) => seen.has(id)));
      if (i < 0) i = 0;
      const c = pool.splice(i, 1)[0];
      planItems.push(c); ids(c).forEach((id) => seen.add(id));
    }
    const gText = (c) => (c.guarantors.length ? `保証: ${c.guarantors.map((g) => g.name + (g.src === "要確認" ? "（要確認）" : "")).join("・")}` : "保証: 要確認");
    const plan = planItems.map((c, i) => (i === 0 ? `まず ${c.lender.name}（${gText(c)}）` : `否決されたら、理由を確かめて条件を見直してから ${c.lender.name}（${gText(c)}）`));
    const prepare = [];
    if (x.single && !x.motiveDoc) prepare.push("購入動機書（勤務先・地元とのつながり・この家を選んだ理由・将来の計画）");
    if (top) top.screen.conditions.forEach((c) => { if (!prepare.includes(c) && !(/購入動機/.test(c) && prepare.some((p) => /購入動機/.test(p)))) prepare.push(c); });
    prepare.push("本人開示（CIC・JICC・KSC）で信用情報を確かめる");
    return {
      pref, candidates, excluded, avoid, outOfArea, plan, planItems, prepare, rejectedGuarantors: [...rejected],
      guarantorNote: LSA.GUARANTOR_NOTE + " 保証会社は金融機関とは別に審査し、お客様だけでなく業者（売主・仲介）も審査する。銀行を変えても保証会社が同じなら、同じ判断になりやすい。",
      rule: "同時に複数の金融機関へ申し込まない。申込情報が信用情報に残り、否決が続く原因になる。否決されたら理由を確かめてから次に出す",
      disclosure: "当社が売主であること、仲介会社との関係（グループ会社を含む）は、最初から金融機関に伝える。名前を出さないために仲介や売主を立てる組み方はしない",
      note: `実績は ${D.DATA_AS_OF} 時点の当社の記録（件数は少ない）。決めるのは金融機関と保証機関で、この順番は承認を約束するものではない`,
    };
  }

  return { passRate, lowerBound, recommend };
});
