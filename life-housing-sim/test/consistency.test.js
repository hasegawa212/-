// TDD：直したところ
// 1) 今の年齢が「買う年齢」より上のとき（例：45歳で、買う年齢の初期値30歳のまま）、計算は「今買う」なのに
//    文章は「30歳で買った場合」になっていた → 買う年齢を今の年齢にそろえ、計算・文章・提案書・資料をすべて同じに
// 2) スマホでは看板の絵が小さく押しにくい → 看板の下に大きなボタンの列（絵と同じ行き先）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const S = require("../lib/engine");

for (const age of [31, 45, 52]) {
  test(`${age}歳（買う年齢の初期値30歳より上）：買う年齢は今の年齢、文章も「${age}歳で」`, () => {
    const x = S.compute({ ...S.defaults(), age });
    assert.equal(x.input.own.buyAge, age);
    assert.equal(x.loan.buyAge, age);
    const all = JSON.stringify([S.talk(x), S.deck(x), S.proposal(x), S.conditions(x), S.home(x).areas]);
    assert.doesNotMatch(all, /30歳で/, "30歳で買った前提の文章が残っている");
    assert.match(S.proposal(x).cover.profile, new RegExp(`${age}歳で`));
    const t = S.ageTable(x);
    assert.equal(new Set(t.map((r) => r.age)).size, t.length, "年齢が重ならない");
  });
}

test("買う年齢が今より先なら、そのまま（例：27歳で30歳に買う）", () => {
  const x = S.compute(S.defaults());
  assert.equal(x.input.own.buyAge, 30);
  assert.match(S.proposal(x).cover.profile, /30歳で/);
});

test("計算に渡した入力は書きかえない（呼び出し側の値はそのまま）", () => {
  const inp = { ...S.defaults(), age: 45 };
  S.compute(inp);
  assert.equal(inp.own.buyAge, 30);
});

test("スマホ：看板の下に大きなボタンの列（はじめる・各エリア）。行き先は絵のボタンと同じ HOTSPOTS から作る", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /id="heroLinks"/);
  assert.match(html, /HOTSPOTS\.map\(\(h, i\) => \[h, i\]\)\.filter\(\(\[h\]\) => h\.quick\)/);
  assert.match(html, /@media \(max-width:600px\)[^}]*#heroLinks/);
});
