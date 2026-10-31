// 審査基準の「型」。実在の金融機関の基準ではなく、公開情報から見た一般的な水準の目安。
// 数字は画面の「審査基準」で上書きできる（resolvePolicy）。基準の数字はこのファイルにだけ置く。
(function (root, factory) {
  const m = factory();
  if (typeof module === "object" && module.exports) module.exports = m;
  else Object.assign((root.LSA = root.LSA || {}), m);
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const POLICY_VERSION = "2026-10b";

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
    // v3: 保証機関・費用・借入額の範囲・フラット35／信用金庫の条件
    guarantor: { type: "bank", label: "銀行系の保証会社", lumpPer100: { A: 20000, B: 30000, C: 45000, D: 70000 } }, // 一括前払いの保証料（円／借入100万円・35年）
    adminFee: { type: "fixed", value: 33000 }, // 事務手数料: fixed=円 / rate=借入額の%
    loanMin: 50, loanMax: 20000,               // 借入額の範囲（万円）
    termMin: 1,
    ltvBase: "collateral",                     // 掛目の分母: collateral=担保評価 / price=物件価格（融資率）
    requireNewQuake: false,                    // 旧耐震を × にするか
    highLtv: { over: Infinity, add: 0 },       // 融資率がこれを超えると金利を上乗せ（%）
    requireArea: false,                        // 営業地域内の居住・勤務が必要か
    memberThreshold: 0,                        // 借入がこれを超えると会員（出資金）が必要（万円、0=なし）
  };

  // 住宅ローンの保証と、信用保証協会の違い（画面に常に出す）
  const GUARANTOR_NOTE = "住宅ローンの保証は、民間の保証会社（銀行系・信用金庫の系統保証機関・独立系）が行います。信用保証協会は中小企業・個人事業主の事業資金を保証する公的機関で、住宅ローンの保証は扱いません。フラット35は保証会社を使わず、保証料・保証人は不要です。";

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
      guarantor: { type: "waived", label: "保証料なし（事務手数料型）", lumpPer100: { A: 0, B: 0, C: 0, D: 0 } },
      adminFee: { type: "rate", value: 2.2 },
    }),
    regional: Object.assign({}, BASE, {
      id: "regional", label: "地方銀行型",
      note: "地域の物件と勤務先をよく知る型。調整区域や勤続の短さにも個別に対応するが、カード枠は返済に算入して見る。",
      stressRate: 3.0, dti: [{ under: 300, max: 30 }, { under: Infinity, max: 35 }], multipleMax: 8, multipleHard: 10,
      tenureEmployee: 0.5, nonPR: "warn", allowChosei: true, cardLimitRate: 3, incomeBasis: "min2",
      guarantor: { type: "bank", label: "地方銀行の保証会社（系列・独立系）", lumpPer100: { A: 20000, B: 30000, C: 45000, D: 70000 } },
    }),
    shinkin: Object.assign({}, BASE, {
      id: "shinkin", label: "信用金庫型",
      note: "営業地域内に住む・勤める人が対象の会員制。一定額を超える借入は会員（出資金）になる。金庫の審査とは別に、系統の保証機関が保証審査をする。自営業や地元企業の勤務先にも個別に対応する。",
      stressRate: 3.0, dti: [{ under: 300, max: 30 }, { under: Infinity, max: 35 }], multipleMax: 8, multipleHard: 10,
      minIncome: 100, ageMin: 18, ageMax: 69, payoffAgeMax: 80, termMax: 35,
      contractOk: true, nonPR: "warn", allowChosei: true, allowLeasehold: true, incomeBasis: "min2",
      requireArea: true, memberThreshold: 700,
      guarantor: { type: "shinkin", label: "信用金庫の系統保証機関", lumpPer100: { A: 17000, B: 25000, C: 38000, D: 55000 } },
      guarantee: { A: { fee: 0.15, add: 0, label: "最優遇" }, B: { fee: 0.2, add: 0.1, label: "優遇" }, C: { fee: 0.25, add: 0.3, label: "優遇縮小" }, D: { fee: 0.35, add: 0.5, label: "個別判断" } },
    }),
    flat35: Object.assign({}, BASE, {
      id: "flat35", label: "フラット35型",
      note: "全期間固定。実際の金利で返済負担率を見て、勤続年数・雇用形態は問わない。団信は任意。物件は技術基準（適合証明）が必要。",
      stressRate: null, dti: [{ under: 400, max: 30 }, { under: Infinity, max: 35 }], multipleMax: Infinity, multipleHard: Infinity,
      minIncome: 0, tenureEmployee: 0, tenureSelf: 1, danshinRequired: false, incomeBasis: "latest", jointGuarantor: 100,
      minFloorHouse: 70, minFloorMansion: 30, allowChosei: true,
      guarantee: { A: { fee: 0, add: 0, label: "標準" }, B: { fee: 0, add: 0, label: "標準" }, C: { fee: 0, add: 0, label: "標準" }, D: { fee: 0, add: 0, label: "標準" } },
      docsExtra: ["適合証明書（検査機関が発行）"],
      isFlat: true, ageMax: 69, payoffAgeMax: 79, termMin: 15, loanMin: 100, loanMax: 8000, ltvBase: "price", ltvWithCosts: 100,
      requireNewQuake: true, highLtv: { over: 90, add: 0.11 },
      guarantor: { type: "none", label: "保証会社なし・保証人不要", lumpPer100: { A: 0, B: 0, C: 0, D: 0 } },
      adminFee: { type: "rate", value: 2.2 },
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

  return { POLICY_VERSION, PRESETS, GUARANTOR_NOTE, resolvePolicy };
});
