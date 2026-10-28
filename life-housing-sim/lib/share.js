// 共有リンク：条件を URL の # 以降に入れる（# 以降はサーバーに送られない）。お客様の名前は入れない
// Node：require("./lib/share")　ブラウザ：<script src="lib/share.js"> で window.LHSShare
(function (root, factory) {
  const m = factory();
  if (typeof module === "object" && module.exports) module.exports = m;
  else root.LHSShare = m;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const NULLABLE = new Set(["family.marryAge"]);
  // 文字の項目は決まった選択肢だけ受け付ける
  const ENUMS = { job: ["employee", "self"], "own.kind": ["new_cert", "new_zeh", "new_energy", "used_zeh", "used_energy", "used_other", "none"] };
  const MAX = 1e9; // ありえない金額は受け付けない
  const b64e = (s) => (typeof btoa === "function" ? btoa(s) : Buffer.from(s, "binary").toString("base64")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const b64d = (s) => {
    const t = s.replace(/-/g, "+").replace(/_/g, "/");
    return typeof atob === "function" ? atob(t) : Buffer.from(t, "base64").toString("binary");
  };
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // 初期値と違う項目だけを取り出す
  function diff(cur, def) {
    const out = {};
    for (const k of Object.keys(def)) {
      const a = cur[k], b = def[k];
      if (b && typeof b === "object") {
        const d = diff(a || {}, b);
        if (Object.keys(d).length) out[k] = d;
      } else if (a !== b) out[k] = a;
    }
    return out;
  }
  // 初期値の形にあう項目だけを取り込む（知らない項目・型違い・範囲外は無視）
  function merge(target, src, path) {
    if (!src || typeof src !== "object") return;
    for (const k of Object.keys(target)) {
      if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
      const p = path ? path + "." + k : k, v = src[k], t = target[k];
      if (t && typeof t === "object") merge(t, v, p);
      else if (typeof t === "boolean" && typeof v === "boolean") target[k] = v;
      else if (ENUMS[p]) { if (ENUMS[p].includes(v)) target[k] = v; }
      else if (v === null && NULLABLE.has(p)) target[k] = null;
      else if ((typeof t === "number" || NULLABLE.has(p)) && typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= MAX) target[k] = v;
    }
  }

  // keep：初期値と同じでも必ず入れる項目（お客様ごとに選んだ項目。開いた側で「未入力」と区別するため）
  function encode(state, { step = 0, present = false, defaults, keep = [] } = {}) {
    const def = defaults || (typeof LHS !== "undefined" ? LHS.defaults() : require("./engine").defaults());
    const parts = [];
    const d = diff(state, def);
    for (const p of keep) {
      const ks = p.split("."); let a = d, v = state;
      for (const k of ks) v = v == null ? v : v[k];
      if (v === undefined) continue;
      ks.slice(0, -1).forEach((k) => (a = a[k] = a[k] || {}));
      a[ks.at(-1)] = v;
    }
    if (Object.keys(d).length) parts.push("s=" + b64e(JSON.stringify(d)));
    if (step) parts.push("step=" + step, "v=2"); // v=2：先頭に「¥」が入った並び（それより前のリンクは1つずらして開く）
    if (present) parts.push("p=1");
    return "#" + parts.join("&");
  }

  const LAST_STEP = 9; // ¥・⓪〜⑧
  function decode(hash, defaults) {
    const state = clone(defaults);
    let step = 0, present = false, raw = null, v2 = false;
    const q = String(hash || "").replace(/^#/, "");
    for (const kv of q.split("&")) {
      const [k, v = ""] = kv.split("=");
      if (k === "s") { try { merge(state, JSON.parse(b64d(decodeURIComponent(v))), ""); } catch (e) { /* 壊れたリンクは初期値で開く */ } }
      if (k === "step") raw = Number(v);
      if (k === "v") v2 = v === "2";
      if (k === "p") present = v === "1";
    }
    if (raw != null) { const n = v2 ? raw : raw + 1; if (Number.isInteger(n) && n >= 0 && n <= LAST_STEP) step = n; }
    return { state, step, present };
  }
  return { encode, decode };
});
