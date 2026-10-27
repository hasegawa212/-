// TDD：断り文句（アポ・キャンセル・商談）→ 切り返しのデータと、商談報告からの検出
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { OBJECTIONS, detect, STAGES } = require("../lib/objections");
const { parse } = require("../lib/parse");
const { analyze, FORBIDDEN } = require("../lib/analyze");

test("どの断り文句にも、受け止め・質問・事実・次の一歩・言わないこと・例文がある", () => {
  assert.ok(OBJECTIONS.length >= 15);
  const ids = new Set();
  for (const o of OBJECTIONS) {
    assert.ok(!ids.has(o.id), `id重複 ${o.id}`); ids.add(o.id);
    assert.ok(STAGES[o.stage], `${o.id} stage`);
    for (const k of ["label", "accept", "ask", "fact", "next", "avoid"]) assert.ok(o[k] && o[k].length > 5, `${o.id}.${k}`);
    assert.ok(Array.isArray(o.examples) && o.examples.length >= 1, `${o.id}.examples`);
    assert.ok(o.keywords instanceof RegExp, `${o.id}.keywords`);
  }
});

test("Slackで多かった断り文句がそろっている（アポ：不信感・今は必要ない・忙しい・第三者／商談：転勤・今はいい・家族・借金が怖い・社宅・NISA優先）", () => {
  const ids = OBJECTIONS.map((o) => o.id);
  for (const id of ["a_distrust", "a_noNeed", "a_busy", "a_thirdParty", "c_transfer", "c_notNow", "c_family", "c_debtFear", "c_cheapHousing", "c_otherInvest", "x_noShow"])
    assert.ok(ids.includes(id), id);
});

test("商談報告の文章から断り文句を見つける（根拠の行つき）", () => {
  const h = parse(fs.readFileSync(path.join(__dirname, "../samples/sample.txt"), "utf8"));
  const found = detect([h.summary, ...h.notes].join("\n"));
  const got = found.map((f) => f.id);
  assert.ok(got.includes("c_transfer"), "異動");
  assert.ok(got.includes("c_family"), "婚約者の不安");
  for (const f of found) assert.ok(f.evidence.length > 0);
});

test("analyze の結果にも断り文句が入る", () => {
  const h = parse(fs.readFileSync(path.join(__dirname, "../samples/sample.txt"), "utf8"));
  const a = analyze(h);
  assert.ok(a.objections.length >= 2);
});

test("切り返しに、禁止表現・あおり（今しかない・今しか買えない 等）がない", () => {
  const all = JSON.stringify(OBJECTIONS);
  for (const re of [...FORBIDDEN, /今しか(ない|買えない)/, /二度と/]) assert.ok(!re.test(all.replace(/"avoid":"[^"]*"/g, "")), String(re));
});
