// 社外秘：お客様の条件をこの端末に保存する（イニシャルか姓だけ。下の名前・電話・住所は保存しない）
(function (root, factory) {
  const m = factory();
  if (typeof module === "object" && module.exports) module.exports = m;
  else Object.assign((root.LDI = root.LDI || {}), m);
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const KEY = "ldi_customers_v1";
  // 保存してよい入力（自由文は持たない）
  // posted = 相談シートの掲載日、flag = 未記入・個別判断、notes = 試算の前提（どれも作る側が書く短い文）
  const FIELDS = { pref: "s", age: "n", income: "n", tenure: "n", employ: "s", loan: "n", debt: "n", rej: "n", single: "b", motive: "b", settle: "s", rejected: "a", posted: "s", flag: "s", notes: "s" };
  const MAXLEN = { notes: 120, flag: 60 };

  // 呼び名: ローマ字のイニシャル2〜3文字（例 S.T）か、姓（漢字・かな1〜4文字）。
  // 下の名前まで入れない・数字（電話）や長い文字列は断る
  function normInitials(s) {
    const raw = String(s || "").normalize("NFKC").trim();
    const t = raw.toUpperCase().replace(/[.\s・]/g, "");
    if (/^[A-Z]{2,3}$/.test(t)) return t.split("").join(".");
    if (/^[\u3041-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uF900-\uFAFF々ヶ]{1,4}$/.test(raw)) return raw;
    return null;
  }

  function clean(input) {
    const out = {};
    for (const [k, t] of Object.entries(FIELDS)) {
      const v = (input || {})[k];
      if (v == null) continue;
      if (t === "n" && Number.isFinite(+v)) out[k] = +v;
      else if (t === "b") out[k] = !!v;
      else if (t === "s" && typeof v === "string" && v.length <= (MAXLEN[k] || 20)) out[k] = v;
      else if (t === "a" && Array.isArray(v)) out[k] = v.filter((x) => typeof x === "string" && x.length <= 30).slice(0, 20);
    }
    return out;
  }

  // list: 今の一覧、row: {initials, staff, input}。同じイニシャル＋担当なら上書き
  function save(list, row, now) {
    const initials = normInitials(row && row.initials);
    if (!initials) return { ok: false, error: "イニシャル（例: S.T）か姓（4文字まで）を入れる。下の名前・電話は保存しない" };
    const staff = String((row && row.staff) || "").trim().slice(0, 10);
    if (/\d{3,}/.test(staff)) return { ok: false, error: "担当には名前だけを入れる" };
    const d = new Date(), z = (n) => String(n).padStart(2, "0");
    const at = now || `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`; // 端末の時刻
    const input = clean(row.input);
    // 同じ姓・同じ担当の別のお客様がいるので、相談シートの掲載日も id に入れる
    const item = { id: `${initials}|${staff}|${input.posted || ""}`, initials, staff, input, updated: at };
    const rest = (list || []).filter((x) => x.id !== item.id);
    return { ok: true, item, list: [item].concat(rest).slice(0, 500) };
  }
  const remove = (list, id) => (list || []).filter((x) => x.id !== id);

  function load(storage) {
    try { const v = JSON.parse((storage || localStorage).getItem(KEY) || "[]"); return Array.isArray(v) ? v.filter((x) => x && normInitials(x.initials)).map((x) => Object.assign({}, x, { input: clean(x.input) })) : []; } catch (e) { return []; }
  }
  function store(storage, list) { try { (storage || localStorage).setItem(KEY, JSON.stringify(list)); return true; } catch (e) { return false; } }

  // 書き出し・読み込み（端末を移す／相談シートの全員を入れる）
  const KIND = "loan-desk-customers";
  const exportText = (list, date) => JSON.stringify({ kind: KIND, v: 1, exported: date || new Date().toISOString().slice(0, 10), items: list || [] }, null, 1);
  // 同じ id は updated が新しいほうを残す。形が違うファイルは断る
  function importText(list, text) {
    let d; try { d = JSON.parse(text); } catch (e) { return { ok: false, error: "読めないファイルです" }; }
    if (!d || d.kind !== KIND || !Array.isArray(d.items)) return { ok: false, error: "LOAN DESK 社内版のお客様ファイルではありません" };
    const map = new Map((list || []).map((x) => [x.id, x]));
    let added = 0, updated = 0, skipped = 0;
    for (const it of d.items) {
      const r = save([], { initials: it && it.initials, staff: it && it.staff, input: it && it.input }, (it && it.updated) || "");
      if (!r.ok) { skipped++; continue; }
      const old = map.get(r.item.id);
      if (!old) { map.set(r.item.id, r.item); added++; }
      else if ((r.item.updated || "") > (old.updated || "")) { map.set(r.item.id, r.item); updated++; }
    }
    const merged = [...map.values()].sort((a, b) => (b.updated || "").localeCompare(a.updated || "")).slice(0, 500);
    return { ok: true, list: merged, added, updated, skipped };
  }
  // 探す: 呼び名・担当・県（ひらがな/カタカナ・大文字小文字を区別しない）
  const fold = (s) => String(s || "").normalize("NFKC").toUpperCase().replace(/[\u3041-\u3096]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60)).replace(/[.\s]/g, "");
  const search = (list, q) => { const k = fold(q); return k ? (list || []).filter((x) => fold(`${x.initials} ${x.staff} ${x.input.pref || ""}`).includes(k)) : list || []; };
  const staffs = (list) => [...new Set((list || []).map((x) => x.staff).filter(Boolean))].sort();

  return { KEY, KIND, FIELDS, normInitials, clean, save, remove, load, store, exportText, importText, search, staffs };
});
