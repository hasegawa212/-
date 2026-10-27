// TDD：共有リンク（条件をURLの#以降に入れる。サーバーには送られない）
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../lib/engine");
const { encode, decode } = require("../lib/share");

test("変えた条件だけを短く入れ、開くと同じ条件とステップに戻る", () => {
  const st = S.defaults();
  st.age = 35; st.income = 5_200_000; st.family.marryAge = null; st.own.price = 32_000_000;
  const h = encode(st, { step: 3, present: true });
  assert.ok(h.length < 200, `長すぎる: ${h.length}`);
  const back = decode(h, S.defaults());
  assert.equal(back.state.age, 35);
  assert.equal(back.state.income, 5_200_000);
  assert.equal(back.state.family.marryAge, null);
  assert.equal(back.state.own.price, 32_000_000);
  assert.equal(back.state.rent.single, S.defaults().rent.single, "変えていない条件は初期値のまま");
  assert.equal(back.step, 3);
  assert.equal(back.present, true);
});

test("知らない項目・数字でない値・範囲外のステップは無視する（安全）", () => {
  const evil = "#s=" + Buffer.from(JSON.stringify({ age: "<script>", __proto__x: 1, own: { price: 1e12, hack: 5 }, foo: 1 })).toString("base64") + "&step=99";
  const back = decode(evil, S.defaults());
  assert.equal(back.state.age, S.defaults().age);
  assert.equal(back.state.own.hack, undefined);
  assert.equal(back.state.foo, undefined);
  assert.equal(back.state.own.price, S.defaults().own.price, "ありえない金額は無視");
  assert.equal(back.step, 0);
});

test("壊れたリンクでも初期値で開ける", () => {
  const back = decode("#s=%%%not-base64", S.defaults());
  assert.deepEqual(back.state, S.defaults());
  assert.equal(back.present, false);
});
