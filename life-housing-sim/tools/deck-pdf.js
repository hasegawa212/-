// 見本の「お客様に見せる資料（16:9）」PDF を作る（初期値＝架空の代表的なお客様。お名前は入れない）
// 使い方：npm run build && node tools/deck-pdf.js → dist/ライフルート_お客様資料_見本.pdf
const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require("playwright");
(async () => {
  const root = path.join(__dirname, "..");
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1360, height: 900 } });
  await p.goto("file://" + path.join(root, "dist/ライフルート.html") + "#step=1&v=2");
  await p.evaluate(() => document.getElementById("deckBtn").click());
  await p.waitForTimeout(500);
  await p.emulateMedia({ media: "print" });
  const pdf = await p.pdf({ preferCSSPageSize: true, printBackground: true });
  const out = path.join(root, "dist/ライフルート_お客様資料_見本.pdf");
  fs.writeFileSync(out, pdf);
  const n = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
  await b.close();
  const want = 14;
  if (n !== want) throw new Error(`ページ数が${want}ではありません：${n}`);
  console.log(out, `${n}ページ`);
})();
