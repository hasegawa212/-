#!/usr/bin/env node
// 役割マップの Markdown レポート：node tools/report.js > report.md
const RM = require("../lib/rolemap");
const D = require("../data/roles");
const PLAN = require("../data/handoff");
const SEATS = require("../data/seats");

const name = (id) => RM.nameOf(D, id);
const who = (t) => (t.owner ? name(t.owner) : "（担当なし）") + (t.helpers && t.helpers.length ? `（副：${t.helpers.map(name).join("・")}）` : "");
const ev = (t) => t.evidence.map((e) => `${e.channel} ${e.date.slice(5).replace("-", "/")}`).join("、");
const line = (t) => `- **${t.name}**［${t.freq}・${t.area}${t.seat ? "・" + t.seat : ""}］— ${who(t)}　_根拠：${ev(t)}${t.confidence === "推測" ? "（推測）" : ""}_${t.issue ? `\n  - ⚠ ${t.issue}` : ""}`;

const s = RM.summary(D, D.ceoId);
const out = [];
out.push(`# 役割マップ｜誰が何をやっているか（Slack ${D.period}）`, "");
out.push(`- 時点：${D.asOf}　／　対象：在籍 ${s.people} 名・仕事 ${s.tasks} 件`);
out.push(`- **担当なし ${s.gaps} 件／控えなし（1人だけ） ${s.single} 件／代表が自分でやっている ${s.ceo} 件**（推測を含む仕事 ${s.guess} 件）`, "");

out.push("## 1. 気をつける仕事", "", "### 担当なし", ...RM.gaps(D).map(line), "");
out.push(`### 代表（${name(D.ceoId)}）が自分でやっている実務`, ...RM.ceoLoad(D, D.ceoId).map(line), "");
out.push("### 控えがいない（1人だけ）— 毎日・毎週", ...RM.single(D).filter((t) => t.freq === "毎日" || t.freq === "毎週").filter((t) => t.owner !== D.ceoId).map(line), "");

out.push("## 2. 人ごと", "");
for (const p of RM.byPerson(D)) {
  out.push(`### ${p.person.name}（${p.person.title || "肩書きなし"}・${p.person.dept}）— 主 ${p.counts.main}・手伝い ${p.counts.help}・主担当の重さ ${p.mainWeight}（${p.level}）`);
  if (p.main.length) out.push("**主にやっている**", ...p.main.map(line));
  if (p.help.length) out.push("**手伝っている・控え**", ...p.help.map(line));
  out.push("");
}

out.push("## 3. 部門ごと", "", "| 部門 | 仕事 | 担当なし | 1人だけ |", "| --- | --: | --: | --: |");
for (const [a, v] of Object.entries(RM.byArea(D))) out.push(`| ${a} | ${v.tasks} | ${v.gaps} | ${v.single} |`);
out.push("");

out.push("## 4. 立候補の席との対応", "", "| 席 | 関係する仕事 | 今やっている人 |", "| --- | --- | --- |");
for (const [seat, v] of Object.entries(RM.bySeat(D)).sort()) out.push(`| ${seat} | ${v.tasks.map((t) => t.name).join("／")} | ${v.people.map(name).join("・") || "（なし）"} |`);
out.push("");

const h = RM.handoff(D, PLAN, D.ceoId);
const pn = (t) => `${t.name}${PLAN[t.id].note ? `（${PLAN[t.id].note}）` : ""}`;
out.push("## 5. 割り当て案（代表だけが見る・案）", "");
out.push(`- 代表の仕事 **${h.ceoBefore} 件 → ${h.ceoAfter.length} 件**。担当なしの仕事は、席に渡すかルールにして見る席を決める`);
out.push(`- 席に渡す ${h.count.move}／代表に残す ${h.count.keep}／全員のルールにして見る席を決める ${h.count.rule}／やめる ${h.count.stop}`);
out.push("- 席だけを決めています。誰が座るかは立候補で決めます（「今手伝っている人」は参考）", "");
out.push("| 席 | 渡す仕事 | 守られているかを見るルール | 今手伝っている人（参考） |", "| --- | --- | --- | --- |");
for (const [seat, v] of Object.entries(h.bySeat).sort(([a], [b]) => a.localeCompare(b, "ja", { numeric: true }))) out.push(`| ${seat} ${SEATS[seat]} | ${v.move.map(pn).join("／") || "—"} | ${v.rule.map(pn).join("／") || "—"} | ${v.helpers.map(name).join("・") || "—"} |`);
out.push("", "**代表に残す**", ...h.ceoAfter.map((t) => `- ${pn(t)}`));
const stops = D.tasks.filter((t) => PLAN[t.id] && PLAN[t.id].kind === "stop");
if (stops.length) out.push("", "**やめる**", ...stops.map((t) => `- ${pn(t)}`));

out.push("", "---", "_元データ：`role-map/data/roles.js`（Slack 公開チャンネルの読み取り。顧客の個人情報・個人の評価は含めない）_");

process.stdout.write(out.join("\n") + "\n");
