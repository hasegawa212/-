// サンプルのパーソナル提案書PDFを版ごとに作る（任意）。Playwright が入っている環境で：node tools/sample-proposal.js
// アプリの「提案書をPDFで出力」と同じHTMLを、各版のサンプル入力のままA4のPDFにする。
const path = require("path");
const { chromium } = require("playwright");
const EDITIONS = require("../editions");
(async () => {
  const b = await chromium.launch();
  for (const ed of Object.values(EDITIONS)) {
    const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
    await p.goto("file://" + path.join(__dirname, "..", "app", "index.html") + "?ed=" + ed.id);
    await p.locator('#nav button[data-step="9"]').click();
    await p.evaluate(() => { document.getElementById("proposal").innerHTML = document.querySelector(".preview-wrap").innerHTML; });
    await p.emulateMedia({ media: "print" });
    const out = path.join(__dirname, "..", "dist", ed.id, `パーソナル提案書_サンプル_${ed.label}.pdf`);
    await p.pdf({ path: out, format: "A4", printBackground: true, preferCSSPageSize: true });
    console.log("wrote", path.relative(path.join(__dirname, ".."), out));
    await p.close();
  }
  await b.close();
})();
