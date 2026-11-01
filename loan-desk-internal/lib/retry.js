// 社外秘：否決されたお客様の「再挑戦」計画
// いつ出せるか（申込情報が信用情報に残る期間）・どこに出さないか（否決済み＋同じ保証会社）・次の順番・直すこと
// 根拠: 申込情報の登録期間 CIC・JICC 6か月／KSC（全国銀行個人信用情報センター）1年（各機関の公表による）、
//       銀行審査状況パイプライン運用ガイド 6章（連続3件否決 → 方向性を見直す）、銀行事前申込対応マニュアル（他行審査は正直に開示）
(function (root, factory) {
  const isNode = typeof module === "object" && module.exports;
  const R = isNode ? Object.assign({}, require("./recommend.js"), require("./outcomes.js")) : root.LDI;
  const m = factory(R);
  if (isNode) module.exports = m;
  else Object.assign((root.LDI = root.LDI || {}), m);
})(typeof self !== "undefined" ? self : this, function (R) {
  "use strict";
  const HOLD_MONTHS = 6;   // CIC・JICC の申込情報
  const KSC_MONTHS = 12;   // KSC（銀行）の照会記録

  const ym = (s) => { const m = /^(\d{4})-(\d{2})/.exec(String(s || "")); return m ? +m[1] * 12 + (+m[2] - 1) : null; };
  const ymText = (n) => `${Math.floor(n / 12)}年${(n % 12) + 1}月`;
  const ymIso = (n) => `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, "0")}`;

  // 否決の理由ごとに、再挑戦の前に直すこと
  const FIX = {
    property_road_access: "物件を変える（接道2m以上・公道に面する物件）。同じ物件では通りにくい",
    property_atemono: "物件の評価（充て物）が出るかを、出す前に金融機関に相談する。出なければ物件を変える",
    property_kakaku: "借入額を物件の評価に合わせる（頭金・価格の見直し）か、評価の出る物件に変える",
    borrower_employment: "雇用契約書をそろえる（ない場合は在籍証明書・就業条件明示書）。勤続が短ければ伸びるのを待つ",
    borrower_single: "購入動機書を付ける（勤務先・地元とのつながり・この家を選んだ理由・将来の計画）",
    borrower_dansin_kokuji: "団信の告知を確かめる。ワイド団信や団信なしで組める商品（フラット35型）を検討する",
    borrower_cic: "本人開示（CIC・JICC・KSC）で記録を確かめ、延滞・異動があれば解消と経過を待つ",
    guarantor: "否決した保証会社とは別の保証会社の金融機関に出す",
    dealer: "保証会社が業者（売主・仲介）を見ている。当社と仲介の関係を最初から開示し、別の保証会社の金融機関に出す",
    unknown: "否決の理由を金融機関・担当者に確かめる（分からないまま次に出さない）",
  };

  // history: [{ lender, stage: pre|main, result: pass|reject, month: YYYY-MM, reason }]
  function retryPlan(x, history, opts) {
    const o = opts || {};
    const today = ym(o.today) != null ? ym(o.today) : (() => { const d = new Date(); return d.getFullYear() * 12 + d.getMonth(); })();
    const hist = (history || []).filter((h) => h && h.lender).map((h) => Object.assign({}, h, { lender: R.normLender(h.lender) }));
    const rejects = hist.filter((h) => h.result === "reject");
    const months = hist.map((h) => ym(h.month)).filter((n) => n != null);
    const last = months.length ? Math.max(...months) : null;
    const lastReject = rejects.map((h) => ym(h.month)).filter((n) => n != null);
    const recent = rejects.filter((h) => ym(h.month) != null && today - ym(h.month) < HOLD_MONTHS).length;
    const undated = rejects.filter((h) => ym(h.month) == null).length;

    // いつ出せるか: 最後の申込みから6か月（銀行の KSC は1年）
    const from = last != null ? last + HOLD_MONTHS : null;
    const fromBank = last != null ? last + KSC_MONTHS : null;
    let when;
    if (last == null) when = { status: "unknown", text: "申込みの月が分からない。本人開示（CIC・JICC）で申込みの記録が残っているか先に確かめる" };
    else if (today >= from) when = { status: "now", text: `今から出せる（最後の申込み ${ymText(last)} から6か月たった）${today < fromBank ? `。ただし銀行の KSC には ${ymText(fromBank)} まで照会の記録が残る` : ""}` };
    else when = { status: "wait", text: `${ymText(from)} から（最後の申込み ${ymText(last)} の記録が信用情報に6か月残る）。それまでは出さずに、下の「直すこと」を進める` };

    // 次の順番: 否決済みの金融機関と、その保証会社だけの金融機関は外す。直近6か月の否決数を審査エンジンに入れる
    const priorRejects = recent + undated;
    // 同じ金融機関で否決のあとに通っていれば（例: 条件を変えて事前審査が通った）、そこは外さない
    const lastAt = {};
    hist.slice().sort((a, b) => (ym(a.month) ?? -1) - (ym(b.month) ?? -1)).forEach((h) => { lastAt[h.lender] = h.result; });
    const rejectedLenders = Object.keys(lastAt).filter((l) => lastAt[l] === "reject");
    const input = Object.assign({}, x, { rejectedLenders, priorRejects: Math.max(priorRejects, x.priorRejects || 0) });
    const rec = R.recommend(input, { records: o.records || [], today: o.today });
    // 再挑戦は「出せるようになってから」計算する: 待つ間は直近の否決が減ったあとの姿も見せる
    const after = when.status === "wait" ? R.recommend(Object.assign({}, input, { priorRejects: 0 }), { records: o.records || [], today: o.today }) : null;

    // 直すこと（理由の重い順）＋否決の回数に応じた見直し
    const reasons = {};
    rejects.forEach((h) => { const k = FIX[h.reason] ? h.reason : "unknown"; reasons[k] = (reasons[k] || 0) + 1; });
    const fixes = Object.entries(reasons).sort((a, b) => (a[0] === "unknown") - (b[0] === "unknown") || b[1] - a[1]).map(([k, n]) => ({ key: k, label: (R.REASONS || {})[k] || k, n, text: FIX[k] }));
    if (rejects.length >= 3) fixes.unshift({ key: "many", n: rejects.length, label: `否決 ${rejects.length}件`, text: "否決が3件以上続いている。同じ条件のまま次に出さず、借入額・物件・時期のどれを変えるかを決めてから出す（銀行審査状況パイプライン運用ガイド 6章）" });
    if (x.single && !x.motiveDoc && !reasons.borrower_single) fixes.push({ key: "motive", label: "単身", n: 0, text: FIX.borrower_single });

    const passed = hist.some((h) => h.result === "pass" && h.stage === "main");
    return {
      rejects: rejects.length, recent, last: last != null ? ymIso(last) : "", from: from != null ? ymIso(from) : "", when, passed,
      exclude: rec.excluded, avoid: rec.avoid, next: rec.planItems, nextAfterWait: after ? after.planItems : null, rejectedGuarantors: rec.rejectedGuarantors,
      fixes, prepare: rec.prepare,
      tell: "前に否決されたこと・他の金融機関に出していることは、聞かれたら正直に伝える（信用情報で分かる。隠すと信用を失う）",
      rule: "再挑戦も1行ずつ。否決されたら理由を確かめてから次に出す",
      note: "目安。申込情報の残る期間は各信用情報機関の公表によるもので、出す前に本人開示で確かめる。決めるのは金融機関と保証会社",
    };
  }

  return { HOLD_MONTHS, KSC_MONTHS, FIX, retryPlan };
});
