// お客様の保存（この端末のブラウザの中だけ。どこにも送らない）・消す・担当ごとに分ける
// 条件は共有リンクと同じ形（#s=…）で持つので、開くときは share.decode の検査を通る
// Node：require("./lib/customers")　ブラウザ：<script src="lib/customers.js"> で window.LHSCustomers
(function (root, factory) {
  const m = factory();
  if (typeof module === "object" && module.exports) module.exports = m;
  else root.LHSCustomers = m;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const KEY = "lhs_customers_v1";
  const NO_STAFF = "担当なし";
  const str = (v, max) => String(v == null ? "" : v).trim().slice(0, max);
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  function save(list, { id, name, staff, hash, now }) {
    const nm = str(name, 40);
    if (!nm) throw new Error("お客様のお名前を入れてください");
    const rec = { id: id || newId(), name: nm, staff: str(staff, 20), hash: str(hash, 4000), updated: now || new Date().toISOString() };
    const at = list.findIndex((v) => v.id === rec.id);
    return at < 0 ? [...list, rec] : list.map((v, k) => (k === at ? rec : v));
  }
  const remove = (list, id) => list.filter((v) => v.id !== id);
  const clear = () => [];

  // 担当の名前順（担当なしは最後）、各担当の中は新しい順
  function byStaff(list) {
    const m = new Map();
    for (const v of list) { const k = v.staff || NO_STAFF; if (!m.has(k)) m.set(k, []); m.get(k).push(v); }
    return [...m.entries()]
      .sort(([a], [b]) => (a === NO_STAFF) - (b === NO_STAFF) || a.localeCompare(b, "ja"))
      .map(([staff, items]) => ({ staff, items: items.slice().sort((a, b) => String(b.updated).localeCompare(String(a.updated))) }));
  }

  // 新しい順に n 人（入力の最初の画面の「続きから」）
  const recent = (list, n = 5) => list.slice().sort((a, b) => String(b.updated).localeCompare(String(a.updated))).slice(0, n);
  // 検索：名前・担当の一部。ひらがな／カタカナ・空白・大文字小文字を気にしない
  const fold = (v) => String(v || "").normalize("NFKC").replace(/\s+/g, "").toLowerCase().replace(/[\u3041-\u3096]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
  function search(list, q) {
    const k = fold(q);
    return k ? list.filter((v) => fold(v.name).includes(k) || fold(v.staff).includes(k)) : list.slice();
  }

  const serialize = (list) => JSON.stringify(list);
  // 壊れたデータや形の違うものは捨てる
  function parse(raw) {
    let a;
    try { a = JSON.parse(raw); } catch (e) { return []; }
    if (!Array.isArray(a)) return [];
    return a.filter((v) => v && typeof v === "object" && typeof v.id === "string" && typeof v.name === "string" && v.name.trim() && typeof v.hash === "string" && /^#/.test(v.hash))
      .map((v) => ({ id: v.id, name: str(v.name, 40), staff: str(v.staff, 20), hash: str(v.hash, 4000), updated: str(v.updated, 40) }));
  }
  return { KEY, NO_STAFF, save, remove, clear, byStaff, recent, search, serialize, parse };
});
