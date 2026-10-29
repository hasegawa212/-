// TDD：看板のエリアを押すと、そのエリアの「知っておくと得する」ノウハウのページ（お客様の数字がなくても見られる）
// 驚きの数字は計算で出す（手で書かない）／出典と「変わることがある」を書く／断定・禁止の言葉なし
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const S = require("../lib/engine");

const KEYS = ["nisa", "world", "home", "ins", "plan", "cash", "pension"];
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("エリアは7つ：NISA・海外投資・不動産・保険・ライフプラン・現預金・年金2000万円問題", () => {
  assert.deepEqual(S.GUIDE_KEYS, KEYS);
  for (const k of KEYS) {
    const g = S.guide(k);
    assert.equal(g.key, k);
    assert.ok(g.title && g.catch && g.lead, k);
    assert.ok(g.big && g.big.value && g.big.label, `${k} 驚きの数字`);
    assert.ok(g.tips.length >= 5 && g.tips.length <= 7, `${k} ノウハウ ${g.tips.length}`);
    for (const t of g.tips) assert.ok(t.head && t.body && t.body.length > 15, `${k}: ${t.head}`);
    assert.ok(g.myths.length >= 2, `${k} 勘違い`);
    for (const m of g.myths) assert.ok(m.q.endsWith("？") && m.a, k);
    assert.equal(g.todo.length, 3, `${k} 今日からできること`);
    assert.ok(g.sources.length >= 1, `${k} 出典`);
    assert.match(g.note, /変わる|目安|約束/, k);
    assert.ok(g.area || g.talk, `${k} 自分の数字で見る先`);
  }
  assert.equal(S.guide("nope"), null);
});

test("驚きの数字は計算から：NISA 毎月3万×20年×年3% ≒ 985万（元本720万）", () => {
  const g = S.guide("nisa");
  const r = 0.03 / 12, n = 240, fv = 30000 * ((Math.pow(1 + r, n) - 1) / r);
  assert.equal(g.big.value, S.man(fv));
  assert.match(g.big.note, /720万/);
  assert.match(g.big.note, /仮定|元本保証なし/);
});

test("現預金：100万円を物価・預金金利（ECONOMY）のまま10年 → 買える量", () => {
  const g = S.guide("cash"), E = S.ECONOMY;
  const real = 1_000_000 * Math.pow((1 + E.deposit.rate) / (1 + E.cpi.rate), 10);
  assert.equal(g.big.value, S.man(real));
  assert.match(g.big.note, new RegExp(E.asOf));
});

test("保険：高額療養費（2026年8月の見直し後・年収約370〜510万円）で医療費100万円 → 自己負担 92,940円", () => {
  const g = S.guide("ins"), t = JSON.stringify(g);
  assert.equal(g.big.value, `${(85_800 + (1_000_000 - 286_000) * 0.01).toLocaleString()}円`);
  assert.match(g.big.label, /370〜510万円/);
  assert.match(t, /2026年8月/);
  assert.match(t, /年間上限/);
  assert.doesNotMatch(t, /80,100円|370〜770万円|要確認/, "見直し前の数字・要確認は残さない");
});

test("最新の制度（2026年10月に確認）：新築の固定資産税は令和13年3月31日まで、iDeCoは2026年12月から月6.2万円・70歳まで", () => {
  const h = JSON.stringify(S.guide("home")), p = JSON.stringify(S.guide("pension"));
  assert.match(h, /令和13年3月31日/);
  assert.match(h, /戸建てで3年間/);
  assert.match(p, /2026年12月/);
  assert.match(p, /6\.2万円/);
  assert.match(p, /70歳/);
  for (const k of S.GUIDE_KEYS) assert.doesNotMatch(JSON.stringify(S.guide(k)), /要確認/, k);
});

test("年金：満額は PENSION と同じ、繰下げ最大84%、2000万円は ECONOMY の報告書", () => {
  const t = JSON.stringify(S.guide("pension"));
  assert.match(t, new RegExp(S.PENSION.basicFull.toLocaleString()));
  assert.match(S.guide("pension").big.value, /84%/);
  assert.match(t, /2019年/);
});

test("不動産：住宅用地の特例（1/6）、控除の年数は CREDIT_KINDS から、3,000万円特別控除", () => {
  const t = JSON.stringify(S.guide("home"));
  assert.match(S.guide("home").big.value, /6分の1/);
  assert.match(t, /0\.7%/);
  assert.match(t, new RegExp(`最大${Math.max(...Object.values(S.CREDIT_KINDS).map((v) => v.years))}年`));
  assert.match(t, /3,000万円/);
});

test("言わないこと：禁止の言葉・断定（必ず儲かる／元本保証で高利回り をすすめない）", () => {
  for (const k of KEYS) {
    const t = JSON.stringify(S.guide(k));
    for (const f of S.FORBIDDEN) assert.ok(!f.test(t), `${k}: ${f}`);
    assert.doesNotMatch(t, /必ず(儲|増え|もうか)|絶対に(得|儲)/, k);
  }
});

test("画面：看板のエリア・左メニュー・スマホのボタンからページを開く（入力前でも開ける）、#g= で直接開ける", () => {
  assert.match(html, /function openGuide\(/);
  assert.match(html, /id="guide"/);
  assert.match(html, /guide: "world"/);
  assert.match(html, /guide: "pension"/);
  assert.match(html, /if \(h\.guide\) return openGuide\(h\.guide\);[\s\S]{0,80}if \(guard\(\)\) return;/, "ガードの前に開く");
  assert.match(html, /g=\(\[a-z\]\+\)/);
  assert.match(html, /自分の数字で見る/);
  assert.match(html, /body\.guide-view/);
});
