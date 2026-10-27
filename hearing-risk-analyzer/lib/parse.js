// #03_商談報告 の文章 → 項目（Node でもブラウザでも動く。依存なし）
// ブラウザ：<script src="lib/parse.js"> で window.HRA.parse
(function (root, factory) {
  const m = factory();
  if (typeof module === "object" && module.exports) module.exports = m;
  else Object.assign((root.HRA = root.HRA || {}), m);
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // 「5,796,962円」「60万」「4.6万」「残180万」→ 円。読めなければ null
  function yen(s) {
    if (s == null) return null;
    const t = String(s).replace(/[，,]/g, "").replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
    let m = t.match(/(\d+(?:\.\d+)?)\s*万/);
    if (m) return Math.round(parseFloat(m[1]) * 10_000);
    m = t.match(/(\d+(?:\.\d+)?)\s*円/);
    if (m) return Math.round(parseFloat(m[1]));
    return null;
  }
  const num = (s) => {
    const m = String(s || "").match(/\d+/);
    return m ? Number(m[0]) : null;
  };

  function parse(text) {
    const lines = String(text || "").replace(/\r/g, "").split("\n");
    const fields = {};
    const sections = {};
    const docs = [];
    let section = "", lastKey = null;
    let date = null;
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || /^⸻+$/.test(line)) { lastKey = null; continue; }
      const head = line.match(/^【(.+?)】(.*)$/);
      if (head) { fields[head[1]] = head[2].trim(); if (head[1] === "面談日") date = head[2].trim(); continue; }
      const sec = line.match(/^(?:■|▼)\s*(.+)$/) || line.match(/^〜(.+)〜$/) || line.match(/^⚠️(.+?)⚠️$/);
      if (sec) { section = sec[1].trim(); sections[section] = sections[section] || []; lastKey = null; continue; }
      const doc = line.match(/^(✅|⬜|☑️|☐)\s*(.+?)(?:（.*）)?\s*(?:←.*)?$/);
      if (doc) { docs.push({ name: doc[2].trim(), done: doc[1] === "✅" || doc[1] === "☑️", section }); continue; }
      (sections[section] = sections[section] || []).push(line);
      const kv = line.match(/^・?\s*([^：:→]{1,24}?)\s*[：:]\s*(.*)$/);
      if (kv && !line.startsWith("→")) {
        lastKey = kv[1].trim();
        fields[lastKey] = kv[2].trim();
        continue;
      }
      // 「年収」の2行目以降のような続きの行
      if (lastKey && /^[\s　]/.test(raw) && !line.startsWith("→") && !line.startsWith("・")) fields[lastKey] += "\n" + line;
    }

    const f = (k) => fields[k] || "";
    const strip = (l) => l.replace(/^[・→\s　]+/, "").trim();
    const notes = (sections["備考"] || []).map(strip).filter(Boolean);
    const wishLines = (sections["希望条件"] || []).map(strip).filter(Boolean);
    const all = lines.map((l) => l.trim()).filter(Boolean);

    const incomes = [];
    for (const m of f("年収").matchAll(/((?:R|H)\d+年|\d{4}年)?\s*([\d,]{5,})\s*円/g)) incomes.push({ label: m[1] || "", amount: yen(m[2] + "円") });
    const bonusAll = [...f("ボーナス").matchAll(/(\d+(?:\.\d+)?)\s*万/g)];
    const rentLine = notes.find((l) => /^家賃/.test(l));
    const carLine = [f("借入状況"), ...notes].join("\n").match(/車\s*[（(]?\s*残\s*([\d.,]+\s*万)/);
    const wishText = wishLines.join("\n");
    const pick = (re) => { const m = wishText.match(re); return m ? m[1] : null; };

    return {
      date,
      channel: f("チャンネル"),
      name: f("お客様名"),
      age: num(f("年齢")),
      address: f("住所・URL"),
      employer: f("勤務先"),
      tenure: num(f("勤務年数")),
      incomes,
      bonus: bonusAll.length ? Math.round(parseFloat(bonusAll[bonusAll.length - 1][1]) * 10_000) : null,
      bonusText: f("ボーナス"),
      rank: (f("商談ランク").match(/[A-ES]/) || [null])[0],
      negotiations: num(f("交渉回数")),
      visits: num(f("同行回数")),
      result: f("結果"),
      loansText: f("借入状況"),
      insuranceText: f("加入保険"),
      savings: yen(f("貯金・手付金")),
      rent: rentLine ? yen(rentLine) : null,
      carLoanBalance: carLine ? yen(carLine[1]) : null,
      motive: f("動機の中身"),
      summary: (sections["内容要約"] || []).join("\n"),
      notes,
      wish: {
        lines: wishLines,
        area: wishLines[0] || "",
        monthly: pick(/持ち出し\s*([\d.]+)\s*万/) ? yen(pick(/持ち出し\s*([\d.]+)\s*万/) + "万") : null,
        bonusEach: pick(/ボーナス払い.*?各\s*([\d.]+)\s*万/) ? yen(pick(/ボーナス払い.*?各\s*([\d.]+)\s*万/) + "万") : null,
        parking: pick(/駐車場.*?(\d)\s*台/) ? Number(pick(/駐車場.*?(\d)\s*台/)) : null,
        maxBuildingAge: pick(/築\s*(\d+)\s*年以内/) ? Number(pick(/築\s*(\d+)\s*年以内/)) : null,
      },
      docs,
      fields,
      lines: all,
    };
  }

  return { parse, yen };
});
