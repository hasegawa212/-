// 割り当て案（代表だけが見る・案の段階）：代表の仕事24件と担当なしの仕事17件の行き先
// kind: move＝席に渡す／keep＝代表に残す／rule＝全員のルールにして、守られているかを見る席を決める／stop＝やめる
// 席だけを決め、人の名前は書かない（誰が座るかは立候補で決める）
(function (root, factory) {
  const m = factory();
  if (typeof module === "object" && module.exports) module.exports = m;
  else root.RM_HANDOFF = m;
})(typeof self !== "undefined" ? self : this, function () {
  return {
    // ── 代表の仕事 24件 ──
    "weekly-kpi-post": { kind: "move", seat: "S-10", note: "bot の設定と宛先の見直しごと渡す" },
    "site-monitor": { kind: "move", seat: "S-8", note: "異常が出たときに動く人を決める" },
    "daily-calendar": { kind: "move", seat: "S-10" },
    "zaitaku-map": { kind: "move", seat: "S-10", note: "記録0件のまま。続けるかも含めて任せる" },
    "tools-dev": { kind: "move", seat: "S-10", note: "日々の修正と問い合わせ窓口。大きな作り直しは代表と相談" },
    "transfer-execute": { kind: "keep", note: "実行は代表。明細の準備と照合は K-2 に渡す" },
    "rent-remit": { kind: "move", seat: "K-2", note: "記録シートと金額の準備まで。振込の実行は代表" },
    "recruit-call": { kind: "move", seat: "K-3", note: "一次の電話と日程調整。最終面接は代表" },
    "recruit-ads": { kind: "move", seat: "K-3" },
    "new-hire-setup": { kind: "move", seat: "S-2", note: "入社初日のチェックリストにする" },
    "kpi-feedback": { kind: "move", seat: "E-1", note: "一人ひとりへのコメントは部長。代表は全体へのひと言だけ" },
    "monday-meeting": { kind: "move", seat: "M-1", note: "告知・出席確認・進行。代表は話す側に回る" },
    "case-meeting": { kind: "move", seat: "E-5", note: "案件の進み具合は業務責任者が回す" },
    "expense-approve": { kind: "move", seat: "M-1", note: "一次確認まで。最終承認は代表" },
    "alrit-filing": { kind: "move", seat: "K-1" },
    "training-test": { kind: "move", seat: "S-6" },
    "reform-vendor": { kind: "move", seat: "P-2", note: "比較表を作って代表は決めるだけ" },
    "partner-lp": { kind: "move", seat: "S-8" },
    "rules": { kind: "keep", note: "ルールを決めるのは代表。守られているかは各席が見る" },
    "ceo-meeting": { kind: "keep", note: "代表が会う意味がある場面に絞る" },
    "finance": { kind: "keep" },
    "payroll": { kind: "keep", note: "確定は代表。集計は K-1 が手伝う" },
    "legal": { kind: "keep" },
    "philosophy": { kind: "keep" },
    // ── 担当なしの仕事 17件 ──
    "morning-checklist": { kind: "move", seat: "S-10", note: "宛先から退職者・外部を外し、新人を入れる" },
    "stale-alert": { kind: "move", seat: "S-3", note: "9/11から止まっている。テスト案件を消して再開" },
    "cic-myhome": { kind: "move", seat: "S-4", note: "使われなくなった#25を続けるか、#19にまとめるか決める" },
    "training-notes": { kind: "move", seat: "S-6" },
    "inbound-lp": { kind: "move", seat: "S-8", note: "反響が来たら誰が何分以内に返すかを決める" },
    "door-visit-log": { kind: "rule", seat: "E-3", note: "全員が記録。係長代理が毎日見る" },
    "voice-recorder": { kind: "rule", seat: "E-3", note: "全員が提出。係長代理が出ていない人に声をかける" },
    "deal-room": { kind: "rule", seat: "E-2", note: "全員が守る。課長が見る" },
    "prospect-report": { kind: "rule", seat: "S-3" },
    "consult-sheet": { kind: "rule", seat: "S-3", note: "提出が減った理由を最初に確かめる" },
    "docs-deposit": { kind: "rule", seat: "S-4", note: "止まった書類を代表に戻さない" },
    "case-minutes": { kind: "rule", seat: "E-5", note: "議事録の催促を代表がしない" },
    "fuel-report": { kind: "rule", seat: "E-8" },
    "car-accident": { kind: "rule", seat: "E-8" },
    "attendance": { kind: "rule", seat: "E-7", note: "代表への理由の共有も含めて、決まった形で" },
    "expense": { kind: "rule", seat: "K-1" },
    "rent-mediation": { kind: "stop", note: "使っていないチャンネル。必要なら別のチャンネルにまとめて閉じる" },
  };
});
