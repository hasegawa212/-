// マーシャルアーツ版：社内資料に記録されたお客様層に合わせた版
// お客様像の根拠（社内資料。顧客向け資料には数値の出典として出さない）：
//   ・商談の年齢は20代が過半、25〜29歳が最多。狙う層は25〜40歳（経営管理/03_営業/商談アポ定量分析レポート.md・営業トップ養成マニュアル.md）
//   ・北関東（茨城・栃木）の賃貸アパートに住む単身者。製造業・技術職の正社員が中心（営業トップ養成マニュアル.md）
//   ・年収は350〜450万円帯が中央、400〜500万円が最多（商談アポ定量分析・月次ファネル分析）
//   ・主力はリフォーム込みの中古戸建て（買取再販）2,800〜3,000万円。新耐震・築20年以内（物件仕入れマニュアル_再現性版.md）
//   ・諸費用・リフォーム費用も含めた一本化の資金計画。頭金を入れすぎず手元資金を残す（銀行事前申込対応マニュアル.md ほか）
//   ・返済比率の社内目安25%（既存借入の返済を含む）。変動金利1%台前半が多い（物件仕入れマニュアル・銀行事前申込対応マニュアル）
//   ・不安：独身で買う身近な例がない／払い続けられるか／親にまだ早いと言われた／転勤・地元に戻る／他社比較／川の氾濫（ハザード）
// 以下のサンプル数値はこの層を代表させた「架空の例」で、特定のお客様のものではない。
(function (root, factory) {
  const m = factory(typeof module === "object" && module.exports ? require("../lib/engine") : root.LL);
  if (typeof module === "object" && module.exports) module.exports = m;
  else ((root.LL = root.LL || {}).EDITIONS = root.LL.EDITIONS || {})[m.id] = m;
})(typeof self !== "undefined" ? self : this, function (LL) {
  const sample = {
    customer: {
      name: "", age: 28, household: "single", spouseAge: null, under19Dep: false,
      gross: 4_500_000, socialRate: 0.15, rent: 65_000, rentParking: 5_000, rentInsYear: 15_000,
      savings: 1_500_000, livingMonth: 100_000, moveInYear: 2027, moveInMonth: 3,
      existingMonthly: 12_000,      // 車のローン（仮定）
      monthlyWish: 90_000,          // 月々の支払いの希望（ヒアリング項目「月々支払」）
      taxMode: "estimate", tax: { totalIncome: 3_160_000, incomeTax: 50_000, taxable: 1_000_000, residentTax: 200_000 },
    },
    loan: { rate: 0.012, years: 35 },
    screen: { rate: 0.03 },
    props: [
      { id: "A", label: "リフォーム済み中古戸建て", kind: "resale", perf: "other", certs: false, price: 28_900_000, landPrice: 8_200_000, bldgPrice: 20_700_000,
        landArea: 165, floor: 100, builtDate: "2011-09-30", confirmDate: "", seismicCert: false, redZone: false, fromRelative: false, moveInOK: true,
        down: 0, buyCostRate: 0.05, financeCosts: true, propTaxYear: 70_000, insYear: 30_000, repairMonth: 15_000, b10: 0.4, firstBalance: null,
        attrs: { commute: 20, parking: 2, study: true, garden: true, pet: true, hazard: null } },
      { id: "B", label: "新築注文住宅", kind: "new", perf: "zeh", certs: true, price: 40_000_000, landPrice: 9_000_000, bldgPrice: 31_000_000,
        landArea: 165, floor: 105, builtDate: "2027-02-28", confirmDate: "2026-08-01", seismicCert: false, redZone: false, fromRelative: false, moveInOK: true,
        down: 0, buyCostRate: 0.075, financeCosts: true, propTaxYear: 110_000, insYear: 30_000, repairMonth: 12_000, b10: 0.5, firstBalance: null,
        attrs: { commute: 25, parking: 2, study: true, garden: true, pet: true, hazard: null } },
    ],
    condo: { price: 25_000_000, down: 0, fees: 22_000, propTaxYear: 80_000, insYear: 15_000, parking: 5_000 },
    priorities: { life: 4, cost: 4, freedom: 4, upkeep: 2, asset: 3, liquidity: 2, future: 3 },
    wishes: [
      { key: "budget", value: 110_000, must: true }, { key: "commute", value: 30, must: true }, { key: "floor", value: 80, must: false },
      { key: "parking", value: 2, must: true }, { key: "study", must: false }, { key: "garden", must: false }, { key: "pet", must: false },
      { key: "energy", must: false }, { key: "hazard", must: true }, { key: "seismic", must: true },
    ],
    drops: [0, 0.2, 0.4],
  };
  return {
    id: "martialarts",
    label: "マーシャルアーツ版",
    brand: {
      name: "株式会社 Martial Arts",
      nameEn: "MARTIAL ARTS",
      site: "martialarts.co.jp",
      tel: "03-6231-1113",
      hours: "9:00〜18:00",
      license: "〔要確認〕（宅地建物取引業 免許番号）",
      staff: "担当：＿＿＿＿＿＿",
    },
    // 自社の施工事例写真。ご提案物件・試算の物件ではないことを明記する
    photoCaption: "当社施工事例",
    photoNote: "写真は当社の施工事例です。試算に用いた物件・ご提案物件の写真ではありません。",
    sample,
    focus: 0,
    comfortRatio: 0.25, // 当社の安全目安：返済比率（既存借入を含む・年収比）25%以内
    lead: {
      p02: "家賃を払いながら、ひとりの部屋で過ごす毎日。その延長線上に、もう一つの選択肢があります。",
    },
    scenes: [
      ["LuCar", "車", "2台分の駐車場。休日は自宅で洗車も整備も。"],
      ["LuMoon", "眠り", "上下階の音がない。夜勤明けでも、ぐっすり。"],
      ["LuGamepad2", "趣味", "ゲーム、筋トレ、楽器。好きなものに一部屋使える。"],
    ],
    personas: [
      ["LuCar", "車・バイク派", "通勤も休日も、車が相棒", ["駐車場2台（並列か縦列か）", "前面道路の幅と出し入れのしやすさ", "勤務先まで車で何分か（渋滞の時間帯も）"]],
      ["LuGamepad2", "趣味の部屋がほしい派", "ゲーム・筋トレ・楽器を思いきり", ["趣味に使える独立した1部屋", "床の強さ・防音（隣家との距離）", "コンセントの数と通信回線"]],
      ["LuMapPin", "地元で長く働く派", "この街で、腰を据えて暮らしたい", ["勤務先・実家まで車で40分圏内", "スーパー・病院までの距離", "ハザードマップ（川の近くは要確認）"]],
    ],
    // P21・P24：事前審査は物件を決める前でも相談できる
    checkLoan: ["ローン事前審査", "物件を決める前でも相談できる。借入の目安を先に知る", "源泉徴収票2期分・本人確認書類など"],
    steps: [
      ["LuFileCheck", "事前審査のご相談", "物件を決める前でも大丈夫。借りられる目安を先に確認。"],
      ["LuEye", "内見", "リフォームの仕上がり、日当たり、駐車のしやすさを自分の目で。"],
      ["LuMapPin", "現地・書類の確認", "ハザード・接道・建物の状態を一緒に確認。"],
      ["LuCalendarCheck", "資金計画のご提案", "リフォーム・諸費用込みで、無理のない計画を。見送りも選択肢です。"],
    ],
    support: "購入・リフォーム・アフター点検まで、窓口ひとつでご相談いただけます。",
    // 社内資料に記録された、このお客様層に多い不安
    extraNotes: {
      2: { worry: ["独身でマイホームを買った人が身近にいない"], answer: ["同じ単身・同年代のお客様の事例（個人が特定されない形）を見せる。数字は本人の条件で計算し直す"] },
      4: { worry: ["親に「まだ早い」と言われた"], answer: ["否定せず、この資料と試算を持ち帰ってご家族と見てもらう。見学にご家族の同行も歓迎する"] },
      11: { worry: ["頭金がほとんどない"], answer: ["諸費用・リフォーム費用も含めた借入で、頭金なしでも計画できる場合がある。ただし借入が増えるぶん返済と利息も増えるので、手元資金を残せるかとセットで判断する"] },
      17: { worry: ["転勤や、地元に戻る可能性がある"], answer: ["その可能性が高いなら、今は見送るのも合理的。購入する場合は、売れる・貸せる立地かを先に確認する"] },
      19: { worry: ["車のローンがあっても家は買えるのか"], answer: ["審査では既存の借入の返済も合わせて見られる。完済の時期や、先に整理する方法も一緒に考える"] },
      21: { worry: ["川が近くて氾濫が心配"], answer: ["ハザードマップポータルサイトで浸水の想定を一緒に確認し、水災補償のある火災保険も検討する"] },
      23: { worry: ["他社の物件とも比べている"], answer: ["比べていただいて大丈夫。この適合シートを他社の物件にも当てはめると、同じ物差しで比べられる"] },
    },
  };
});
