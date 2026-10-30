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

  // ほかの端末へ移す：ファイルに書き出す → 別の端末で読み込む（サーバーには送らない）
  const APP = "LIFE ROUTE";
  const exportText = (list, now) => JSON.stringify({ app: APP, kind: "customers", v: 1, exported: now || new Date().toISOString(), items: list }, null, 1);
  // 今の一覧に足す。同じ id は更新日の新しいほうを残す。形の違うファイルは受け付けない
  function importText(list, text) {
    let d;
    try { d = JSON.parse(text); } catch (e) { return { ok: false, list, error: "ファイルを読めませんでした（LIFE ROUTE で書き出したファイルを選んでください）" }; }
    if (!d || d.app !== APP || d.kind !== "customers" || !Array.isArray(d.items)) return { ok: false, list, error: "LIFE ROUTE の「保存したお客様」のファイルではありません" };
    const items = parse(JSON.stringify(d.items));
    let added = 0, updated = 0;
    const out = list.slice();
    for (const v of items) {
      const at = out.findIndex((r) => r.id === v.id);
      if (at < 0) { out.push(v); added++; }
      else if (String(v.updated) > String(out[at].updated)) { out[at] = v; updated++; }
    }
    return { ok: true, list: out, added, updated, skipped: items.length - added - updated };
  }

  // 担当者アカウント（この端末の中だけ・パスワードなし）。今の担当で保存し、一覧は「自分のお客様」から
  const STAFF_KEY = "lhs_staff_v1";
  function staffParse(raw) {
    let d; try { d = JSON.parse(raw); } catch (e) { d = null; }
    const list = d && Array.isArray(d.list) ? [...new Set(d.list.map((v) => str(v, 20)).filter(Boolean))] : [];
    const cur = d ? str(d.current, 20) : "";
    return { current: list.includes(cur) ? cur : "", list };
  }
  function staffAdd(s, name) {
    const n = str(name, 20);
    if (!n) throw new Error("担当者の名前を入れてください");
    return { current: n, list: s.list.includes(n) ? s.list.slice() : [...s.list, n] };
  }
  const staffUse = (s, name) => (s.list.includes(name) ? { current: name, list: s.list.slice() } : s);
  const staffRemove = (s, name) => ({ current: s.current === name ? "" : s.current, list: s.list.filter((v) => v !== name) });
  const mine = (list, staff) => (staff ? list.filter((v) => v.staff === staff) : list.slice());

  const serialize = (list) => JSON.stringify(list);
  // 壊れたデータや形の違うものは捨てる
  function parse(raw) {
    let a;
    try { a = JSON.parse(raw); } catch (e) { return []; }
    if (!Array.isArray(a)) return [];
    return a.filter((v) => v && typeof v === "object" && typeof v.id === "string" && typeof v.name === "string" && v.name.trim() && typeof v.hash === "string" && /^#/.test(v.hash))
      .map((v) => ({ id: v.id, name: str(v.name, 40), staff: str(v.staff, 20), hash: str(v.hash, 4000), updated: str(v.updated, 40) }));
  }
  return { KEY, NO_STAFF, STAFF_KEY, staffParse, staffAdd, staffUse, staffRemove, mine, save, remove, clear, byStaff, recent, search, exportText, importText, serialize, parse };
});
