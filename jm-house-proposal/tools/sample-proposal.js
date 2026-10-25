// サンプルのパーソナル提案書PDFを作る（任意）。Playwright が入っている環境で：node tools/sample-proposal.js
// アプリの「提案書をPDFで出力」と同じHTMLを、サンプル入力のままA4のPDFにする。
const path = require("path");
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto("file://" + path.join(__dirname, "..", "app", "index.html"));
  await p.locator('#nav button[data-step="9"]').click();
  await p.evaluate(() => { document.getElementById("proposal").innerHTML = document.querySelector(".preview-wrap").innerHTML; });
  await p.emulateMedia({ media: "print" });
  const out = path.join(__dirname, "..", "dist", "パーソナル提案書_サンプル.pdf");
  await p.pdf({ path: out, format: "A4", printBackground: true, preferCSSPageSize: true });
  await b.close();
  console.log("wrote", out);
})();
