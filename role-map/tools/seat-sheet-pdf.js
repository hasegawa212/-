#!/usr/bin/env node
// 別紙の HTML を A4 PDF にする（Playwright。この環境では NODE_PATH=$(npm root -g) で読み込む）
const path = require("node:path");
const { OUT } = require("./seat-sheet");
const { chromium } = require("playwright");
(async () => {
  const pdf = OUT.replace(/\.html$/, ".pdf");
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("file://" + path.resolve(OUT));
  await p.pdf({ path: pdf, format: "A4", printBackground: true, preferCSSPageSize: true });
  await b.close();
  if (errs.length) { console.error(errs); process.exit(1); }
  console.error("wrote " + pdf);
})();
