// 役割マップ：data（people / tasks）→ 人ごとの仕事・担当なし・1人だけ・代表に集中・部門別・席別
// ルールはこのファイルだけ。画面（index.html）とレポート（tools/report.js）は表示するだけ
(function (root, factory) {
  const m = factory();
  if (typeof module === "object" && module.exports) module.exports = m;
  else root.RM = m;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const AREAS = ["営業", "仕入れ・業務", "管理", "経営", "全社"];
  const FREQS = ["毎日", "毎週", "都度", "毎月", "単発"];          // 並べる順＝重い順
  const WEIGHT = { 毎日: 5, 毎週: 3, 都度: 2, 毎月: 1, 単発: 1 };
  const STATUS = ["在籍", "新人", "業務委託", "外部", "退職"];
  const INACTIVE = ["退職", "外部"];
  const CONF = ["確認", "推測"];

  const rank = (t) => FREQS.indexOf(t.freq);
  const byFreq = (list) => list.map((t, i) => [t, i]).sort((x, y) => rank(x[0]) - rank(y[0]) || x[1] - y[1]).map((x) => x[0]);
  const active = (d) => d.people.filter((p) => !INACTIVE.includes(p.status));
  const helpersOf = (t) => t.helpers || [];

  function validate(d) {
    const errs = [];
    const ids = new Set(d.people.map((p) => p.id));
    const seenP = new Set();
    for (const p of d.people) {
      if (seenP.has(p.id)) errs.push(`${p.id}: 人のIDが重複`);
      seenP.add(p.id);
      if (!STATUS.includes(p.status)) errs.push(`${p.id}: status が不正（${p.status}）`);
    }
    const seen = new Set();
    for (const t of d.tasks) {
      if (seen.has(t.id)) errs.push(`${t.id}: 仕事のIDが重複`);
      seen.add(t.id);
      if (t.owner != null && !ids.has(t.owner)) errs.push(`${t.id}: 存在しない人 ${t.owner}`);
      for (const h of helpersOf(t)) if (!ids.has(h)) errs.push(`${t.id}: 存在しない人 ${h}`);
      if (t.owner != null && helpersOf(t).includes(t.owner)) errs.push(`${t.id}: 主と副に同じ人（${t.owner}）`);
      if (!Array.isArray(t.evidence) || t.evidence.length === 0) errs.push(`${t.id}: 根拠（evidence）がない`);
      else for (const e of t.evidence) if (!e.channel || !e.date) errs.push(`${t.id}: 根拠にチャンネルか日付がない`);
      if (!AREAS.includes(t.area)) errs.push(`${t.id}: area が不正（${t.area}）`);
      if (!FREQS.includes(t.freq)) errs.push(`${t.id}: freq が不正（${t.freq}）`);
      if (t.confidence && !CONF.includes(t.confidence)) errs.push(`${t.id}: confidence が不正（${t.confidence}）`);
    }
    return errs;
  }

  // 重さの判定は「主担当の仕事」だけで決める（全員でやる共通業務の手伝いで全員が重いにならないように）
  function level(mainCount, mainWeight) {
    if (mainCount >= 6 || mainWeight >= 20) return "重い";
    if (mainCount <= 1) return "軽い";
    return "ふつう";
  }

  function byPerson(d) {
    return active(d)
      .map((person) => {
        const main = byFreq(d.tasks.filter((t) => t.owner === person.id));
        const help = byFreq(d.tasks.filter((t) => helpersOf(t).includes(person.id)));
        const sum = (list) => list.reduce((s, t) => s + (WEIGHT[t.freq] || 0), 0);
        const mainWeight = sum(main);
        const weight = mainWeight + sum(help);
        return { person, main, help, counts: { main: main.length, help: help.length, total: main.length + help.length }, weight, mainWeight, level: level(main.length, mainWeight) };
      })
      .sort((x, y) => y.mainWeight - x.mainWeight || y.counts.main - x.counts.main || y.weight - x.weight);
  }

  const gaps = (d) => byFreq(d.tasks.filter((t) => t.owner == null));
  const single = (d) => byFreq(d.tasks.filter((t) => t.owner != null && helpersOf(t).length === 0));
  const ceoLoad = (d, ceoId) => byFreq(d.tasks.filter((t) => t.owner === ceoId));

  function byArea(d) {
    const out = {};
    for (const t of d.tasks) {
      const a = (out[t.area] = out[t.area] || { tasks: 0, gaps: 0, single: 0 });
      a.tasks++;
      if (t.owner == null) a.gaps++;
      else if (helpersOf(t).length === 0) a.single++;
    }
    return out;
  }

  function bySeat(d) {
    const out = {};
    for (const t of d.tasks) {
      if (!t.seat) continue;
      const s = (out[t.seat] = out[t.seat] || { tasks: [], people: [] });
      s.tasks.push(t);
      for (const p of [t.owner, ...helpersOf(t)]) if (p != null && !s.people.includes(p)) s.people.push(p);
    }
    return out;
  }

  function summary(d, ceoId) {
    return {
      people: active(d).length,
      tasks: d.tasks.length,
      gaps: gaps(d).length,
      single: single(d).length,
      ceo: ceoLoad(d, ceoId).length,
      guess: d.tasks.filter((t) => t.confidence === "推測").length,
    };
  }

  const nameOf = (d, id) => (d.people.find((p) => p.id === id) || { name: id || "（担当なし）" }).name;

  return { AREAS, FREQS, WEIGHT, STATUS, INACTIVE, validate, byPerson, gaps, single, ceoLoad, byArea, bySeat, summary, nameOf };
});
