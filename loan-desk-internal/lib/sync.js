// 社外秘：お客様の一覧を、共有データ（claude.ai のページの db）と合わせるための純関数
// 共有データの行の名前は c＋16進8桁（FNV-1a）。中身は customers.js と同じきまりで整える
(function (root, factory) {
  const isNode = typeof module === "object" && module.exports;
  const C = isNode ? require("./customers.js") : root.LDI;
  const m = factory(C);
  if (isNode) module.exports = m;
  else Object.assign((root.LDI = root.LDI || {}), m);
})(typeof self !== "undefined" ? self : this, function (C) {
  "use strict";
  const COLLECTION = "customers";

  // お客様の id（姓|担当|掲載日）→ 共有データの行の名前（英数字だけ）
  function docId(id) {
    let h = 0x811c9dc5;
    for (const ch of String(id)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
    return "c" + h.toString(16).padStart(8, "0");
  }

  // synced: 前に同期した内容（docId → JSON 文字列）。customers: 今の一覧
  // 戻り値 sets（保存する行）・deletes（消す行）・next（書いたあとの同期の記録）。synced は書き換えない
  function diff(synced, customers) {
    const next = new Map(synced || []);
    const now = new Map((customers || []).map((c) => [docId(c.id), c]));
    const sets = [], deletes = [];
    for (const [k, c] of now) { const j = JSON.stringify(c); if (next.get(k) !== j) { next.set(k, j); sets.push({ docId: k, data: JSON.parse(j) }); } }
    for (const k of [...next.keys()]) if (!now.has(k)) { next.delete(k); deletes.push(k); }
    return { sets, deletes, next };
  }

  // docs: [{ id, data }]（共有データの行）→ 整えた一覧と、同期の記録
  // 整えた結果が元と違う行は、記録を整えた後の形にする（次の保存で直る）
  function fromSnapshot(docs) {
    const raw = (docs || []).map((d) => d.data).filter((x) => x && typeof x === "object");
    const r = C.importText([], C.exportText(raw));
    const customers = r.ok ? r.list : [];
    const synced = new Map(customers.map((c) => [docId(c.id), JSON.stringify(c)]));
    return { customers, synced };
  }

  function viewState(o) {
    const x = o || {};
    if (!x.shared) return { shared: false, readOnly: false, head: "お客様（この端末だけ）", msg: "下の名前・電話・住所は保存しません。呼び名と上の条件だけを、この端末に残します。" };
    const readOnly = x.canWrite === false;
    return {
      shared: true, readOnly, head: "お客様（全員で共有）",
      msg: readOnly
        ? "見るだけの権限です。お客様の保存・審査の履歴の追加・削除はできません。必要なら、このページの持ち主に「編集」できる権限を頼んでください。"
        : "このページを共有した全員が同じ一覧を見ます。下の名前・電話・住所は入れません。",
    };
  }

  function errorText(code) {
    if (code === "quota_exceeded") return "保存できる量の上限です。使わないお客様を消してください";
    if (code === "revoked" || code === "not_granted") return "保存できませんでした。このページを編集できる権限があるか確かめてください";
    return "全員の一覧に保存できませんでした。少し待ってからもう一度保存してください";
  }

  return { COLLECTION, docId, diff, fromSnapshot, viewState, errorText };
});
