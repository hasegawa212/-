// 社外秘：お客様の条件をこの端末に保存する（イニシャルだけ。名前・電話・住所は保存しない）
(function (root, factory) {
  const m = factory();
  if (typeof module === "object" && module.exports) module.exports = m;
  else Object.assign((root.LDI = root.LDI || {}), m);
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const KEY = "ldi_customers_v1";
  // 保存してよい入力（自由文は持たない）
  const FIELDS = { pref: "s", age: "n", income: "n", tenure: "n", employ: "s", loan: "n", debt: "n", rej: "n", single: "b", motive: "b", settle: "s", rejected: "a" };

  // イニシャル: ローマ字の大文字2〜3文字（区切りの . と空白は可）。漢字・かな・数字・長い文字列は名前や電話の可能性があるので断る
  function normInitials(s) {
    const t = String(s || "").normalize("NFKC").toUpperCase().replace(/[.\s・]/g, "");
    return /^[A-Z]{2,3}$/.test(t) ? t.split("").join(".") : null;
  }

  function clean(input) {
    const out = {};
    for (const [k, t] of Object.entries(FIELDS)) {
      const v = (input || {})[k];
      if (v == null) continue;
      if (t === "n" && Number.isFinite(+v)) out[k] = +v;
      else if (t === "b") out[k] = !!v;
      else if (t === "s" && typeof v === "string" && v.length <= 20) out[k] = v;
      else if (t === "a" && Array.isArray(v)) out[k] = v.filter((x) => typeof x === "string" && x.length <= 30).slice(0, 20);
    }
    return out;
  }

  // list: 今の一覧、row: {initials, staff, input}。同じイニシャル＋担当なら上書き
  function save(list, row, now) {
    const initials = normInitials(row && row.initials);
    if (!initials) return { ok: false, error: "イニシャルはローマ字2〜3文字で入れる（例: S.T）。名前は保存しない" };
    const staff = String((row && row.staff) || "").trim().slice(0, 10);
    if (/\d{3,}/.test(staff)) return { ok: false, error: "担当には名前だけを入れる" };
    const d = new Date(), z = (n) => String(n).padStart(2, "0");
    const at = now || `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`; // 端末の時刻
    const item = { id: `${initials}|${staff}`, initials, staff, input: clean(row.input), updated: at };
    const rest = (list || []).filter((x) => x.id !== item.id);
    return { ok: true, item, list: [item].concat(rest).slice(0, 200) };
  }
  const remove = (list, id) => (list || []).filter((x) => x.id !== id);

  function load(storage) {
    try { const v = JSON.parse((storage || localStorage).getItem(KEY) || "[]"); return Array.isArray(v) ? v.filter((x) => x && normInitials(x.initials)).map((x) => Object.assign({}, x, { input: clean(x.input) })) : []; } catch (e) { return []; }
  }
  function store(storage, list) { try { (storage || localStorage).setItem(KEY, JSON.stringify(list)); return true; } catch (e) { return false; } }

  return { KEY, FIELDS, normInitials, clean, save, remove, load, store };
});
