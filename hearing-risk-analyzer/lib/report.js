// 分析結果 → Markdown（Slack・社内共有・印刷用）。CLI と画面の「Markdownをコピー」で使う
(function (root, factory) {
  const m = factory(typeof module === "object" && module.exports ? require("./analyze") : root.HRA);
  if (typeof module === "object" && module.exports) module.exports = m;
  else Object.assign((root.HRA = root.HRA || {}), m);
})(typeof self !== "undefined" ? self : this, function (A) {
  "use strict";
  const { man, pct } = A;
  const MARK = { 高: "🔴 高", 中: "🟡 中", 低: "⚪ 低" };

  function toMarkdown(h, a) {
    const n = a.numbers, out = [];
    const high = a.risks.filter((r) => r.level === "高").length;
    out.push(`# 商談ヒアリング分析　${h.date || ""}`);
    out.push("");
    out.push(`> ${h.age ? h.age + "歳・" : ""}${a.customer.employer || ""}／動機：${a.customer.motive || "—"}／商談ランク ${a.customer.rank || "—"}・交渉 ${a.customer.negotiations || "—"}回目`);
    out.push(`> **将来のリスク ${a.risks.length}件（うち高 ${high}件）／強み ${a.strengths.length}件／今の段階の書類 ${a.docs.stages[0] ? a.docs.stages[0].done + "/" + a.docs.stages[0].total : "—"}**`);
    out.push("");
    out.push("## 1. 数字の目安（概算）");
    out.push("");
    out.push("| 項目 | 目安 |");
    out.push("|---|---|");
    out.push(`| 年収（直近／低い年） | ${man(n.incomeLatest)}／${man(n.incomeLow)} |`);
    if (n.monthly) {
      out.push(`| 希望の毎月の返済＋ボーナス払い | ${man(n.monthly)}＋各${man(n.bonusEach)}（年${man(n.monthly * 12 + n.bonusEach * 2)}） |`);
      for (const l of n.loanAt) out.push(`| 借りられる額の目安（金利${(l.rate * 100).toFixed(1)}%・${n.years}年） | **${man(l.amount)}** |`);
      out.push(`| 返済比率（直近の年収／低い年の年収） | ${pct(n.ratioLatest)}／${pct(n.ratioLow)}${n.carMonthly ? `（車の返済 月${man(n.carMonthly)} を含む）` : ""} |`);
    }
    if (n.monthlyUp != null) out.push(`| 今の家賃からの増え方 | 毎月＋${man(n.monthlyUp)} |`);
    if (n.savings != null) out.push(`| 貯金・手付金 | ${man(n.savings)} |`);
    if (n.payoffAge) out.push(`| 完済の年齢 | ${n.payoffAge}歳 |`);
    out.push("");
    out.push("前提：" + n.assumptions.join("／"));
    out.push("");
    out.push("## 2. 強み（審査・将来でプラス）");
    out.push("");
    for (const s of a.strengths) out.push(`- **${s.evidence}**：${s.text}`);
    if (!a.strengths.length) out.push("- （ヒアリングから読み取れる強みはまだありません）");
    out.push("");
    out.push("## 3. 将来のリスクと、不動産の価値の伝え方");
    out.push("");
    a.risks.forEach((r, i) => {
      out.push(`### ${i + 1}. ${r.title}　${MARK[r.level]}（${r.area}）`);
      out.push(`- **根拠（ヒアリング）**：${r.evidence}`);
      out.push(`- **将来どうなるか**：${r.future}`);
      out.push(`- **不動産の価値の伝え方**：${r.value}`);
      out.push(`- **確認すること**：${r.ask}`);
      out.push(`- **次にやること**：${r.action}`);
      out.push("");
    });
    if (!a.risks.length) out.push("（ヒアリングから読み取れるリスクはありません。情報が足りない可能性もあります）\n");
    out.push("## 4. このお客様への伝え方（話の柱）");
    out.push("");
    a.story.forEach((s, i) => out.push(`${i + 1}. ${s}`));
    out.push("");
    out.push("## 5. 次回の確認事項");
    out.push("");
    for (const q of a.questions) out.push(`- [ ] ${q}`);
    out.push("");
    out.push("## 6. 次にやること（優先順）");
    out.push("");
    a.nextActions.forEach((x, i) => out.push(`${i + 1}. ${x}`));
    out.push("");
    out.push(`## 7. 書類（段階ごと）`);
    out.push("");
    out.push("| 段階 | そろった | 未回収 |");
    out.push("|---|---|---|");
    for (const st of a.docs.stages) out.push(`| ${st.name} | ${st.done}/${st.total} | ${st.missing.join("、") || "なし"} |`);
    if (!a.docs.stages.length) out.push("| — | — | — |");
    out.push("");
    out.push("---");
    out.push("概算・一般的な傾向にもとづく分析です。審査結果・税額・控除額は金融機関・税務署の判断で変わります。お客様への説明では断定しないでください。");
    return out.join("\n");
  }
  return { toMarkdown };
});
