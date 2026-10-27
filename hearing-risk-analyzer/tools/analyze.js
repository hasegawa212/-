#!/usr/bin/env node
// 使い方：node tools/analyze.js 商談報告.txt > 分析.md   （または標準入力から）
// お客様の個人情報を含むので、出力はリポジトリにコミットしない
const fs = require("node:fs");
const { parse } = require("../lib/parse");
const { analyze } = require("../lib/analyze");
const { toMarkdown } = require("../lib/report");

const file = process.argv[2];
const text = file ? fs.readFileSync(file, "utf8") : fs.readFileSync(0, "utf8");
const h = parse(text);
process.stdout.write(toMarkdown(h, analyze(h)) + "\n");
