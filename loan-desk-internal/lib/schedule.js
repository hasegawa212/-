// 社外秘：決済の日から逆算して、いつまでに何をすれば間に合うかを出す（社内の目安）
// 目安の出典: 銀行審査状況パイプライン運用ガイド 2.2（事前→本承認 1〜3週、本承認→金消 2〜4週、金消→決済 1〜4週）、
//             単身者の信用金庫と仲介会社の選定 5章（信金は事前・本審査が各1〜2週、全体で約4週）
// 長いほうの目安で逆算する（短く見て間に合わなくなるのを防ぐ）。決めるのは金融機関で、日数は約束ではない
(function (root, factory) {
  const m = factory();
  if (typeof module === "object" && module.exports) module.exports = m;
  else Object.assign((root.LDI = root.LDI || {}), m);
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  // 週。docs = 書類をそろえる、pre = 事前審査、main = 本申込→本承認、kinsho = 本承認→金消、settle = 金消→決済
  const LEAD = {
    shinkin:  { label: "信用金庫型", docs: 1, pre: 2, main: 2, kinsho: 1, settle: 1 },
    rokin:    { label: "労働金庫型", docs: 1, pre: 2, main: 2, kinsho: 1, settle: 1 },
    regional: { label: "地方銀行型", docs: 1, pre: 1, main: 2, kinsho: 1, settle: 1 },
    megabank: { label: "都市銀行型", docs: 1, pre: 1, main: 2, kinsho: 1, settle: 1 },
    net:      { label: "ネット銀行型", docs: 1, pre: 1, main: 3, kinsho: 1, settle: 1 },
    flat35:   { label: "フラット35型", docs: 1, pre: 1, main: 3, kinsho: 1, settle: 1 },
  };
  const DAY = 86400000;
  const toDate = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "")); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; };
  const fmt = (d) => d.toISOString().slice(0, 10);
  const jp = (d) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}（${"日月火水木金土"[d.getUTCDay()]}）`;
  // 土日に当たったら前の金曜に寄せる（金融機関の営業日に合わせる）
  const weekday = (d) => { const w = d.getUTCDay(); return w === 6 ? new Date(+d - DAY) : w === 0 ? new Date(+d - 2 * DAY) : d; };
  const back = (d, weeks) => weekday(new Date(+d - weeks * 7 * DAY));

  // 決済月（YYYY-MM）だけなら、その月の25日を決済の目安にする（月末は金融機関が混むため）
  function settleDateOf(v) {
    if (toDate(v)) return toDate(v);
    const m = /^(\d{4})-(\d{2})$/.exec(String(v || ""));
    return m ? weekday(new Date(Date.UTC(+m[1], +m[2] - 1, 25))) : null;
  }

  // retry: 否決されたら次の金融機関に出す余裕（事前審査1回分）を見込むか
  function schedule(opts) {
    const o = opts || {};
    const settle = settleDateOf(o.settle);
    if (!settle) return null;
    const lead = LEAD[o.type] || LEAD.regional;
    const today = toDate(o.today) || new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
    const kinsho = back(settle, lead.settle);
    const main = back(kinsho, lead.kinsho + lead.main);   // 本申込の最終日
    const pre = back(main, lead.pre);                      // 事前審査を出す最終日
    const docs = back(pre, lead.docs);                     // 物件を決めて書類をそろえ始める日
    const retryPre = back(pre, lead.pre);                  // 1回否決されても次に出せる、最初の事前審査の最終日
    const steps = [
      { key: "docs", label: "物件を決めて、書類をそろえ始める", date: docs },
      { key: "pre", label: "事前審査を出す", date: pre },
      { key: "main", label: "本申込みを出す", date: main },
      { key: "kinsho", label: "金消契約", date: kinsho },
      { key: "settle", label: "決済・引き渡し", date: settle },
    ].map((s) => Object.assign(s, { iso: fmt(s.date), text: jp(s.date), late: s.date < today, days: Math.round((s.date - today) / DAY) }));
    const firstOpen = steps.find((s) => !s.late);
    let status, message;
    if (steps[1].late && !(o.done && o.done.pre)) { status = "late"; message = `事前審査の目安の日（${steps[1].text}）を過ぎています。決済を翌月にずらすか、金融機関に日程を相談する`; }
    else if (o.retry && retryPre < today) { status = "tight"; message = `間に合うが、否決されたときに次の金融機関へ出す余裕はない（その余裕を取るなら ${jp(retryPre)} までに事前審査）`; }
    else { status = "ok"; message = o.retry ? `間に合う。${jp(retryPre)} までに事前審査を出せば、否決されても次の金融機関に出す余裕がある` : "間に合う"; }
    return { type: o.type in LEAD ? o.type : "regional", label: lead.label, weeks: lead.docs + lead.pre + lead.main + lead.kinsho + lead.settle, steps, retryPre: { iso: fmt(retryPre), text: jp(retryPre) }, next: firstOpen ? firstOpen.label : "", status, message,
      note: "社内の目安（長いほうの日数で逆算）。金融機関・時期（3月・9月・年末は混む）で変わるので、出す前に担当者に確認する" };
  }

  return { LEAD, schedule, settleDateOf };
});
