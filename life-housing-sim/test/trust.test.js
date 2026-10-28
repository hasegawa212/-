// TDD：会社員の「社会的信用」と、事前審査＝選べるチケット（⑥・資料「進め方」・提案書）
// 断定しない：信用は「評価されることがある」、使えるかは審査してみないとわからない、事前審査の承認は本審査・融資を保証しない
// 働き方の入力（会社員／個人事業主）：個人事業主には確定申告書・所得の推移の話にかえる（「会社員の信用」とは言わない）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const S = require("../lib/engine");
const Share = require("../lib/share");

const d = S.defaults();
const emp = S.compute(d);
const self = S.compute({ ...d, job: "self" });
const noForbidden = (v) => { const t = JSON.stringify(v); for (const f of S.FORBIDDEN) assert.ok(typeof f === "string" ? !t.includes(f) : !f.test(t), String(f)); };

test("入力：働き方（会社員が初期値／個人事業主）。共有リンクは2つの値だけ受け付ける", () => {
  assert.equal(d.job, "employee");
  const ok = Share.decode(Share.encode({ ...d, job: "self" }, { defaults: d }), d).state;
  assert.equal(ok.job, "self");
  const h = "#s=" + Buffer.from(JSON.stringify({ job: "boss" })).toString("base64url");
  assert.equal(Share.decode(h, d).state.job, "employee");
});

test("信用の比較表：会社員と個人事業主（収入の証明・評価・書類・審査のポイント）", () => {
  const t = S.trust(emp);
  assert.deepEqual(t.table.map((r) => r.label), ["収入の証明", "収入の評価", "必要書類", "審査のポイント"]);
  assert.match(t.table[0].employee, /源泉徴収票/);
  assert.match(t.table[0].self, /確定申告書/);
  assert.match(t.selfNote, /個人事業主でも住宅ローンは利用できます/);
});

test("会社員へのメッセージ：信用を将来の選択肢に／事前審査は買う約束ではない／決めるのはあなた／注意書き", () => {
  const t = S.trust(emp);
  assert.equal(t.title, "会社員として積み上げた信用を、将来の選択肢に。");
  assert.equal(t.sub, "住宅ローンの事前審査は、家を買う約束ではない。");
  assert.equal(t.big, "買うか、買わないか。決めるのはあなた。");
  assert.match(t.note, /本審査の承認や融資実行を保証せず/);
  assert.match(t.note, /有効期限/);
  assert.ok(t.talk.length >= 6);
  assert.match(t.talk.join(""), /評価されることがあります/);
  assert.match(t.talk.join(""), /審査してみないとわかりません/);
  assert.match(t.talk.join(""), /チケット/);
  assert.doesNotMatch(t.talk.join(""), /必ず(通|借り)/);
  noForbidden(t);
});

test("個人事業主には「会社員の信用」とは言わず、確定申告書・所得の推移、書類も確定申告書にかえる", () => {
  const t = S.trust(self);
  assert.doesNotMatch(t.title + t.talk.join(""), /会社員として/);
  assert.match(t.talk.join(""), /確定申告/);
  assert.equal(t.big, "買うか、買わないか。決めるのはあなた。");
  const g = S.gate(self);
  assert.match(g.docs.find((v) => v.key === "income").name, /確定申告書/);
  assert.match(S.gate(emp).docs.find((v) => v.key === "income").name, /源泉徴収票/);
});

test("説明⑥・資料「進め方」・提案書p4に入る", () => {
  const six = S.talk(emp)[7];
  assert.match(six.show, /会社員として積み上げた信用/);
  assert.match(six.ask, /チケット|決めるのはあなた|決めればいい/);
  const st = S.deck(emp).slides.find((s) => s.key === "steps");
  assert.match(st.points.join(), /買うか、買わないか。決めるのはあなた。/);
  assert.match(st.notes.more, /信用/);
  assert.match(JSON.stringify(S.proposal(emp).pages[3]), /決めるのはあなた/);
});

test("画面：⑥に trustView（Zoomでは問いかけで伝える）、入力欄", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /function trustView\(x\)/);
  assert.match(html, /gateView\(x\) \+ trustView\(x\)/);
  assert.match(html, /\["job", /);
  assert.match(html, /body\.present \.trustbox \{ display:none; \}/);
});
