// 審査基準の「型」。実在の金融機関の基準ではなく、公開情報から見た一般的な水準の目安。
// 数字は画面の「審査基準」で上書きできる（resolvePolicy）。基準の数字はこのファイルにだけ置く。
(function (root, factory) {
  const m = factory();
  if (typeof module === "object" && module.exports) module.exports = m;
  else Object.assign((root.LSA = root.LSA || {}), m);
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const POLICY_VERSION = "2026-10";

  // 共通の値（型ごとに必要なものだけ上書き）
  const BASE = {
    stressRate: 3.5,          // 審査金利（%）。null なら実際の金利で審査
    dti: [{ under: 300, max: 25 }, { under: 400, max: 30 }, { under: Infinity, max: 35 }], // 年収帯（万円未満）ごとの返済負担率の上限
    multipleMax: 7, multipleHard: 9, // 年収倍率
    minIncome: 150,           // 最低年収（万円）
    ageMin: 20, ageMax: 70, payoffAgeMax: 80, termMax: 35,
    tenureEmployee: 1, tenureSelf: 3, // 勤続年数（年）／事業年数（確定申告の期数）
    contractOk: true,         // 契約・派遣・パートを受け付けるか（受け付けても △）
    nonPR: "ng",              // 永住権がない外国籍の扱い: ng=否決 / warn=△
    danshinRequired: true,    // 団信加入が必須か
    incomeBasis: "avg3",      // 自営業・経営者の所得: avg3=3期平均 / min2=直近2期の低いほう / latest=直近
    cardLimitRate: 0,         // カードローン・キャッシング枠を毎月の返済に算入する率（枠に対する%/月）
    jointGuarantor: 50,       // 収入合算（連帯保証）で算入する割合（%）
    jointCodebtor: 100,       // 収入合算（連帯債務）で算入する割合（%）
    ltvMax: 100, ltvWithCosts: 110, // 担保掛目の上限（%）
    allowChosei: false, allowLeasehold: true, // 市街化調整区域・借地権
    minFloorHouse: 40, minFloorMansion: 30,  // 床面積の下限（㎡）
    unitCost: { wood: 17, steel: 25, rc: 28 }, // 建物の再調達単価（万円/㎡）
    life: { wood: 22, steel: 34, rc: 47 },     // 耐用年数（年）
    simpleRate: { new: 100, used: [[10, 85], [20, 75], [30, 65], [Infinity, 55]], mansionUsed: [[20, 85], [30, 75], [Infinity, 65]], oldQuake: 10 },
    guarantee: { // 保証料（金利上乗せ型の目安 %）と金利の優遇縮小（%）
      A: { fee: 0.2, add: 0, label: "最優遇" },
      B: { fee: 0.2, add: 0.1, label: "優遇" },
      C: { fee: 0.3, add: 0.3, label: "優遇縮小" },
      D: { fee: 0.4, add: 0.5, label: "個別判断" },
    },
    authority: [ // 決裁権限（借入額の帯・万円）
      { upTo: 3000, label: "支店長" },
      { upTo: 8000, label: "本部審査部" },
      { upTo: Infinity, label: "役員（審査委員会）" },
    ],
    docsExtra: [],
  };

  const PRESETS = {
    megabank: Object.assign({}, BASE, {
      id: "megabank", label: "都市銀行型",
      note: "審査金利3.5%前後で返済負担率を見る、標準的な銀行の型。調整区域は原則不可。",
    }),
    net: Object.assign({}, BASE, {
      id: "net", label: "ネット銀行型",
      note: "金利は低め。正社員・勤続・年収など属性を重く見る型。諸費用の借入は不可、契約社員は原則不可。",
      stressRate: 3.0, dti: [{ under: 400, max: 30 }, { under: Infinity, max: 35 }], multipleMax: 8, multipleHard: 10,
      minIncome: 200, contractOk: false, ltvWithCosts: 100, allowLeasehold: false, incomeBasis: "avg3",
      guarantee: { A: { fee: 0, add: 0, label: "最優遇" }, B: { fee: 0, add: 0.1, label: "優遇" }, C: { fee: 0, add: 0.3, label: "優遇縮小" }, D: { fee: 0, add: 0.6, label: "個別判断" } },
    }),
    regional: Object.assign({}, BASE, {
      id: "regional", label: "地方銀行型",
      note: "地域の物件と勤務先をよく知る型。調整区域や勤続の短さにも個別に対応するが、カード枠は返済に算入して見る。",
      stressRate: 3.0, dti: [{ under: 300, max: 30 }, { under: Infinity, max: 35 }], multipleMax: 8, multipleHard: 10,
      tenureEmployee: 0.5, nonPR: "warn", allowChosei: true, cardLimitRate: 3, incomeBasis: "min2",
    }),
    flat35: Object.assign({}, BASE, {
      id: "flat35", label: "フラット35型",
      note: "全期間固定。実際の金利で返済負担率を見て、勤続年数・雇用形態は問わない。団信は任意。物件は技術基準（適合証明）が必要。",
      stressRate: null, dti: [{ under: 400, max: 30 }, { under: Infinity, max: 35 }], multipleMax: Infinity, multipleHard: Infinity,
      minIncome: 0, tenureEmployee: 0, tenureSelf: 1, danshinRequired: false, incomeBasis: "latest", jointGuarantor: 100,
      minFloorHouse: 70, minFloorMansion: 30, allowChosei: true,
      guarantee: { A: { fee: 0, add: 0, label: "標準" }, B: { fee: 0, add: 0, label: "標準" }, C: { fee: 0, add: 0, label: "標準" }, D: { fee: 0, add: 0, label: "標準" } },
      docsExtra: ["適合証明書（検査機関が発行）"],
    }),
  };

  const clone = (v) => (Array.isArray(v) ? v.map(clone) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, w]) => [k, clone(w)])) : v);

  // 型の id（または { id, ...上書き }）から、上書きを重ねた基準を作る。元の型は変えない
  function resolvePolicy(id, overrides) {
    if (id && typeof id === "object") { overrides = Object.assign({}, id, overrides); id = id.id; }
    const base = PRESETS[id] || PRESETS.megabank;
    const p = clone(base);
    for (const [k, v] of Object.entries(overrides || {})) if (k !== "id" && v !== undefined) p[k] = clone(v);
    p.dti = p.dti.map((t) => ({ under: t.under == null ? Infinity : t.under, max: t.max }));
    p.version = POLICY_VERSION;
    return p;
  }

  return { POLICY_VERSION, PRESETS, resolvePolicy };
});
