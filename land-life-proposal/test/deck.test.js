// TDD：資料（24ページ）の構成・営業ノート・禁止表現・会社名の混在がないこと
// deck/build.js の buildDeck(edition, { write: false }) はファイルを書かずに中身だけ返す
const test = require("node:test");
const assert = require("node:assert/strict");
const { buildDeck } = require("../deck/build");
const EDITIONS = require("../editions");

const FORBIDDEN = [/必ず値上がり/, /絶対に損(し|は)ない/, /今買わないと損/, /家賃は(無駄|捨て)/, /返済(は|が)(すべて|全部)資産/, /必ず売れる/, /土地は必ず/, /残りわずか/, /今だけ/];

for (const [id, ed] of Object.entries(EDITIONS)) {
  test(`${id}：24ページ・5幕・ノート5項目`, async () => {
    const d = await buildDeck(ed, { write: false });
    assert.equal(d.pages.length, 24);
    assert.deepEqual([...new Set(d.pages.map((p) => p.act))], [1, 2, 3, 4, 5]);
    for (const p of d.pages) {
      for (const k of ["msg", "next"]) assert.ok(p.notes[k] && p.notes[k].length > 10, `P${p.page} ${k}`);
      for (const k of ["ask", "worry", "answer"]) assert.ok(p.notes[k].length >= 1, `P${p.page} ${k}`);
    }
  });

  test(`${id}：スライド本文に禁止表現がない`, async () => {
    const d = await buildDeck(ed, { write: false });
    for (const p of d.pages) for (const re of FORBIDDEN) assert.ok(!re.test(p.text), `P${p.page} に ${re}`);
  });

  test(`${id}：自社名だけが載り、もう一方の会社名が混ざらない`, async () => {
    const d = await buildDeck(ed, { write: false });
    const all = d.pages.map((p) => p.text).join("\n");
    assert.ok(all.includes(ed.brand.name));
    for (const [oid, o] of Object.entries(EDITIONS)) if (oid !== id) assert.ok(!all.includes(o.brand.name), `${o.brand.name} が混在`);
  });

  test(`${id}：写真にはすべて注記がある`, async () => {
    const d = await buildDeck(ed, { write: false });
    assert.ok(d.photos.length > 0);
    for (const ph of d.photos) assert.ok(ph.caption, `${ph.file} に注記なし（P${ph.page}）`);
  });
}

test("最終ページ（P24）に所在地・営業時間・定休日がある版はそれを載せる", async () => {
  const ed = EDITIONS["japan-mgmt"];
  const d = await buildDeck(ed, { write: false });
  const last = d.pages[23].text;
  for (const v of [ed.brand.address, ed.brand.tel, ed.brand.hours, ed.brand.closed]) assert.ok(last.includes(v), `P24 に「${v}」がない`);
});
