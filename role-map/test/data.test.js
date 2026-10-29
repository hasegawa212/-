const test = require("node:test");
const assert = require("node:assert/strict");
const RM = require("../lib/rolemap");
const D = require("../data/roles");

test("本物のデータ：validate のエラーが0", () => {
  assert.deepEqual(RM.validate(D), []);
});

test("本物のデータ：在籍者は全員、主か手伝いの仕事が1件以上ある", () => {
  for (const p of RM.byPerson(D)) assert.ok(p.counts.total > 0, `${p.person.name} の仕事がない`);
});

test("本物のデータ：全部の仕事に根拠（チャンネル・日付 2026-09〜10）がある", () => {
  for (const t of D.tasks) {
    assert.ok(t.evidence.length > 0, t.id);
    for (const e of t.evidence) assert.match(e.date, /^2026-(09|10)-\d\d$/, `${t.id} の日付 ${e.date}`);
  }
});

test("本物のデータ：代表の id があり、代表に集中している仕事が見える", () => {
  assert.ok(D.ceoId && D.people.some((p) => p.id === D.ceoId));
  assert.ok(RM.ceoLoad(D, D.ceoId).length > 0);
});

test("本物のデータ：顧客の個人情報らしいもの（電話・様・金額）を含まない", () => {
  // 「お客様」「オーナー様」「皆様」は一般名詞なので除いてから調べる
  const text = JSON.stringify(D.tasks).replace(/お客様|オーナー様|皆様/g, "");
  assert.doesNotMatch(text, /\d{2,4}-\d{2,4}-\d{3,4}/, "電話番号らしきもの");
  assert.doesNotMatch(text, /[一-龠ァ-ヶ]{1,6}様/, "◯◯様");
  assert.doesNotMatch(text, /\d[\d,]*万円|\d{1,3}(,\d{3})+円/, "金額");
});

test("本物のデータ：立候補の席 ID は決まった形だけ", () => {
  for (const t of D.tasks) if (t.seat) assert.match(t.seat, /^(E-[0-8]|S-([1-9]|10)|M-1|P-[12]|K-[1-5])$/, `${t.id}: ${t.seat}`);
});
