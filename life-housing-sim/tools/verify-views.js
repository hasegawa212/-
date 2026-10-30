// 3つの見せ方をブラウザで確かめる：iPhone（説明画面）・Zoom（画面共有／16:9資料）・PDF（A4提案書）
// 使い方：npm run build && node tools/verify-views.js（Playwright・Chromium）。問題があれば一覧を出して終了コード1
const path = require("node:path");
const { chromium } = require("playwright");
const S = require("../lib/engine"), Share = require("../lib/share");
const file = "file://" + path.join(__dirname, "..", "dist/ライフルート.html");
const CASES = { 独身: S.preset("single"), 社宅: S.preset("shataku"), 家族: S.preset("family") };
const link = (inp, extra = {}) => file + Share.encode(inp, { defaults: S.defaults(), keep: S.askFields(inp), ...extra });
const errs = [], ok = (c, msg) => { if (!c) errs.push(msg); };

(async () => {
  const b = await chromium.launch();
  { const np = b.newPage.bind(b); b.newPage = async (o) => { const pg = await np(o); await pg.addInitScript(() => { try { localStorage.setItem("lhs_help_seen", "1"); } catch (e) { /* なし */ } }); return pg; }; } // 初めての端末で開く「使い方」は、ここでは見た扱いにする
  for (const [name, inp] of Object.entries(CASES)) {
    const x = S.compute(inp), want = [S.man(x.life.rent), S.man(x.life.own), S.man(x.loan.pmt, 1)];

    // ── iPhone（390×844・タッチ）
    const ph = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    ph.on("pageerror", (e) => errs.push(`${name} iPhone JSエラー：${e.message}`));
    await ph.goto(link(inp, { step: 1 })); await ph.waitForTimeout(300);
    await ph.tap("#mPrev"); // ¥ から
    for (let i = 0; i < 10; i++) {
      const r = await ph.evaluate(() => ({ sw: document.documentElement.scrollWidth, nav: getComputedStyle(document.getElementById("mnav")).position,
        btn: document.getElementById("mNext").getBoundingClientRect().height, count: document.getElementById("mCount").textContent, small: [...document.querySelectorAll("#steps .step")].filter((e) => e.style.display !== "none").flatMap((e) => [...e.querySelectorAll("p")]).filter((p) => parseFloat(getComputedStyle(p).fontSize) < 13).length }));
      ok(r.sw <= 390, `${name} iPhone ${i}：横スクロール ${r.sw}px`);
      ok(r.nav === "fixed", `${name} iPhone ${i}：前へ・次へが固定されていない`);
      ok(r.btn >= 44, `${name} iPhone ${i}：ボタンが小さい ${r.btn}px（44px以上）`);
      ok(r.small === 0, `${name} iPhone ${i}：13px未満の文章 ${r.small}`);
      if (i < 9) await ph.tap("#mNext");
    }
    ok((await ph.evaluate(() => document.getElementById("mCount").textContent)).includes("10 / 10"), `${name} iPhone：タップで最後まで進めない`);
    await ph.evaluate(() => document.getElementById("fbOpen").click()); await ph.waitForTimeout(150);
    const fs = await ph.evaluate(() => ({ sw: document.documentElement.scrollWidth, sel: Math.min(...[...document.querySelectorAll("#form select")].map((e) => parseFloat(getComputedStyle(e).fontSize))) }));
    ok(fs.sw <= 390, `${name} iPhone 入力：横スクロール ${fs.sw}px`);
    ok(fs.sel >= 16, `${name} iPhone 入力：選ぶ欄の文字 ${fs.sel}px（16px未満だと Safari が拡大する）`);
    await ph.close();

    // ── Zoom（1280×720）：画面共有モード
    const z = await b.newPage({ viewport: { width: 1280, height: 720 } });
    z.on("pageerror", (e) => errs.push(`${name} Zoom JSエラー：${e.message}`));
    await z.goto(link(inp, { step: 1, present: true })); await z.waitForTimeout(300);
    await z.keyboard.press("ArrowLeft"); // ¥ から
    let zt = "";
    for (let i = 0; i < 10; i++) {
      const r = await z.evaluate(() => { const s = [...document.querySelectorAll("#steps .step")].find((e) => e.style.display !== "none"); const a = s.querySelector(".ask").getBoundingClientRect().bottom, p = document.querySelector(".pbar").getBoundingClientRect().top;
        const vis = (id) => { const e = document.getElementById(id); return e && getComputedStyle(e).display !== "none" && e.getBoundingClientRect().height > 0; };
        return { fit: a <= p, form: vis("form"), bar: vis("formbar"), notes: vis("notesBox"), sw: document.documentElement.scrollWidth, text: s.innerText }; });
      ok(r.fit, `${name} Zoom ${i}：1画面に収まらない`);
      ok(!r.form && !r.bar && !r.notes, `${name} Zoom ${i}：入力・条件・前提が見えている`);
      ok(r.sw <= 1280, `${name} Zoom ${i}：横スクロール`);
      zt += r.text;
      if (i < 9) await z.keyboard.press("ArrowRight");
    }
    // ── Zoom：お客様に見せる資料（16:9・1枚ずつ）
    await z.evaluate(() => { document.body.classList.remove("present"); document.getElementById("deckBtn").click(); }); await z.waitForTimeout(300);
    await z.click("#dShow"); await z.waitForTimeout(200);
    const n = await z.evaluate(() => document.querySelectorAll("#deck .swrap").length);
    ok(n === S_DECK(inp), `${name} 資料：${n}枚`);
    const dt = await z.evaluate(() => document.getElementById("deck").textContent);
    const notesShown = await z.evaluate(() => [...document.querySelectorAll("#deck .notes, #deck .snotes")].some((e) => getComputedStyle(e).display !== "none" && e.getBoundingClientRect().height > 0));
    ok(!notesShown, `${name} 資料（1枚ずつ）：営業マン用ノートが見えている`);
    await z.close();

    // ── PDF（A4）：提案書
    const pd = await b.newPage({ viewport: { width: 1000, height: 1200 } });
    await pd.goto(link(inp, { step: 1 })); await pd.waitForTimeout(300);
    await pd.evaluate(() => document.getElementById("prop").click()); await pd.waitForTimeout(300);
    await pd.emulateMedia({ media: "print" });
    const sh = await pd.evaluate(() => [...document.querySelectorAll("#proposal .sheet")].map((e) => ({ over: e.scrollHeight - e.clientHeight, foot: e.querySelector(".foot").getBoundingClientRect().top, last: Math.max(...[...e.children].filter((c) => !c.classList.contains("foot")).map((c) => c.getBoundingClientRect().bottom)) })));
    ok(sh.length === 6, `${name} PDF：${sh.length}ページ（6ページ）`);
    sh.forEach((s, i) => { ok(s.over <= 1, `${name} PDF ${i + 1}ページ：はみ出し ${s.over}px（切れる）`); ok(s.last <= s.foot + 1, `${name} PDF ${i + 1}ページ：本文がフッターに重なる`); });
    const pdf = await pd.pdf({ preferCSSPageSize: true, printBackground: true });
    const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
    ok(pages === 6, `${name} PDF：印刷すると ${pages} ページ`);
    const pt = await pd.evaluate(() => document.getElementById("proposal").innerText);
    ok(/注意事項/.test(pt) && /計算の条件/.test(pt) && /年齢別/.test(pt), `${name} PDF：年齢別・計算の条件・注意事項がない`);
    await pd.close();

    // ── 3つの見せ方で同じ数字
    for (const v of want) { ok(zt.includes(v), `${name}：Zoom に ${v} がない`); ok(dt.includes(v), `${name}：資料に ${v} がない`); ok(pt.includes(v), `${name}：PDF に ${v} がない`); }
    console.log(`${name}：iPhone 10画面・Zoom 10画面＋資料${n}枚・PDF ${pages}ページ を確認`);
  }
  // ── iPhone：はじめて開いたときは1問ずつ（独身・社宅・家族それぞれ最後まで進めて説明が始まる）
  for (const k of ["single", "shataku", "family"]) {
    const w = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    w.on("pageerror", (e) => errs.push(`1問ずつ JSエラー：${e.message}`));
    await w.goto(file); await w.waitForTimeout(300);
    await w.tap(`.wopts button[data-p="${k}"]`); await w.waitForTimeout(250);
    let n = 0;
    while (await w.$(".wsel, .wopts button[data-i]")) {
      const sw = await w.evaluate(() => document.documentElement.scrollWidth); ok(sw <= 390, `1問ずつ ${k}：横スクロール ${sw}px`);
      if (await w.$(".wsel")) await w.selectOption(".wsel", { index: 3 }); else await w.tap(".wopts button >> nth=1");
      await w.waitForTimeout(250); if (++n > 20) break;
    }
    ok(n === S.askFields(S.preset(k)).length, `1問ずつ ${k}：質問が ${n} 問（${S.askFields(S.preset(k)).length} 問のはず）`);
    await w.tap("#wizNext"); await w.waitForTimeout(150); await w.tap("#wizStart"); await w.waitForTimeout(250);
    ok(await w.evaluate(() => document.body.classList.contains("form-closed") && /^¥/.test(document.querySelector('#steps .step[style*="block"] h2').textContent)), `1問ずつ ${k}：最後に説明が始まらない`);
    await w.close();
  }
  console.log("1問ずつの入力：独身・社宅・家族 を最後まで確認");
  await b.close();
  if (errs.length) { console.error("NG\n- " + errs.join("\n- ")); process.exit(1); }
  console.log("OK：3つの見せ方とも問題なし");
})();
function S_DECK(inp) { return S.deck(S.compute(inp)).slides.length; }
