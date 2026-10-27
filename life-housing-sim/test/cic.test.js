// TDD：CIC取得 — 事前審査の前に、お客様自身が信用情報（CIC）を取り寄せて確かめる
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../lib/engine");

const x = S.compute(S.defaults());

test("CICの取り寄せ方は1か所で定義：ネット500円（PDFですぐ）・郵送1,500円（約10日）、窓口は終了、公式で確認", () => {
  assert.match(S.CIC.url, /^https:\/\/www\.cic\.co\.jp\//);
  const by = Object.fromEntries(S.CIC.methods.map((m) => [m.key, m]));
  assert.equal(by.net.fee, 500);
  assert.equal(by.mail.fee, 1500);
  assert.match(by.net.how, /スマホ|パソコン/);
  assert.match(by.mail.how, /約10日/);
  assert.match(S.CIC.note, /窓口.*終了/);
  assert.match(S.CIC.note, /公式/);
  assert.match(S.CIC.why, /返済の遅れ/);
});

test("⑥の進め方は4段階：⓪ CICで自分の信用情報を取り寄せる → ① 事前審査 → ② やるか・やらないか → 通らなかったら", () => {
  const g = S.gate(x);
  assert.equal(g.steps.length, 4);
  assert.match(g.steps[0], /CIC.*信用情報.*500円/);
  assert.match(g.steps[1], /できるか.*事前審査/);
});

test("⑥の説明・提案書の次の一歩・トップのミッションに CIC が入る", () => {
  const six = S.talk(x)[7];
  assert.match(six.show, /CIC/);
  assert.match(S.proposal(x).pages[3].nextSteps[0], /CIC/);
  const m = S.home(x).missions.find((v) => v.id === "cic");
  assert.ok(m && !m.auto && m.done === false);
  assert.equal(S.home(x, { cic: true }).missions.find((v) => v.id === "cic").done, true);
});
