const test = require("node:test");
const assert = require("node:assert/strict");
const RM = require("../lib/rolemap");

// 架空の小さなデータ（本物の人名は使わない）
const fx = () => ({
  asOf: "2026-10-28",
  people: [
    { id: "ceo", name: "代表A", title: "代表取締役", dept: "経営", status: "在籍" },
    { id: "a", name: "社員A", title: "部長", dept: "営業部", status: "在籍" },
    { id: "b", name: "社員B", title: "", dept: "営業部", status: "在籍" },
    { id: "c", name: "社員C", title: "", dept: "管理部", status: "新人" },
  ],
  tasks: [
    { id: "t1", name: "振込の実行", area: "経営", freq: "毎週", owner: "ceo", helpers: [], seat: "K-2", evidence: [{ channel: "#23", date: "2026-10-20", note: "振込" }], confidence: "確認" },
    { id: "t2", name: "週次の数字集計", area: "営業", freq: "毎週", owner: "a", helpers: ["b"], seat: "S-3", evidence: [{ channel: "#07", date: "2026-10-25", note: "集計" }], confidence: "確認" },
    { id: "t3", name: "社用車の報告", area: "全社", freq: "毎日", owner: "a", helpers: [], seat: null, evidence: [{ channel: "#06", date: "2026-10-28", note: "車" }], confidence: "確認" },
    { id: "t4", name: "集客の対応", area: "営業", freq: "都度", owner: null, helpers: [], seat: "S-8", evidence: [{ channel: "#00", date: "2026-10-28", note: "監視" }], confidence: "推測", issue: "担当なし" },
    { id: "t5", name: "勤怠チェック", area: "管理", freq: "毎日", owner: "c", helpers: ["a"], seat: "K-1", evidence: [{ channel: "#27", date: "2026-10-28", note: "勤怠" }], confidence: "確認" },
    { id: "t6", name: "商談研修", area: "営業", freq: "単発", owner: "ceo", helpers: ["b"], seat: "S-6", evidence: [{ channel: "#14", date: "2026-10-28", note: "研修" }], confidence: "確認" },
  ],
});

test("validate：正しいデータはエラー0", () => {
  assert.deepEqual(RM.validate(fx()), []);
});

test("validate：ID重複・存在しない人・根拠なし・不正な値・主と副の重複を見つける", () => {
  const d = fx();
  d.tasks.push({ ...d.tasks[0] });                                  // ID重複
  d.tasks[1].owner = "zzz";                                         // 存在しない人
  d.tasks[2].evidence = [];                                         // 根拠なし
  d.tasks[3].area = "謎";                                           // 不正な area
  d.tasks[4].freq = "たまに";                                       // 不正な freq
  d.tasks[5].helpers = ["ceo"];                                     // 主が副にも入っている
  const errs = RM.validate(d).join("\n");
  assert.match(errs, /t1.*重複/);
  assert.match(errs, /t2.*zzz/);
  assert.match(errs, /t3.*根拠/);
  assert.match(errs, /t4.*area/);
  assert.match(errs, /t5.*freq/);
  assert.match(errs, /t6.*主と副/);
});

test("byPerson：主・手伝い・重さを人ごとに数える", () => {
  const p = RM.byPerson(fx());
  const a = p.find((x) => x.person.id === "a");
  assert.deepEqual(a.main.map((t) => t.id), ["t3", "t2"]);          // 毎日 → 毎週 の順
  assert.deepEqual(a.help.map((t) => t.id), ["t5"]);
  assert.deepEqual(a.counts, { main: 2, help: 1, total: 3 });
  assert.equal(a.weight, 5 + 3 + 5);                                // 毎日5・毎週3・手伝いの毎日5
  const b = p.find((x) => x.person.id === "b");
  assert.equal(b.counts.main, 0);
  assert.equal(b.level, "軽い");
  // 仕事が多い人から並ぶ
  assert.equal(p[0].person.id, "a");
});

test("byPerson：主が6件以上なら重い", () => {
  const d = fx();
  for (let i = 0; i < 6; i++) d.tasks.push({ id: "x" + i, name: "x" + i, area: "営業", freq: "単発", owner: "b", helpers: [], seat: null, evidence: [{ channel: "#00", date: "2026-10-01", note: "" }], confidence: "確認" });
  const b = RM.byPerson(d).find((x) => x.person.id === "b");
  assert.equal(b.level, "重い");
});

test("level：手伝い（全員の共通業務など）は重さの判定に入れず、主担当の重さで決める", () => {
  const d = fx();
  for (let i = 0; i < 8; i++) d.tasks.push({ id: "h" + i, name: "h" + i, area: "全社", freq: "毎日", owner: null, helpers: ["b"], seat: null, evidence: [{ channel: "#10", date: "2026-10-01", note: "" }], confidence: "確認" });
  const b = RM.byPerson(d).find((x) => x.person.id === "b");
  assert.ok(b.weight >= 40);                                         // 合計の重さは大きい
  assert.equal(b.mainWeight, 0);
  assert.equal(b.level, "軽い");                                     // それでも主担当は0件なので軽い
  const a = RM.byPerson(d).find((x) => x.person.id === "a");
  assert.equal(a.mainWeight, 5 + 3);
});

test("gaps：担当なしの仕事", () => {
  assert.deepEqual(RM.gaps(fx()).map((t) => t.id), ["t4"]);
});

test("single：控えがいない仕事（毎日・毎週を先に）、担当なしは含めない", () => {
  assert.deepEqual(RM.single(fx()).map((t) => t.id), ["t3", "t1"]);
});

test("ceoLoad：代表が主担当の仕事", () => {
  assert.deepEqual(RM.ceoLoad(fx(), "ceo").map((t) => t.id).sort(), ["t1", "t6"]);
});

test("byArea：部門ごとの件数・担当なし・1人だけ", () => {
  const a = RM.byArea(fx());
  assert.deepEqual(a["営業"], { tasks: 3, gaps: 1, single: 0 });
  assert.deepEqual(a["全社"], { tasks: 1, gaps: 0, single: 1 });
  assert.deepEqual(a["経営"], { tasks: 1, gaps: 0, single: 1 });
});

test("bySeat：立候補の席ごとの仕事と今の担当", () => {
  const s = RM.bySeat(fx());
  assert.deepEqual(s["S-3"].tasks.map((t) => t.id), ["t2"]);
  assert.deepEqual(s["S-3"].people, ["a", "b"]);
  assert.deepEqual(s["S-8"].people, []);
  assert.equal(s["null"], undefined);
});

test("summary：まとめの数字", () => {
  assert.deepEqual(RM.summary(fx(), "ceo"), { people: 4, tasks: 6, gaps: 1, single: 2, ceo: 2, guess: 1 });
});

test("退職者は byPerson に出さない", () => {
  const d = fx();
  d.people.push({ id: "old", name: "退職者", title: "", dept: "営業部", status: "退職" });
  assert.equal(RM.byPerson(d).some((x) => x.person.id === "old"), false);
});

test("外部（引き継ぎ元など）も byPerson に出さず、status として受け付ける", () => {
  const d = fx();
  d.people.push({ id: "ext", name: "外部の人", title: "", dept: "外部", status: "外部" });
  assert.deepEqual(RM.validate(d), []);
  assert.equal(RM.byPerson(d).some((x) => x.person.id === "ext"), false);
  assert.equal(RM.summary(d, "ceo").people, 4);
});
