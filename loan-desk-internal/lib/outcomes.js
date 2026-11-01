// 社外秘：否決の記録から、金融機関ごとの通過率（事前・本審査・単身）と否決の理由を出す
// 記録 = 当社の集計（data/outcomes.js）＋ この端末で足した記録（名前なし。金融機関・段階・結果・理由・単身かだけ）
(function (root, factory) {
  const isNode = typeof module === "object" && module.exports;
  const m = factory();
  if (isNode) module.exports = m;
  else Object.assign((root.LDI = root.LDI || {}), m);
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  // 否決の理由（銀行審査状況パイプライン運用ガイド 6章のタグ＋保証会社・業者・信用情報）
  const REASONS = {
    property_road_access: "接道",
    property_atemono: "充て物（物件の評価）",
    property_kakaku: "物件の評価・価格",
    borrower_employment: "雇用の書類・雇用形態",
    borrower_single: "単身者",
    borrower_dansin_kokuji: "団信の告知",
    borrower_cic: "信用情報",
    guarantor: "保証会社の判断",
    dealer: "業者（売主・仲介）の審査",
    unknown: "理由の記録なし",
  };
  // 表記ゆれ（社内の記録の書き方）→ data/lenders.js の名前
  const ALIAS = { "SBIアルヒ銀行": "SBIアルヒ", "鹿沼相互信用金庫": "鹿沼信用金庫", "栃木信用金庫": "栃木銀行", "JA常陸": "JA" };
  const normLender = (s) => ALIAS[String(s || "").trim()] || String(s || "").trim();

  // 古いタグと備考から、REASONS のキーに寄せる
  function reasonOf(tag, note) {
    const n = String(note || "");
    if (/業者NG/.test(n)) return "dealer";
    if (/接道/.test(n)) return "property_road_access";
    if (/充て物|あて物/.test(n)) return "property_atemono";
    const t = String(tag || "");
    if (REASONS[t] && t !== "unknown") return t;
    const MAP = { property_collateral: "property_kakaku", employment: "borrower_employment", single: "borrower_single", danshin: "borrower_dansin_kokuji", cic: "borrower_cic" };
    if (MAP[t]) return MAP[t];
    if (/単身/.test(n)) return "borrower_single";
    if (/保証会社NG|保証会社.*否決|保証NG/.test(n)) return "guarantor";
    if (/雇用契約/.test(n)) return "borrower_employment";
    if (/土地評価|物件での否決|物件の評価/.test(n)) return "property_kakaku";
    return "unknown";
  }

  const blank = () => ({ pre: { pass: 0, reject: 0 }, main: { pass: 0, reject: 0 }, single: { pass: 0, reject: 0 }, reasons: {} });

  // 足した記録の形を確かめる（名前・電話・自由文は受け付けない）
  function validRecord(r) {
    if (!r || typeof r !== "object") return false;
    if (typeof r.lender !== "string" || !r.lender || r.lender.length > 30) return false;
    if (!["pre", "main"].includes(r.stage) || !["pass", "reject"].includes(r.result)) return false;
    if (r.result === "reject" && !REASONS[r.reason]) return false;
    if (typeof r.single !== "boolean") return false;
    const extra = Object.keys(r).filter((k) => !["lender", "stage", "result", "reason", "single", "month"].includes(k));
    if (extra.length) return false;
    if (r.month != null && !/^\d{4}-\d{2}$/.test(r.month)) return false;
    return true;
  }

  // 集計に足した記録を加える（元の集計は書き換えない）
  function merge(base, records) {
    const out = {};
    for (const [k, v] of Object.entries(base || {})) out[k] = JSON.parse(JSON.stringify(v));
    for (const r of records || []) {
      if (!validRecord(r)) continue;
      const name = normLender(r.lender);
      const o = (out[name] = out[name] || blank());
      o[r.stage][r.result]++;
      if (r.single) o.single[r.result]++;
      if (r.result === "reject") o.reasons[r.reason] = (o.reasons[r.reason] || 0) + 1;
    }
    return out;
  }

  const sum = (a, b) => ({ pass: a.pass + b.pass, reject: a.reject + b.reject });
  const rateText = (c) => { const n = c.pass + c.reject; return n ? `${n}件中 通過${c.pass}（${Math.round((c.pass / n) * 100)}%）` : "記録なし"; };

  // 金融機関ごとの見え方: 全体・事前・本審査・単身・否決の理由（多い順）
  function statsOf(o) {
    o = o || blank();
    const all = sum(o.pre, o.main);
    const reasons = Object.entries(o.reasons).sort((a, b) => b[1] - a[1]).map(([key, n]) => ({ key, label: REASONS[key] || key, n }));
    return { all, pre: o.pre, main: o.main, single: o.single, reasons, text: { all: rateText(all), pre: rateText(o.pre), main: rateText(o.main), single: rateText(o.single) } };
  }

  // 実績データ（lenders.js）の pass/reject を集計で上書きした一覧を返す
  function applyOutcomes(lenders, outcomes) {
    return lenders.map((l) => {
      const o = outcomes[l.name];
      if (!o) return l;
      const all = sum(o.pre, o.main);
      return Object.assign({}, l, { pass: all.pass, reject: all.reject, stats: statsOf(o) });
    });
  }

  // 全体の否決の理由（多い順）と、理由の記録がある割合
  function reasonSummary(outcomes) {
    const t = {}; let n = 0;
    for (const o of Object.values(outcomes)) for (const [k, v] of Object.entries(o.reasons)) { t[k] = (t[k] || 0) + v; n += v; }
    const list = Object.entries(t).sort((a, b) => b[1] - a[1]).map(([key, c]) => ({ key, label: REASONS[key] || key, n: c }));
    const known = n - (t.unknown || 0);
    return { total: n, known, list, coverage: n ? known / n : 0 };
  }

  return { REASONS, ALIAS, normLender, reasonOf, validRecord, merge, statsOf, applyOutcomes, reasonSummary };
});
