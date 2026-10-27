// ヒアリング（parse の結果）→ 将来のリスク・強み・数字・不動産の価値の伝え方・次回の確認事項
// ルールは RISKS / STRENGTHS の配列。足す・直すときはここだけ（画面と CLI は表示だけ）
(function (root, factory) {
  const m = factory();
  if (typeof module === "object" && module.exports) module.exports = m;
  else Object.assign((root.HRA = root.HRA || {}), m);
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // お客様に言わない表現（事実に反する・断定・あおり）
  const FORBIDDEN = [/必ず値上がり/, /絶対に損(し|は)ない/, /今買わないと損/, /家賃は(無駄|捨て)/, /返済(は|が)(すべて|全部)資産/, /必ず売れる/, /土地は必ず/, /残りわずか/, /今だけ/];

  const man = (v) => (v == null ? "—" : (Math.round(v / 1000) / 10).toLocaleString("ja-JP") + "万円");
  const pct = (v) => (v * 100).toFixed(1) + "%";

  // 毎月 m 円・n 年・年利 r で借りられる額（元利均等）
  function pv(m, r, n) {
    const i = r / 12, k = n * 12;
    return i === 0 ? m * k : (m * (1 - Math.pow(1 + i, -k))) / i;
  }
  // ボーナス払い（半年ごと b 円）で借りられる額
  function pvBonus(b, r, n) {
    const i = r / 2, k = n * 2;
    return i === 0 ? b * k : (b * (1 - Math.pow(1 + i, -k))) / i;
  }

  function ctx(h) {
    const text = [h.summary, ...h.notes, h.loansText, h.insuranceText, h.employer, h.motive, ...h.wish.lines].join("\n");
    const lines = [...h.notes, h.summary, ...h.wish.lines, h.loansText ? "借入状況：" + h.loansText : "", h.insuranceText ? "加入保険：" + h.insuranceText : ""]
      .join("\n").split("\n").map((l) => l.trim()).filter(Boolean);
    const find = (re) => lines.find((l) => re.test(l)) || null;
    const findAll = (re) => lines.filter((l) => re.test(l));
    const amounts = h.incomes.map((x) => x.amount).filter(Boolean);
    const carMonthly = (() => {
      const l = find(/(おまとめ|車).*月\s*[\d.]+\s*万/);
      const m = l && l.match(/月\s*([\d.]+)\s*万/);
      return m ? Math.round(parseFloat(m[1]) * 10_000) : null;
    })();
    return { h, text, find, findAll, amounts, carMonthly };
  }

  function numbers(c) {
    const { h, amounts } = c;
    const latest = amounts[0] ?? null;
    const low = amounts.length ? Math.min(...amounts) : null;
    const years = h.age ? Math.max(10, Math.min(35, 80 - h.age)) : 35;
    const monthly = h.wish.monthly;
    const bonusEach = h.wish.bonusEach || 0;
    const rates = [0.01, 0.015];
    const loanAt = monthly ? rates.map((r) => ({ rate: r, amount: Math.round(pv(monthly, r, years) + pvBonus(bonusEach, r, years)) })) : [];
    const yearlyHouse = monthly ? monthly * 12 + bonusEach * 2 : null;
    const yearlyCar = (c.carMonthly || 0) * 12;
    const ratio = (inc) => (yearlyHouse != null && inc ? (yearlyHouse + yearlyCar) / inc : null);
    return {
      incomeLatest: latest,
      incomeLow: low,
      years,
      payoffAge: h.age ? h.age + years : null,
      monthly,
      bonusEach,
      loanAt,
      ratioLatest: ratio(latest),
      ratioLow: ratio(low),
      carMonthly: c.carMonthly,
      monthlyUp: monthly != null && h.rent != null ? monthly - h.rent : null,
      savings: h.savings,
      assumptions: [
        `返済期間 ${years}年（80歳完済の上限と35年の短いほう）`,
        "金利は年1.0%と1.5%の2通り（全期間この金利と仮定）",
        "希望の「持ち出し」をそのまま毎月の返済額として計算（固定資産税・保険・修繕は別）",
        "返済比率＝（住宅ローン＋車などの返済）÷年収。投資用ローンの返済は金額がわからないため含めていない〔要確認〕",
        "金融機関の審査は審査金利や基準が異なる。ここは目安",
      ],
    };
  }

  // ───────── 将来のリスク（上から順に判定。level：高・中・低） ─────────
  const RISKS = [
    {
      id: "transfer", area: "勤務地", title: "異動・転勤で住む場所が変わる",
      test: (c) => c.findAll(/異動|移動|転勤|6年ルール/).slice(0, 2).join("／") || null,
      level: () => "高",
      future: () => "買ってすぐに勤務地が変わると、長い通勤や、早い時期の住み替え（売る・貸す）の判断が必要になる。",
      value: () => "家は「ずっと住む」だけでなく「貸す・売る」も選べる資産。異動の範囲（県内か）の中心で、駅や幹線道路に近く駐車場2台の物件を選べば、異動しても通える・貸しやすい選択肢が残る。",
      ask: () => "異動の内示はいつ頃か。異動の範囲は県内か。希望（勤務地）は出せるか。",
      action: () => "内示の時期を確認し、住宅ローンの事前審査だけ先に進める（物件の決定は内示後でもよい）。",
    },
    {
      id: "partner", area: "家族", title: "決める人（パートナー・家族）が不安に思っている",
      test: (c) => {
        const one = c.find(/(彼女|婚約者|奥様|妻|夫|パートナー|ご家族|家族|親).*(厳し|反対|不安|心配)|(厳し|反対|不安|心配).*(彼女|婚約者|奥様|妻|夫|パートナー|家族|親)/);
        if (one) return one;
        // 内容要約で「誰に」と「どう思っているか」が別の行に分かれている場合
        const ls = c.h.summary.split("\n").map((l) => l.trim()).filter(Boolean);
        const who = ls.find((l) => /彼女|婚約者|奥様|妻|夫|パートナー|ご家族|家族|親/.test(l));
        const worry = ls.find((l) => /厳し|反対|不安|心配/.test(l));
        return who && worry ? (who === worry ? who : `${who}／${worry}`) : null;
      },
      level: () => "高",
      future: () => "一緒に住む人の合意がないまま進むと、契約や審査の直前で止まる。結婚後の家計は2人で決めることになる。",
      value: () => "パートナーの不安（転勤・返済・貯金）に、数字と選択肢で答える。「買うかどうか」ではなく「2人の暮らしに合うかどうか」を一緒に確かめる場にする。",
      ask: () => "パートナーが一番心配していることは何か。2人で住む場所・時期の希望は。",
      action: () => "パートナー同席の面談を設定する（決める人を同席させる）。資金計画と住宅ローン控除の試算を持参。",
    },
    {
      id: "taxLoss", area: "審査", title: "確定申告の赤字で、審査上の所得が下がる",
      test: (c) => c.find(/赤字/),
      level: () => "高",
      future: () => "不動産所得などの赤字を申告していると、住宅ローンの審査で所得が低く見られ、借りられる額が減ることがある（金融機関による）。自分で申告した場合は内容の誤りにも注意。",
      value: () => "申告書を先に確認すれば、借りられる上限を早めに正しく知れる。無理のない予算で物件を探せる。",
      ask: () => "確定申告書の控え（申告後の所得金額）はあるか。赤字の理由と金額は。",
      action: () => "確定申告書の控えを回収し、事前審査で所得の扱いを確認する。不安があれば税理士に確認。",
    },
    {
      id: "investLoan", area: "審査", title: "投資用不動産のローンがある",
      test: (c) => c.find(/投資不動産|投資用|区分マンション/),
      level: () => "高",
      future: () => "投資用ローンの返済は、住宅ローン審査の返済比率に入る。空室・修繕・金利上昇で持ち出しが増えると、家計とマイホームの返済を同時に圧迫する。",
      value: () => "マイホームは自分と家族が使う資産。投資物件と合わせた全体の収支・残高を一緒に整理し、両方を持ち続けられるかを確かめる。",
      ask: () => "投資用ローンの残高・毎月の返済額・家賃収入・管理費は。",
      action: () => "投資用ローンの返済予定表を回収し、返済比率を正しく計算する。",
    },
    {
      id: "carLoan", area: "審査", title: "車のローンが残っている",
      test: (c) => (c.h.carLoanBalance ? `車のローン残高 ${man(c.h.carLoanBalance)}` : c.find(/車.*ローン|おまとめ/)),
      level: () => "中",
      future: () => "車のローンが残る間は返済比率が上がり、住宅ローンで借りられる額が減る。",
      value: () => "完済の時期や一本化（おまとめ）で、家に使える枠を広げられる。完済後の家計の余裕も一緒に示す。",
      ask: () => "車のローンの残り期間・毎月の返済額は。",
      action: () => "おまとめ後の返済額で、返済比率を計算し直す。",
    },
    {
      id: "savings", area: "貯金", title: "手元の貯金が少ない",
      test: (c) => (c.h.savings != null && c.h.savings < 3_000_000 ? `貯金・手付金 ${man(c.h.savings)}` : null),
      level: (c) => (c.h.savings < 1_000_000 ? "高" : "中"),
      future: () => "手付金・諸費用・引っ越し・もしもの備え（生活費の6か月分）が足りず、購入後の急な出費（病気・車・家電）に弱い。",
      value: () => "諸費用もローンに含めれば、手元のお金を残したまま計画できる（その分借入と利息は増える）。購入までの貯め方も一緒に作れる。",
      ask: () => "毎月いくら貯められているか。今後1〜2年の大きな出費（結婚式・車など）は。",
      action: () => "購入時期までの貯蓄計画と、諸費用ローンの有無を比べた資金計画を作る。",
    },
    {
      id: "incomeSwing", area: "収入", title: "年収が年によって大きく違う",
      test: (c) => {
        const a = c.amounts;
        if (a.length < 2) return null;
        const hi = Math.max(...a), lo = Math.min(...a);
        return hi / lo - 1 > 0.15 ? `年収 ${a.map(man).join(" → ")}（新しい順）` : null;
      },
      level: () => "中",
      future: () => "直近だけ高い場合、手当や一時的な収入の可能性がある。審査で低い年や平均で見られると、借りられる額が想定より減る。",
      value: () => "低い年の年収でも返せる計画にしておけば、将来の収入の上下に強い家計になる。",
      ask: () => "直近の年収が増えた理由（昇給・手当・残業・一時金）は。来年も続くか。",
      action: () => "低い年の年収で返済比率を確認し、その範囲の予算を基本にする。",
    },
    {
      id: "fxInsurance", area: "固定費", title: "外貨建ての保険など、毎月の固定費が重い",
      test: (c) => c.find(/ドル建|外貨|変額/),
      level: () => "中",
      future: () => "円安・円高で保険料や受け取る額が変わる。毎月・毎年の保険料が住まいの予算を圧迫する。",
      value: () => "住宅ローンには団体信用生命保険（団信）が付き、万一のときは残高が保険で返済される。保障の重なりを見直せば、その分を住まいに回せる可能性がある。",
      ask: () => "保険の目的（貯蓄か保障か）、解約したときに戻るお金は。",
      action: () => "団信と重なる保障がないか、保険の見直しを提案する。",
    },
    {
      id: "support", area: "固定費", title: "家族への援助など、一時的な支出がある",
      test: (c) => c.find(/(妹|弟|姉|兄|親|両親|仕送り).*(支払|援助|負担)|仕送り/),
      level: () => "中",
      future: () => "援助が続く・増えると、返済に回せるお金が減る。",
      value: () => "援助が終わる時期を入れた計画にすれば、無理のない購入時期と予算がわかる。",
      ask: () => "援助はいつまで続くか。金額は変わるか。",
      action: () => "援助が終わる時期をライフプランに入れる。",
    },
    {
      id: "costUp", area: "家計", title: "今の家賃より毎月の支払いが増える",
      test: (c) => {
        const n = c.n;
        return n.monthlyUp != null && n.monthlyUp >= 20_000 ? `今の家賃 ${man(c.h.rent)} → 希望の持ち出し ${man(n.monthly)}（毎月＋${man(n.monthlyUp)}）` : null;
      },
      level: () => "中",
      future: () => "結婚・出産・育休で収入が一時的に減る時期にも、増えた支払いを続けられるかが分かれ目になる。",
      value: () => "増えた分で得られるもの（広さ・駐車場・自分たちの土地と建物）を具体的に示す。返済が進むと借入の残高は減っていく（家の価値は立地と手入れしだい）。",
      ask: () => "今の家賃より増えても、毎月いくらまでなら安心か。",
      action: () => "家賃並み・希望額・上限の3つの予算で物件を比べて見せる。",
    },
    {
      id: "bonusPay", area: "家計", title: "ボーナス払いに頼る返済",
      test: (c) => (c.h.wish.bonusEach ? `ボーナス払い 各${man(c.h.wish.bonusEach)}` : null),
      level: () => "中",
      future: () => "ボーナスは制度や業績で変わることがある。減ったときに返済が苦しくなる。",
      value: () => "ボーナス払いなしでも返せる額を基本にし、ボーナスは繰り上げ返済や貯金に回すと強い家計になる。",
      ask: () => "ボーナスの金額は毎年同じか。ボーナス払いなしの場合の予算は。",
      action: () => "ボーナス払いあり・なしの2通りで返済額を見せる。",
    },
    {
      id: "docs", area: "進め方", title: "書類が集まっていない",
      test: (c) => {
        const st = stages(c.h.docs)[0];
        return st && st.done / st.total < 0.5 ? `${st.name}の書類 ${st.done}/${st.total} 件` : null;
      },
      level: () => "中",
      future: () => "審査に必要な書類がそろわないと、事前審査に出せず、借りられる額がいつまでもわからない。",
      value: () => "書類がそろえば、借りられる額と無理のない予算が数字で出て、パートナーにも説明しやすくなる。",
      ask: () => "次回までにそろえられる書類はどれか。",
      action: () => "今の段階で未回収の書類（源泉徴収票の2期目・CIC・返済予定表など）を次回までに回収する。",
    },
    {
      id: "stall", area: "進め方", title: "商談が長引いている",
      test: (c) => {
        const h = c.h;
        const many = h.negotiations && h.negotiations >= 4;
        const low = h.rank && /[DE]/.test(h.rank);
        return many || low ? `商談ランク ${h.rank || "—"}・交渉 ${h.negotiations || "—"}回目` : null;
      },
      level: () => "低",
      future: () => "決める理由（時期・場所・人）が固まらないまま回数だけ増えると、お客様も営業も疲れてしまう。",
      value: () => "「今は買わない」も大切な選択肢。決める条件（異動先・同席・審査結果）がそろったら動く、と約束しておくと信頼が残る。",
      ask: () => "どの条件がそろえば前に進められるか。",
      action: () => "次の連絡日を決め、決める条件がそろうまで低い工数で追客する（ランクD以下は深追いしない）。",
    },
  ];

  // ───────── 強み（審査・将来でプラスになる点） ─────────
  const STRENGTHS = [
    { id: "publicJob", test: (c) => (/市立|県立|町立|村立|国立|小学校|中学校|高校|高等学校|学校|市役所|役場|公務|教員|教諭/.test(c.h.employer + c.text) ? c.h.employer || "公務員" : null),
      text: () => "勤務先が学校・役所などで、収入が安定している。長期の住宅ローンを組みやすい（審査で評価されやすい傾向）。" },
    { id: "young", test: (c) => (c.h.age && c.h.age < 35 ? `${c.h.age}歳` : null),
      text: (c) => `若いので長く返せる。${c.n.years}年返済でも${c.n.payoffAge}歳で完済でき、定年前に終わる計画も立てやすい。` },
    { id: "incomeUp", test: (c) => (c.amounts.length >= 2 && c.amounts[0] > c.amounts[1] ? `年収 ${man(c.amounts[1])} → ${man(c.amounts[0])}` : null),
      text: () => "直近の年収が伸びている（理由は確認が必要）。" },
    { id: "marriageCredit", test: (c) => (/結婚/.test(c.text) && c.h.age && c.h.age < 40 ? "動機：結婚" : null),
      text: () => "結婚後に入居すれば「若者夫婦世帯」として、住宅ローン控除の借入限度額が上乗せされる可能性がある（入居年・住宅の性能・床面積50㎡以上などの条件あり〔要確認〕）。" },
    { id: "dualIncome", test: (c) => c.find(/(彼女|婚約者|奥様|妻|夫|パートナー).*(保育士|看護|勤務|会社員|公務員|正社員|教員)/),
      text: () => "パートナーも働いていれば家計に余裕が出る。ただし予算は1人の収入で返せる額を基本にすると、産休・育休にも強い。" },
    { id: "bonus", test: (c) => (c.h.bonus ? `ボーナス 年${man(c.h.bonus)}` : null),
      text: () => "ボーナスがあり、諸費用・家具・繰り上げ返済の原資にできる。" },
  ];

  const ORDER = { 高: 0, 中: 1, 低: 2 };

  // 書類を段階（▼ S0-S1 など）ごとに数える。最初の段階＝今そろえるべき書類
  function stages(docs) {
    const out = [];
    for (const d of docs) {
      let st = out.find((x) => x.name === d.section);
      if (!st) out.push((st = { name: d.section || "書類", done: 0, total: 0, missing: [] }));
      st.total++;
      if (d.done) st.done++;
      else st.missing.push(d.name);
    }
    return out;
  }

  function analyze(h) {
    const c = ctx(h);
    c.n = numbers(c);
    const risks = RISKS.map((r, i) => {
      const ev = r.test(c);
      if (!ev) return null;
      return { id: r.id, area: r.area, title: r.title, level: r.level(c), evidence: ev, future: r.future(c), value: r.value(c), ask: r.ask(c), action: r.action(c), i };
    }).filter(Boolean).sort((a, b) => ORDER[a.level] - ORDER[b.level] || a.i - b.i);
    const strengths = STRENGTHS.map((s) => {
      const ev = s.test(c);
      return ev ? { id: s.id, evidence: ev, text: s.text(c) } : null;
    }).filter(Boolean);
    const done = h.docs.filter((d) => d.done).length;
    const next = (h.summary.match(/(\d{1,2}\/\d{1,2})に/) || [])[1];
    const nextActions = [...risks.filter((r) => r.level === "高"), ...risks.filter((r) => r.level !== "高")].map((r) => r.action);
    if (next) nextActions.unshift(`${next} の連絡で、次回の面談日を決める。`);
    // 不動産の価値の伝え方（このお客様に響く順）
    const has = (id) => risks.some((r) => r.id === id) || strengths.some((s) => s.id === id);
    const story = [];
    if (has("marriageCredit") || /結婚/.test(c.text)) story.push("「2人の暮らしの拠点」：結婚後の住まいを、賃貸の延長ではなく自分たちで決められる場所として考える。");
    if (has("transfer")) story.push("「選択肢が残る家」：異動しても通える・貸せる・売れる立地を選べば、家は縛りではなく選択肢になる。");
    if (has("costUp") || has("savings")) story.push("「無理のない数字」：低い年の年収・ボーナスなしでも返せる予算から始める。手元のお金を残す計画にする。");
    if (has("fxInsurance") || has("investLoan")) story.push("「お金の全体を整える」：保険・投資用ローン・車のローンをまとめて見直し、住まいに回せるお金を増やす。");
    if (has("publicJob") || has("young")) story.push("「安定した収入と時間が味方」：安定した勤め先と若さで、長く無理なく返す計画が立てやすい。");
    return { customer: { age: h.age, employer: h.employer, rank: h.rank, negotiations: h.negotiations, motive: h.motive, wish: h.wish }, numbers: c.n, risks, strengths, story,
      questions: risks.map((r) => r.ask), nextActions, docs: { done, total: h.docs.length, missing: h.docs.filter((d) => !d.done).map((d) => d.name), stages: stages(h.docs) } };
  }

  return { analyze, RISKS, STRENGTHS, FORBIDDEN, man, pct };
});
