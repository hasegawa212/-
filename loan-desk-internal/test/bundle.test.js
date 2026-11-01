const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { bundle } = require("../tools/bundle.js");

test("file: スクリプトを全部入れた1ファイル（外のファイルを読まない）", () => {
  const h = bundle("file");
  assert.match(h, /^<!DOCTYPE html>/);
  assert.doesNotMatch(h, /<script src=/);
  for (const name of ["LSA", "recommend", "retryPlan", "fromSnapshot", "LENDERS"]) assert.ok(h.includes(name), name);
});

test("page: claude.ai のページ用（DOCTYPE・html・head・body を外し、<title> から始まる）", () => {
  const h = bundle("page");
  assert.match(h, /^<title>/);
  assert.doesNotMatch(h, /<!DOCTYPE|<html|<\/html>|<head>|<\/head>|<body>|<\/body>/i);
  assert.doesNotMatch(h, /<script src=/);
  assert.match(h, /<meta name="robots" content="noindex,nofollow">/);
});

test("出力にお客様の情報は入らない（リポジトリのデータだけ）", () => {
  const h = bundle("page");
  assert.doesNotMatch(h, /loandesk_customers_\d{8}\.json"?\s*[:,]|"initials":/);
  assert.doesNotMatch(h, /\d{2,4}-\d{2,4}-\d{3,4}/, "電話番号の形がない");
});

test("書き出し先がリポジトリの dist/ 以外なら断る（お客様のファイルと混ぜない）", () => {
  const { write } = require("../tools/bundle.js");
  assert.throws(() => write("page", path.join(os.tmpdir(), "x.html")), /dist/);
  const out = write("page");
  assert.ok(out.endsWith(path.join("dist", "loan-desk-page.html")) && fs.existsSync(out));
});
