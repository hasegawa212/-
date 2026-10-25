// 単身者向け 戸建て所有 提案資料（16:9・18枚）ジェネレーター
// 数値はすべて下の calc() で計算し、スライド・ノート・台本(md)に同じ値を流し込む。
// node build.js → dist/単身者向け戸建て提案資料.pptx と dist/営業トーク台本.md
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const React = require("react");
const RDS = require("react-dom/server");
const sharp = require("sharp");
const Lu = require("react-icons/lu");

const COMPANY = "株式会社 Martial Arts";
const DOC_NAME = "単身者のための 戸建て所有ガイド";
const IMG = path.join(__dirname, "..", "construction-portfolio", "img");
const OUT = path.join(__dirname, "dist");

// ───────────────────────── 1. 試算条件（架空のサンプル） ─────────────────────────
const A = {
  age: 35, income: 5_500_000, rent: 100_000, savings: 6_000_000,
  price: 35_000_000, land: 100, floor: 85, parking: 1,
  down: 3_000_000, loan: 32_000_000, rate: 0.015, years: 35,
  // ── 以下は「仮定値」（根拠のある一般論の範囲で置いた試算用の値） ──
  landPrice: 15_000_000, bldgPrice: 20_000_000, // 土地・建物の内訳（仮定）
  buyCostRate: 0.07,          // 購入諸費用 物件価格の7%（仮定）
  propTaxYear: 120_000,       // 固定資産税・都市計画税 年12万円（仮定）
  insOwnYear: 30_000,         // 火災・地震保険 年3万円（仮定）
  repairMonth: 15_000,        // 修繕・設備交換の積立 月1.5万円（仮定）
  insRentYear: 20_000,        // 賃貸の家財保険 年2万円（仮定）
  renewEvery: 24,             // 賃貸の更新料 2年ごとに家賃1か月（仮定）
  rentNowArea: 40,            // 現在の賃貸の広さ 約40㎡（仮定）
  rentEqual: 130_000,         // 同等の広さの戸建て賃貸 家賃13万円（仮定）
  parkingMonth: 10_000,       // 月極駐車場 1万円（仮定）
  sellOther: 100_000,         // 売却時のその他費用（登記・印紙等）10万円（仮定）
  living: 200_000,            // 生活費 月20万円（仮定）
  // 10年後の3シナリオ（仮定）：土地は年率、建物は購入時建物価格に対する10年後の割合
  scen: [
    { key: "下落", landRate: -0.01, bldgRate: 0.40 },
    { key: "横ばい", landRate: 0.0, bldgRate: 0.50 },
    { key: "上昇", landRate: 0.01, bldgRate: 0.60 },
  ],
};

function pmtOf(P, annual, years) {
  const r = annual / 12, n = years * 12, g = Math.pow(1 + r, n);
  return (P * r * g) / (g - 1);
}
function balOf(P, annual, years, k) {
  const r = annual / 12, pm = pmtOf(P, annual, years), g = Math.pow(1 + r, k);
  return P * g - (pm * (g - 1)) / r;
}
function calc() {
  const pmt = pmtOf(A.loan, A.rate, A.years);
  const n = A.years * 12;
  const total = pmt * n;
  const bal = (y) => Math.max(0, balOf(A.loan, A.rate, A.years, y * 12));
  const yearSplit = (y) => { // y年目の年間 元金・利息
    const b0 = bal(y - 1), b1 = bal(y), prin = b0 - b1;
    return { prin, int: pmt * 12 - prin };
  };
  const buyCost = A.price * A.buyCostRate;
  const cashOut = A.down + buyCost;
  const own = {
    loan: pmt, tax: A.propTaxYear / 12, ins: A.insOwnYear / 12, repair: A.repairMonth,
  };
  own.total = own.loan + own.tax + own.ins + own.repair;
  const rentNow = { rent: A.rent, renew: A.rent / A.renewEvery, ins: A.insRentYear / 12, park: 0 };
  rentNow.total = rentNow.rent + rentNow.renew + rentNow.ins;
  const rentEq = { rent: A.rentEqual, renew: A.rentEqual / A.renewEvery, ins: A.insRentYear / 12, park: A.parkingMonth };
  rentEq.total = rentEq.rent + rentEq.renew + rentEq.ins + rentEq.park;
  const fee = (p) => (p * 0.03 + 60_000) * 1.1; // 仲介手数料の上限（400万円超）
  const b10 = bal(10);
  const scen = A.scen.map((s) => {
    const land = A.landPrice * Math.pow(1 + s.landRate, 10);
    const bldg = A.bldgPrice * s.bldgRate;
    const sale = land + bldg;
    const cost = fee(sale) + A.sellOther;
    return { ...s, land, bldg, sale, cost, bal: b10, net: sale - cost - b10 };
  });
  const pmtUp = pmtOf(A.loan, A.rate + 0.01, A.years);
  const altLoan = A.loan + 2_000_000; // 頭金を100万円にした場合
  const altPmt = pmtOf(altLoan, A.rate, A.years);
  return {
    pmt, total, interest: total - A.loan, bal, yearSplit, buyCost, cashOut,
    cashLeft: A.savings - cashOut, reserve: A.living * 6,
    dti: (pmt * 12) / A.income, own, rentNow, rentEq, scen, b10,
    prin10: A.loan - b10, pmtUp, altLoan, altPmt, altLeft: A.savings - 1_000_000 - buyCost,
    payoffAge: A.age + A.years,
  };
}
const K = calc();

// 表示用フォーマッタ
const yen = (v) => Math.round(v).toLocaleString("ja-JP") + "円";
const man = (v, d = 0) => (v / 10_000).toLocaleString("ja-JP", { minimumFractionDigits: d, maximumFractionDigits: d }) + "万円";
const manN = (v, d = 0) => (v / 10_000).toLocaleString("ja-JP", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (v, d = 1) => (v * 100).toFixed(d) + "%";
const sgn = (v) => (v >= 0 ? "＋" : "−") + man(Math.abs(v));

// ───────────────────────── 2. デザイン ─────────────────────────
const H = {
  navy: "1C2B45", char: "2B2F36", white: "FFFFFF", mist: "F2F3F5", line: "DADDE2",
  gold: "A8854A", goldL: "E9DFCB", blue: "4F6D8F", blueL: "DCE4EE", gray: "6B7280",
  loss: "A65440", gain: "3F7A5C",
};
const FONT_H = "Yu Mincho";
const FONT_B = "Yu Gothic";
const W = 13.333, M = 0.6, CW = W - 2 * M;

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.title = "ひとりで暮らす。だから、住まいを自分で選ぶ。";
pres.subject = "単身者向け 戸建て所有 提案資料";
pres.author = COMPANY;
pres.company = COMPANY;
pres.theme = { headFontFace: FONT_H, bodyFontFace: FONT_B };

pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: H.white },
  margin: [0.5, 0.6, 0.5, 0.6],
  objects: [
    { text: { text: DOC_NAME, options: { x: M, y: 7.02, w: 6, h: 0.3, fontSize: 9, color: H.gray, fontFace: FONT_B, margin: 0 } } },
    { text: { text: COMPANY, options: { x: 6.7, y: 7.02, w: 5.3, h: 0.3, fontSize: 9, color: H.gray, fontFace: FONT_B, align: "right", margin: 0 } } },
    { placeholder: { options: { name: "kicker", type: "body", x: M, y: 0.4, w: CW, h: 0.34, fontSize: 12, bold: true, color: H.gold, fontFace: FONT_B, margin: 0, valign: "middle", align: "left" }, text: "" } },
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.76, w: CW, h: 0.8, fontSize: 26, bold: true, color: H.navy, fontFace: FONT_H, margin: 0, valign: "middle", align: "left" }, text: "" } },
  ],
  slideNumber: { x: 12.23, y: 7.02, w: 0.5, h: 0.3, fontSize: 9, color: H.gray, fontFace: FONT_B, align: "right" },
});
pres.defineSlideMaster({ title: "DARK", background: { color: H.navy } });

async function icon(name, color, size = 256) {
  const svg = RDS.renderToStaticMarkup(React.createElement(Lu[name], { size, color: "#" + color }))
    .replace(/currentColor/g, "#" + color);
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}
const shadow = () => ({ type: "outer", color: "1C2B45", blur: 8, offset: 2, angle: 90, opacity: 0.12 });

// 共通の部品
function T(s, text, x, y, w, h, o = {}) {
  s.addText(text, { x, y, w, h, isTextBox: true, margin: 0, fontFace: FONT_B, fontSize: 14, color: H.char, valign: "top", ...o });
}
function card(s, x, y, w, h, fill = H.mist, o = {}) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: fill }, line: { color: fill }, ...o });
}
function photo(s, file, x, y, w, h, caption) {
  s.addImage({ path: path.join(IMG, file), x, y, w, h, sizing: { type: "cover", w, h }, altText: caption || "施工事例写真（イメージ）" });
  if (caption) {
    s.addShape(pres.shapes.RECTANGLE, { x, y: y + h - 0.32, w, h: 0.32, fill: { color: "000000", transparency: 45 }, line: { color: "000000", transparency: 100 } });
    T(s, caption, x + 0.12, y + h - 0.32, w - 0.24, 0.32, { fontSize: 9, color: H.white, valign: "middle" });
  }
}
function note(s, text) { T(s, text, M, 6.42, CW, 0.5, { fontSize: 10, color: H.gray, valign: "bottom" }); }
function badge(s, x, y, d, label, fill = H.gold, color = H.white, fs = 12) {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill } });
  T(s, label, x, y, d, d, { fontSize: fs, bold: true, color, align: "center", valign: "middle" });
}
async function iconDisc(s, name, x, y, d, fill = H.navy, color = "FFFFFF") {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill } });
  const p = d * 0.26;
  s.addImage({ data: await icon(name, color), x: x + p, y: y + p, w: d - 2 * p, h: d - 2 * p });
}
const NOTES = [];
function slideOf(section, kicker, title, notes) {
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: section });
  s.addText(kicker, { placeholder: "kicker", align: "left" });
  s.addText(title, { placeholder: "title", align: "left" });
  addNotes(s, kicker, title, notes);
  return s;
}
function addNotes(s, kicker, title, n) {
  const qa = n.qa.map((x) => `Q「${x[0]}」\nA ${x[1]}`).join("\n\n");
  const txt = `【このページで伝えるべきこと】\n${n.point}\n\n【顧客に投げかける質問】\n${n.ask.map((q) => "・" + q).join("\n")}\n\n【よくある反論と回答】\n${qa}`;
  s.addNotes(txt);
  NOTES.push({ kicker, title, ...n });
}
const TBL = { fontFace: FONT_B, fontSize: 12, color: H.char, valign: "middle", margin: [0.04, 0.1, 0.04, 0.1] };
const th = (text, o = {}) => ({ text, options: { ...TBL, bold: true, color: H.white, fill: { color: H.navy }, ...o } });
const td = (text, o = {}) => ({ text, options: { ...TBL, fill: { color: H.white }, ...o } });

// ───────────────────────── 3. スライド ─────────────────────────
async function build() {
  const S1 = "導入｜暮らしから考える", S2 = "価値｜不動産だけが持つもの", S3 = "資金｜数字で確かめる", S4 = "判断｜自分で選ぶ";

  // P01 表紙
  {
    pres.addSection({ title: S1 });
    const s = pres.addSlide({ masterName: "DARK", sectionTitle: S1 });
    photo(s, "p23.jpg", 6.35, 0, W - 6.35, 7.5, "写真は当社施工事例（イメージ）です。試算に用いた物件とは異なります。");
    T(s, "PROPOSAL FOR SINGLE LIVING", M, 1.1, 5.5, 0.35, { fontSize: 12, color: H.gold, bold: true, charSpacing: 3 });
    T(s, "ひとりで暮らす。\nだから、住まいを\n自分で選ぶ。", M, 1.65, 5.6, 2.9, { fontFace: FONT_H, fontSize: 40, bold: true, color: H.white, lineSpacingMultiple: 1.15 });
    T(s, "土地と建物を所有する、新しい暮らしの選択肢", M, 4.75, 5.6, 0.5, { fontSize: 16, color: H.goldL });
    T(s, "単身者のための 戸建て所有 提案資料", M, 6.25, 5.5, 0.3, { fontSize: 11, color: "C9D0DA" });
    T(s, COMPANY, M, 6.6, 5.5, 0.35, { fontSize: 13, bold: true, color: H.white });
    addNotes(s, "P01｜表紙", "ひとりで暮らす。だから、住まいを自分で選ぶ。", {
      point: "この資料は物件を売り込むためのものではなく、「自分にとって家を所有する意味」を一緒に整理するためのものだと最初に宣言する。結論（買う／買わない）はお客様が決める、というスタンスを示して心理的なガードを下げる。",
      ask: ["今日はどんなことが分かれば「来てよかった」と思えますか？", "住まいについて、最近いちばん気になっていることは何ですか？"],
      qa: [["今日は話を聞くだけのつもりです。", "それで大丈夫です。今日のゴールは購入の判断ではなく、賃貸・マンション・戸建てを同じ物差しで比べられるようになることです。資料はお持ち帰りいただけます。"]],
    });
  }

  // P02 なぜ今「住まい」を考えるのか
  {
    const s = slideOf(S1, "P02｜なぜ、今「住まい」を考えるのか", "買うかどうかの前に、「これからどう暮らしたいか」を考える", {
      point: "賃貸・分譲マンション・土地付き戸建ての3つは優劣ではなく「暮らし方の違い」。購入の是非から入らず、暮らしの希望から逆算する順番を共有する。",
      ask: ["この先5年・10年、今の地域に住み続けるイメージはありますか？", "家で過ごす時間のうち、いちばん大切にしたい時間は何ですか？", "今の住まいで「本当はこうしたい」と思っていることは？"],
      qa: [["単身で家を買うのは早い気がします。", "早い・遅いの正解はありません。ただ、判断材料がないまま先送りすると「選ばなかった」のと同じになります。今日は材料をそろえるだけで十分です。"]],
    });
    const opts = [
      ["LuKeyRound", "賃貸", "身軽さと柔軟性", "住み替え・転勤に対応しやすい。設備故障などはオーナー側の負担が基本。所有にともなう資産は残らない。"],
      ["LuBuilding2", "分譲マンション", "利便性と管理の任せやすさ", "駅近・都市部に多い。共用部の管理は管理組合・管理会社が担い、管理費・修繕積立金を負担する。"],
      ["LuHouse", "土地付き戸建て", "独立性と空間の自由度", "土地と1棟の建物を所有する。使い方の自由度が高い一方、維持管理は自分で計画・負担する。"],
    ];
    const cw = (CW - 0.6) / 3;
    for (let i = 0; i < 3; i++) {
      const x = M + i * (cw + 0.3), y = 1.85;
      card(s, x, y, cw, 3.25, i === 2 ? H.navy : H.mist);
      const dark = i === 2;
      await iconDisc(s, opts[i][0], x + 0.35, y + 0.35, 0.75, dark ? H.gold : H.navy);
      T(s, opts[i][1], x + 1.25, y + 0.38, cw - 1.5, 0.4, { fontSize: 18, bold: true, color: dark ? H.white : H.navy });
      T(s, opts[i][2], x + 1.25, y + 0.8, cw - 1.5, 0.35, { fontSize: 13, color: dark ? H.goldL : H.gold, bold: true });
      T(s, opts[i][3], x + 0.35, y + 1.4, cw - 0.7, 1.7, { fontSize: 14, color: dark ? "E6E9EE" : H.char, lineSpacingMultiple: 1.2 });
    }
    card(s, M, 5.35, CW, 1.0, H.goldL);
    T(s, "考える順番", M + 0.35, 5.35, 1.6, 1.0, { fontSize: 13, bold: true, color: H.gold, valign: "middle" });
    T(s, "① どう暮らしたいか　→　② 合う住まい方は　→　③ 無理なく続くか　→　④ 物件を選ぶ", M + 1.95, 5.35, CW - 2.2, 1.0, { fontSize: 16, bold: true, color: H.navy, valign: "middle" });
    note(s, "※ 各選択肢の特徴は一般的な傾向です。個別の物件・契約・管理規約によって異なります。");
  }

  // P03 単身者が戸建てを持つという選択
  {
    const s = slideOf(S1, "P03｜単身者が戸建てを持つという選択", "家族のためではなく、「自分の暮らし」のために持つ家", {
      point: "戸建て＝ファミリー向け、という前提を外す。結婚・子育てを前提にせず、プライバシー・趣味・仕事・車やペットといった「自分の時間の質」のために空間を持つという考え方を示す。",
      ask: ["休日、家でいちばん長く過ごしている場所はどこですか？", "今の住まいで我慢していることを3つ挙げるとしたら？", "車・バイク・ペット・楽器など、置き場所に困っているものはありますか？"],
      qa: [["一人で85㎡は広すぎませんか？", "使わない部屋が生まれるなら広すぎます。だからこそ「何に使うか」を先に決めます。用途が決まらない場合は、もっとコンパクトな物件や賃貸のほうが合理的なこともあります。"],
        ["将来結婚したらどうするの？", "本資料は結婚を前提にしていません。家族構成が変わった場合は、住み続ける・売却する・住み替えるといった選択肢を、その時点の状況で検討します（P14〜15参照）。"]],
    });
    photo(s, "p14.jpg", M, 1.85, 4.3, 4.45, "施工事例（イメージ）");
    const items = [
      ["LuLock", "プライバシー", "上下左右に住戸がない。生活音への気づかいが減る"],
      ["LuGuitar", "趣味", "楽器・模型・アウトドア用品を広げたままにできる"],
      ["LuLaptop", "仕事", "生活空間と切り離したワークスペースを持てる"],
      ["LuPackage", "収納", "季節用品やストックを無理なくしまえる"],
      ["LuCar", "車・バイク", "敷地内の駐車場で、出し入れや手入れがしやすい"],
      ["LuPawPrint", "ペット", "飼育規約に縛られにくい（近隣への配慮は必要）"],
    ];
    const gx = M + 4.6, gw = (CW - 4.6 - 0.3) / 2, gh = 1.3;
    for (let i = 0; i < 6; i++) {
      const x = gx + (i % 2) * (gw + 0.3), y = 1.85 + Math.floor(i / 2) * (gh + 0.275);
      card(s, x, y, gw, gh, H.mist);
      await iconDisc(s, items[i][0], x + 0.25, y + 0.3, 0.7);
      T(s, items[i][1], x + 1.15, y + 0.2, gw - 1.35, 0.38, { fontSize: 16, bold: true, color: H.navy });
      T(s, items[i][2], x + 1.15, y + 0.6, gw - 1.35, 0.6, { fontSize: 13 });
    }
    note(s, "※ 実現できるかどうかは物件の間取り・敷地条件・法令・近隣環境によって異なります。");
  }

  // P04 株式・NISAと不動産の違い
  {
    pres.addSection({ title: S2 });
    const s = slideOf(S2, "P04｜株式・NISAと不動産の違い", "どちらが上かではなく、「役割」が違う", {
      point: "金融資産と自宅は目的が違う。金融資産は「増やす・備える」、自宅は「住む・使う」が主目的。流動性・分散・維持コストでは金融資産が有利な面がはっきりあることを正直に伝え、そのうえで不動産にしかない機能（住める・使える・長期借入で取得できる）を示す。両立も可能。",
      ask: ["今、NISAやiDeCoなどで積立をしていますか？ 続けたいですか？", "資産形成で一番大事にしているのは「増やす」「守る」「使う」のどれですか？"],
      qa: [["家を買うよりNISAで運用したほうが得では？", "利回りや換金性だけで比べれば、その考え方は合理的です。ただ自宅は「住む場所」でもあるので、利回りだけでは比べられません。購入後も積立を続けられる返済計画にすること——それが両立の条件です。"],
        ["不動産は値下がりするから損では？", "値下がりの可能性はあります。だから本資料では価格を保証せず、下落・横ばい・上昇の3シナリオで手取りまで確認します（P14〜15）。"]],
    });
    const rows = [
      ["主な目的", "値上がり・配当などによる資産形成", "住むこと。資産性は立地・建物の状態・市場で変わる"],
      ["日常での利用", "使うことはできない（保有するもの）", "住む・使う・空間を自分の暮らしに合わせられる"],
      ["現金化のしやすさ", "市場で比較的すぐ売却できる（価格は変動）", "売却に数か月かかることが多く、仲介手数料などの費用もかかる"],
      ["維持管理", "ほぼ不要（信託報酬などの保有コストはある）", "修繕・設備交換・税金・保険が継続して必要"],
      ["借入", "通常は自己資金の範囲で行う", "住宅ローンで長期の借入が使える（返済義務・金利リスクあり）"],
      ["分散", "少額から多数の銘柄・地域に分散しやすい", "1つの資産・1つの立地に集中する"],
      ["主なリスク", "価格変動・為替変動など", "価格変動・災害・修繕・金利上昇・売れにくさ"],
      ["税制", "NISAは運用益が非課税になる「口座の制度」", "住宅ローン控除・固定資産税など（要件は年度で変わる）"],
    ];
    const data = [[th("比較項目"), th("株式・投資信託（NISA口座などで保有）"), th("自宅（土地付き戸建て）", { fill: { color: H.gold } })]];
    rows.forEach((r, i) => {
      const f = i % 2 ? H.white : H.mist;
      data.push([td(r[0], { bold: true, color: H.navy, fill: { color: f } }), td(r[1], { fill: { color: f } }), td(r[2], { fill: { color: f } })]);
    });
    s.addTable(data, { x: M, y: 1.8, w: CW, colW: [2.1, 5.0, 5.03], rowH: 0.47, border: { type: "solid", pt: 0.5, color: H.line } });
    note(s, "※ NISAは投資で得た利益が非課税になる制度（口座）であり、投資商品そのものではありません。非課税枠・対象商品などの詳細は金融庁の最新情報をご確認ください。本資料は特定の金融商品の勧誘を目的とするものではありません。");
  }

  // P05 住める資産
  {
    const s = slideOf(S2, "P05｜不動産だけが持つ「住める資産」という特徴", "毎月の支払いが、「暮らし」と「所有」の両方につながる", {
      point: "家賃は「住む権利」の対価で、所有は残らない。ローン返済は「元金（借入が減る部分）」と「利息（借りるためのコスト）」に分かれ、住みながら借入残高が減っていく。ただし元金の返済分がそのまま資産として手元に残るわけではなく、売却価格しだい（P13・P15）であることも同時に伝える。",
      ask: ["これまで家賃を合計でいくらくらい払ってきたか、計算したことはありますか？", "毎月の支払いのうち、「何に対して払っているか」を意識したことはありますか？"],
      qa: [["家賃は捨て金でしょう？", "そうは考えていません。家賃は「身軽さ」や「修繕を任せられる安心」への対価です。違いは、所有の場合は住みながら借入残高が減っていく点にあります。"],
        ["返済した分は全部自分の資産になる？", "なりません。元金を返した分だけ借入は減りますが、手元に残る金額は「売却価格 − 売却費用 − 残債」で決まります。建物は年数とともに価値が下がるのが一般的です。"]],
    });
    // 左：概念図
    const lx = M, lw = 5.6;
    card(s, lx, 1.85, lw, 1.55, H.mist);
    T(s, "賃貸", lx + 0.3, 2.0, 1.2, 0.4, { fontSize: 16, bold: true, color: H.navy });
    T(s, `家賃 ${manN(A.rent)}万円/月`, lx + 0.3, 2.45, 2.2, 0.4, { fontSize: 14 });
    s.addShape(pres.shapes.RIGHT_ARROW, { x: lx + 2.55, y: 2.45, w: 0.55, h: 0.35, fill: { color: H.gray }, line: { color: H.gray } });
    T(s, "住む権利（所有は残らない）", lx + 3.2, 2.35, 2.3, 0.6, { fontSize: 14, bold: true, color: H.char, valign: "middle" });
    card(s, lx, 3.6, lw, 2.6, H.navy);
    T(s, "所有（住宅ローン）", lx + 0.3, 3.75, 3, 0.4, { fontSize: 16, bold: true, color: H.white });
    T(s, `返済 約${manN(K.pmt, 1)}万円/月`, lx + 0.3, 4.2, 2.3, 0.4, { fontSize: 14, color: "E6E9EE" });
    s.addShape(pres.shapes.RIGHT_ARROW, { x: lx + 2.55, y: 4.25, w: 0.55, h: 0.35, fill: { color: H.gold }, line: { color: H.gold } });
    T(s, [{ text: "元金", options: { bold: true, color: H.goldL, breakLine: true } }, { text: "借入残高が減る", options: { color: H.white } }], lx + 3.2, 3.95, 2.3, 0.7, { fontSize: 14 });
    T(s, [{ text: "利息", options: { bold: true, color: H.goldL, breakLine: true } }, { text: "お金を借りるコスト", options: { color: H.white } }], lx + 3.2, 4.7, 2.3, 0.7, { fontSize: 14 });
    T(s, "＋ 住む・使う（居住価値）", lx + 0.3, 5.55, lw - 0.6, 0.45, { fontSize: 15, bold: true, color: H.gold });
    // 右：元金・利息の推移
    const yrs = [1, 10, 20, 35], sp = yrs.map(K.yearSplit);
    s.addChart(pres.charts.BAR, [
      { name: "元金", labels: yrs.map((y) => y + "年目"), values: sp.map((x) => +(x.prin / 10_000).toFixed(1)) },
      { name: "利息", labels: yrs.map((y) => y + "年目"), values: sp.map((x) => +(x.int / 10_000).toFixed(1)) },
    ], {
      x: 6.55, y: 1.8, w: 6.18, h: 4.45, barDir: "col", barGrouping: "stacked", chartColors: [H.navy, H.gold],
      showTitle: true, title: "年間返済額の内訳（万円）", titleFontSize: 13, titleColor: H.char, titleFontFace: "+mn-lt",
      showValue: true, dataLabelPosition: "ctr", dataLabelColor: H.white, dataLabelFontSize: 11, dataLabelFontFace: "+mn-lt", dataLabelFormatCode: '[<3]"";0.0',
      showLegend: true, legendPos: "b", legendFontSize: 11, legendFontFace: "+mn-lt", legendColor: H.char,
      catAxisLabelColor: H.gray, catAxisLabelFontSize: 11, catAxisLabelFontFace: "+mn-lt", valAxisLabelColor: H.gray, valAxisLabelFontSize: 10, valAxisLabelFontFace: "+mn-lt",
      valGridLine: { color: "E5E7EB", size: 0.5 }, catGridLine: { style: "none" }, valAxisMaxVal: 120, barGapWidthPct: 60,
    });
    note(s, `※ 試算条件：借入${man(A.loan)}・年利${pct(A.rate)}（試算用の仮定）・${A.years}年・元利均等返済。毎月の返済額は一定で、返済が進むほど元金の割合が増えます。`);
  }

  // P06 土地を所有する価値
  {
    const s = slideOf(S2, "P06｜土地を所有する価値", "土地は、ひとつとして同じものがない", {
      point: "土地の価値は「どこに・どんな条件で」あるかで決まる。立地・接道・形状・用途地域・市場性の5つの視点で見ると、同じ価格でも中身が違うことが分かる。所有者は法令の範囲で利用・処分できる。値上がりは保証できないことを明確に伝える。",
      ask: ["住む場所を選ぶときに、絶対に譲れない条件は何ですか？", "ハザードマップを確認したことはありますか？"],
      qa: [["土地は値下がりしないんでしょう？", "いいえ、土地価格も人口動態や地域の需要で上下します。だからこそ、立地・接道・用途地域など「価値の理由」を一つずつ確認することが大切です。"],
        ["土地を持っていれば何でも建てられる？", "建てられる建物は、建築基準法や都市計画法（用途地域・建ぺい率・容積率など）で決まります。購入前に重要事項説明で必ず確認します。"]],
    });
    photo(s, "p15.jpg", 8.55, 1.85, 4.18, 4.4, "施工事例（イメージ）");
    const f = [
      ["LuMapPin", "立地", "駅・商業施設・職場への距離、周辺環境、災害リスク（ハザードマップ）"],
      ["LuRoute", "接道", "建物を建てるには原則、幅4m以上の道路に2m以上接する必要がある"],
      ["LuShapes", "形状", "整形地・旗竿地・高低差などで、使いやすさと建てられる建物が変わる"],
      ["LuLandmark", "用途地域", "建てられる建物の種類や建ぺい率・容積率などが、法令で定められている"],
      ["LuScale", "市場性", "売却時にどれだけ買い手が見つかりやすいか。需要は地域で大きく異なる"],
    ];
    for (let i = 0; i < 5; i++) {
      const y = 1.85 + i * 0.89;
      await iconDisc(s, f[i][0], M, y + 0.05, 0.62, i % 2 ? H.blue : H.navy);
      T(s, f[i][1], M + 0.85, y, 1.45, 0.72, { fontSize: 16, bold: true, color: H.navy, valign: "middle" });
      T(s, f[i][2], M + 2.3, y, 5.4, 0.72, { fontSize: 14, valign: "middle" });
    }
    note(s, "※ 接道義務は建築基準法第43条（例外あり）。所有者は法令等の範囲内で土地を利用・処分できます。土地価格の上昇を保証するものではありません。");
  }

  // P07 土地と建物は価値の性質が違う
  {
    const s = slideOf(S2, "P07｜土地と建物は価値の性質が違う", "土地は「市場」で、建物は「時間と手入れ」で価値が動く", {
      point: "物件価格を土地と建物に分けて考える。建物は経年で価値が下がるのが一般的で、修繕・リフォームの状況で差がつく。土地は経年劣化しないが、立地や市場需要で上下する。だから「どこの土地か」と「どう手入れするか」の両方が大切。",
      ask: ["この物件価格のうち、土地と建物がそれぞれいくらか気になりますか？", "10年後・20年後、どのくらい手入れをしていくイメージですか？"],
      qa: [["木造は22年で価値ゼロと聞きました。", "22年は税法上の「法定耐用年数」で、建物の寿命ではありません。ただ中古市場では築年数とともに建物の評価が下がるのが一般的なので、点検・修繕の記録を残すことが売却時の評価にもつながります。"]],
    });
    const yrs = [0, 5, 10, 15, 20, 25, 30];
    const bl = [2000, 1500, 1000, 700, 500, 400, 300];
    s.addChart(pres.charts.LINE, [
      { name: "土地（横ばいと仮定）", labels: yrs.map((y) => "築" + y + "年"), values: yrs.map(() => 1500) },
      { name: "建物（経年で下がる一例）", labels: yrs.map((y) => "築" + y + "年"), values: bl },
    ], {
      x: M, y: 1.8, w: 7.3, h: 4.45, chartColors: [H.gold, H.navy], lineSize: 3, lineDataSymbol: "circle", lineDataSymbolSize: 7,
      showTitle: true, title: "概念図：価値の動き方の違い（万円）", titleFontSize: 13, titleColor: H.char, titleFontFace: "+mn-lt",
      showLegend: true, legendPos: "b", legendFontSize: 11, legendFontFace: "+mn-lt", legendColor: H.char,
      catAxisLabelColor: H.gray, catAxisLabelFontSize: 11, catAxisLabelFontFace: "+mn-lt", valAxisLabelColor: H.gray, valAxisLabelFontSize: 10, valAxisLabelFontFace: "+mn-lt",
      valGridLine: { color: "E5E7EB", size: 0.5 }, catGridLine: { style: "none" }, valAxisMinVal: 0, valAxisMaxVal: 2500,
    });
    const cx = 8.25, cw = CW - (cx - M);
    card(s, cx, 1.85, cw, 2.1, H.goldL);
    T(s, "土地", cx + 0.3, 2.0, 2, 0.4, { fontSize: 18, bold: true, color: H.gold });
    T(s, "経年劣化しない。価値は立地・需要・金利・人口動態など「市場」で上下する。", cx + 0.3, 2.45, cw - 0.6, 1.4, { fontSize: 14, lineSpacingMultiple: 1.2 });
    card(s, cx, 4.15, cw, 2.1, H.navy);
    T(s, "建物", cx + 0.3, 4.3, 2, 0.4, { fontSize: 18, bold: true, color: H.white });
    T(s, "経年で価値が下がるのが一般的。点検・修繕・リフォームの状況で評価に差がつく。", cx + 0.3, 4.75, cw - 0.6, 1.4, { fontSize: 14, color: "E6E9EE", lineSpacingMultiple: 1.2 });
    note(s, `※ 概念図です。将来価格を示すものではありません。本試算では物件価格${man(A.price)}を土地${man(A.landPrice)}・建物${man(A.bldgPrice)}と仮定。木造住宅の法定耐用年数22年は税務上の基準で、建物の寿命ではありません。`);
  }

  // P08 マンションではなく戸建て
  {
    const s = slideOf(S2, "P08｜マンションではなく戸建てを選ぶ理由", "戸建ては、土地と建物を「自分の判断」で管理できる", {
      point: "マンションにも敷地の共有持分（敷地利用権）がある。違いは「土地を単独で持つか、区分所有者で共有するか」と「管理を自分で決めるか、管理組合で決めるか」。駅近の利便性や流通性はマンションに強みがあることも正直に示す。",
      ask: ["マンションと比べるとき、いちばん気になる点はどこですか？", "管理を「任せたい」派ですか、「自分で決めたい」派ですか？"],
      qa: [["マンションは土地がないから資産にならないのでは？", "それは誤解です。分譲マンションでも敷地を区分所有者で共有しています。違いは、持ち方（単独か共有か）と、管理・建替えなどを自分だけで決められるかどうかです。"],
        ["戸建ては修繕費が読めなくて不安です。", "その通り、戸建ては自分で積み立てる必要があります。本試算では月1.5万円の修繕積立を「仮定値」として住居費に含めています（P12）。"]],
    });
    const rows = [
      ["土地の権利形態", "敷地を区分所有者で共有（敷地利用権）", "土地を単独で所有（所有権の場合）"],
      ["建物の独立性", "壁・床・天井で隣の住戸と接する", "独立した1棟"],
      ["管理方法", "管理組合で合意形成し、管理会社へ委託が一般的", "自分で計画し、自分で実行"],
      ["管理費", "管理費・修繕積立金を毎月負担", "なし（ただし自分で積み立てが必要）"],
      ["修繕負担", "長期修繕計画に沿って共同で負担", "時期・内容・費用を自分で判断（全額自己負担）"],
      ["駐車場", "別契約・空き待ちのことも。使用料がかかる場合が多い", "敷地内に確保できる物件が多い（本件1台）"],
      ["プライバシー", "上下左右の生活音に配慮が必要", "隣家との距離をとりやすい"],
      ["改修の自由度", "専有部分のみ・管理規約の範囲内", "法令の範囲で比較的自由（構造上の制約あり）"],
      ["立地", "駅近・都市部に多い", "郊外・住宅地に多い傾向"],
      ["売却時の市場性", "駅近などは流通しやすい傾向", "立地・土地条件による個別性が大きい"],
    ];
    const data = [[th("比較項目"), th("分譲マンション"), th("土地付き戸建て", { fill: { color: H.gold } })]];
    rows.forEach((r, i) => {
      const f = i % 2 ? H.white : H.mist;
      data.push([td(r[0], { bold: true, color: H.navy, fill: { color: f } }), td(r[1], { fill: { color: f } }), td(r[2], { fill: { color: f } })]);
    });
    s.addTable(data, { x: M, y: 1.8, w: CW, colW: [2.1, 5.0, 5.03], rowH: 0.41, border: { type: "solid", pt: 0.5, color: H.line } });
    note(s, "※ 一般的な傾向の比較です。権利形態・管理方法・駐車場の有無などは物件ごとに異なります。");
  }

  // P09 賃貸では実現しにくい暮らし
  {
    const s = slideOf(S2, "P09｜賃貸では実現しにくい暮らし", "「自分仕様」の空間を、自分の判断でつくれる", {
      point: "賃貸ではペット・改装・音・駐車場などで制約を受けやすい。所有なら、法令と近隣への配慮の範囲で、自分の暮らしに合わせて空間を使い分けられる。お客様の「やりたいこと」をここで具体的に言葉にしてもらう。",
      ask: ["空いている一部屋があったら、何に使いたいですか？", "いま賃貸の規約であきらめていることはありますか？"],
      qa: [["賃貸でも広い部屋を借りれば同じでは？", "広さは家賃で買えます。ただ壁の造作・防音・駐車場・ペットなどは、賃貸では契約上の制約を受けやすい部分です。P12では「同じ広さの賃貸」とも比べています。"]],
    });
    const scenes = [
      ["p03.jpg", "趣味部屋", "楽器・コレクション・トレーニング"],
      ["p01.jpg", "ガレージ・駐車場", "車やバイクの手入れを自宅で"],
      ["p26.jpg", "仕事部屋", "オンとオフを部屋で切り替える"],
    ];
    const pw = (CW - 0.6) / 3;
    scenes.forEach((sc, i) => {
      const x = M + i * (pw + 0.3);
      photo(s, sc[0], x, 1.85, pw, 2.55);
      T(s, sc[1], x, 4.5, pw, 0.4, { fontSize: 17, bold: true, color: H.navy });
      T(s, sc[2], x, 4.9, pw, 0.35, { fontSize: 14 });
    });
    const more = [["LuTrees", "庭・アウトドア"], ["LuPawPrint", "ペットスペース"], ["LuHammer", "DIY・工房"], ["LuPackage", "大型収納"]];
    const mw = (CW - 0.9) / 4;
    for (let i = 0; i < 4; i++) {
      const x = M + i * (mw + 0.3);
      card(s, x, 5.4, mw, 0.75, H.mist);
      await iconDisc(s, more[i][0], x + 0.2, 5.5, 0.55, H.gold);
      T(s, more[i][1], x + 0.95, 5.4, mw - 1.1, 0.75, { fontSize: 15, bold: true, color: H.navy, valign: "middle" });
    }
    note(s, "※ 写真は当社施工事例（イメージ）で、試算の物件ではありません。実現できるかは物件・敷地条件・法令・近隣環境によって異なります。");
  }

  // P10 購入前と購入後の暮らし
  {
    const s = slideOf(S2, "P10｜購入前と購入後の暮らし", "住居費が近くても、得られる暮らしが変わる", {
      point: "数字の比較に入る前に、暮らしの中身を並べる。広さ・収納・音・自由度は向上する一方、通勤時間や維持管理の手間は悪化する可能性がある、というトレードオフも隠さず示す。",
      ask: ["今の通勤時間は何分ですか？ どこまでなら許容できますか？", "2階建ての階段は、将来も含めて気になりますか？"],
      qa: [["郊外になると通勤が大変になりそう。", "物件によってはそうなります。広さと通勤時間はトレードオフになりやすいので、許容できる通勤時間を先に決めてから物件を探すのがおすすめです。"]],
    });
    s.addShape(pres.shapes.RECTANGLE, { x: M, y: 1.85, w: 3.6, h: 4.35, fill: { color: H.navy }, line: { color: H.navy } });
    T(s, "居住面積", M + 0.35, 2.1, 3, 0.4, { fontSize: 14, color: H.goldL, bold: true });
    T(s, [{ text: `約${A.rentNowArea}`, options: { fontSize: 36, bold: true, color: "C9D0DA" } }, { text: "㎡", options: { fontSize: 16, color: "C9D0DA" } }], M + 0.35, 2.6, 3, 0.7);
    s.addShape(pres.shapes.DOWN_ARROW, { x: M + 1.4, y: 3.42, w: 0.5, h: 0.5, fill: { color: H.gold }, line: { color: H.gold } });
    T(s, [{ text: `${A.floor}`, options: { fontSize: 54, bold: true, color: H.white } }, { text: "㎡", options: { fontSize: 20, color: H.white } }], M + 0.35, 4.0, 3, 0.95);
    T(s, `約${(A.floor / A.rentNowArea).toFixed(1)}倍の広さ`, M + 0.35, 5.05, 3, 0.4, { fontSize: 16, bold: true, color: H.gold });
    T(s, "現在の賃貸の広さは仮定値", M + 0.35, 5.6, 3, 0.35, { fontSize: 10, color: "C9D0DA" });
    const rows = [
      ["収納", "限られた収納に合わせて持ち物を減らす", "部屋単位で収納・趣味スペースを確保できる", "up"],
      ["騒音", "上下左右の住戸の音・自分の音に配慮", "独立した1棟で、音の悩みが減りやすい", "up"],
      ["通勤", "駅近を選びやすい", "立地しだいで延びる可能性あり（要確認）", "down"],
      ["生活動線", "ワンフロアで完結", "2階建てなら上下移動が増える", "down"],
      ["自由度", "改装・ペット・音は契約で制限", "法令と近隣配慮の範囲で自由に使える", "up"],
      ["維持管理", "設備故障は原則オーナー負担", "点検・修繕を自分で計画・負担する", "down"],
    ];
    const data = [[th(""), th("現在（賃貸）"), th("購入後（本件）", { fill: { color: H.gold } }), th("変化", { align: "center" })]];
    rows.forEach((r, i) => {
      const f = i % 2 ? H.white : H.mist;
      data.push([td(r[0], { bold: true, color: H.navy, fill: { color: f } }), td(r[1], { fill: { color: f } }), td(r[2], { fill: { color: f } }),
        td(r[3] === "up" ? "向上" : "注意", { align: "center", bold: true, color: r[3] === "up" ? H.gain : H.loss, fill: { color: f } })]);
    });
    s.addTable(data, { x: M + 3.9, y: 1.85, w: CW - 3.9, colW: [1.25, 3.0, 3.13, 0.85], rowH: 0.62, border: { type: "solid", pt: 0.5, color: H.line }, fontSize: 13 });
    note(s, "※ 本件は架空のサンプル（新築戸建て・建物85㎡・土地100㎡・駐車場1台）。「現在」は家賃10万円の賃貸（約40㎡）を仮定した一般的な比較です。");
  }

  // P11 住宅ローンと購入資金
  {
    pres.addSection({ title: S3 });
    const s = slideOf(S3, "P11｜住宅ローンと購入資金", `毎月の返済は約${manN(K.pmt, 1)}万円。条件を数字で確かめる`, {
      point: `頭金${man(A.down)}・借入${man(A.loan)}・年利${pct(A.rate)}・${A.years}年の元利均等返済で、毎月${yen(K.pmt)}。総返済額は約${man(K.total)}で、うち利息は約${man(K.interest)}。年収に対する返済の割合は${pct(K.dti)}。完済は${K.payoffAge}歳。金利は試算用の仮定で、実際の金利・審査は金融機関で異なる。`,
      ask: ["月々いくらまでなら、今の生活水準を落とさずに払えそうですか？", `完済が${K.payoffAge}歳になる点は、どう感じますか？ 繰上げ返済の考え方も気になりますか？`],
      qa: [["35年ローンは長すぎて不安です。", `不安はもっともです。期間を短くすれば利息は減りますが、毎月の負担は増えます。繰上げ返済で期間を縮める方法もあるので、手元資金とのバランスで決めます。`],
        ["変動金利と固定金利、どちらがいい？", "金利上昇のリスクを誰が負うかの違いです。変動は当初の金利が低い一方、上昇時に返済額が増える可能性があります（P16で＋1%の影響を試算）。家計の余裕度で選びます。"]],
    });
    // 左：資金の流れ
    card(s, M, 1.85, 5.3, 4.4, H.mist);
    T(s, "購入資金の内訳", M + 0.3, 2.0, 4.7, 0.4, { fontSize: 15, bold: true, color: H.navy });
    const fl = [
      ["物件価格", man(A.price), H.char],
      ["購入諸費用（仮定 7%）", man(K.buyCost, 1), H.char],
      ["必要資金 合計", man(A.price + K.buyCost, 1), H.navy],
    ];
    fl.forEach((r, i) => {
      T(s, r[0], M + 0.3, 2.5 + i * 0.45, 3, 0.4, { fontSize: 14, bold: i === 2, color: r[2], valign: "middle" });
      T(s, r[1], M + 3.0, 2.5 + i * 0.45, 2.0, 0.4, { fontSize: 14, bold: i === 2, color: r[2], align: "right", valign: "middle" });
    });
    s.addShape(pres.shapes.LINE, { x: M + 0.3, y: 3.82, w: 4.7, h: 0, line: { color: H.line, width: 1 } });
    const pay = [
      ["自己資金：頭金", man(A.down)],
      ["自己資金：諸費用", man(K.buyCost, 1)],
      ["住宅ローン借入", man(A.loan)],
    ];
    pay.forEach((r, i) => {
      T(s, r[0], M + 0.3, 3.95 + i * 0.45, 3, 0.4, { fontSize: 14, valign: "middle" });
      T(s, r[1], M + 3.0, 3.95 + i * 0.45, 2.0, 0.4, { fontSize: 14, align: "right", valign: "middle" });
    });
    T(s, `預貯金${man(A.savings)} − 自己資金${man(K.cashOut, 1)} ＝ 手元に残るのは約${man(K.cashLeft, 1)}（→ P16）`, M + 0.3, 5.4, 4.7, 0.7, { fontSize: 13, bold: true, color: H.loss });
    // 右：大きな数字
    const bx = M + 5.6, bw = CW - 5.6;
    T(s, "毎月の返済額", bx, 1.9, bw, 0.35, { fontSize: 14, color: H.gray, bold: true });
    T(s, [{ text: Math.round(K.pmt).toLocaleString("ja-JP"), options: { fontSize: 56, bold: true, color: H.navy } }, { text: " 円/月", options: { fontSize: 20, color: H.navy } }], bx, 2.25, bw, 0.95);
    const stats = [["総返済額", man(K.total)], ["うち利息", man(K.interest)], ["返済負担率", pct(K.dti)]];
    const sw = (bw - 0.6) / 3;
    stats.forEach((st, i) => {
      const x = bx + i * (sw + 0.3);
      card(s, x, 3.35, sw, 1.15, H.mist);
      T(s, st[0], x + 0.2, 3.45, sw - 0.4, 0.35, { fontSize: 12, color: H.gray, bold: true });
      T(s, st[1], x + 0.2, 3.8, sw - 0.4, 0.55, { fontSize: 22, bold: true, color: H.navy });
    });
    card(s, bx, 4.7, bw, 1.55, H.navy);
    T(s, "元利均等返済の計算式", bx + 0.3, 4.8, bw - 0.6, 0.35, { fontSize: 12, bold: true, color: H.goldL });
    T(s, "毎月返済額 ＝ 借入額 × r ×（1＋r）ⁿ ÷ {（1＋r）ⁿ − 1}", bx + 0.3, 5.18, bw - 0.6, 0.45, { fontSize: 15, bold: true, color: H.white });
    T(s, `r ＝ 年利${pct(A.rate)} ÷ 12 ＝ ${(A.rate / 12 * 100).toFixed(3)}%　　n ＝ ${A.years}年 × 12 ＝ ${A.years * 12}回`, bx + 0.3, 5.68, bw - 0.6, 0.4, { fontSize: 13, color: "E6E9EE" });
    note(s, "※ 金利は実在のローン商品の条件ではなく試算用の仮定です。実際の金利・審査基準・団体信用生命保険の扱い等は金融機関・商品により異なります。購入諸費用（仲介手数料・登記費用・ローン手数料・保険等）は物件価格の7%と仮定しています。");
  }

  // P12 本当の住居費
  {
    const s = slideOf(S3, "P12｜本当の住居費を比較する", "比べるのは「家賃 vs 返済額」ではなく、「住居費の総額」", {
      point: `ローン返済額（約${manN(K.pmt, 1)}万円）だけを見ると家賃10万円とほぼ同じだが、税金・保険・修繕積立を加えた戸建ての住居費は月約${manN(K.own.total, 1)}万円で、現在の賃貸（約${manN(K.rentNow.total, 1)}万円）より月約${manN(K.own.total - K.rentNow.total, 1)}万円多い。一方、同じ広さ・駐車場付きの賃貸（仮定）と比べると月約${manN(K.rentEq.total - K.own.total, 1)}万円少ない。「何と比べるか」で結論が変わることを正直に示す。`,
      ask: ["今の家賃以外に、住まいにかかっている費用（更新料・駐車場など）はいくらですか？", `月${manN(K.own.total - K.rentNow.total, 1)}万円の差額は、得られる広さ・自由度に見合うと感じますか？`],
      qa: [["家賃とほぼ同じ返済額なら、買ったほうが得では？", "返済額だけならそう見えますが、所有には税金・保険・修繕の費用がかかります。本当の住居費で比べると、今の賃貸より負担は増えます。その差額で何が得られるかが判断のポイントです。"],
        ["住宅ローン控除は入っていないの？", "入っていません。控除額は入居年・住宅の省エネ性能・所得などで変わるため、本試算では保守的に除外しています。適用されれば実質負担は軽くなります。"]],
    });
    const rowsD = [
      ["現在の賃貸（約40㎡・駐車場なし）", K.rentNow, [["家賃", K.rentNow.rent], ["保険", K.rentNow.ins], ["更新料（月換算）", K.rentNow.renew], ["駐車場", 0]]],
      ["戸建て購入（本件・駐車場1台）", K.own, [["ローン返済", K.own.loan], ["税・保険", K.own.tax + K.own.ins], ["修繕積立", K.own.repair], ["駐車場", 0]]],
      ["同等の広さ・駐車場付き賃貸（仮定）", K.rentEq, [["家賃", K.rentEq.rent], ["保険", K.rentEq.ins], ["更新料（月換算）", K.rentEq.renew], ["駐車場", K.rentEq.park]]],
    ];
    const cols = [H.navy, H.blue, H.gold, "9AA5B4"];
    const bx = M + 3.6, maxW = 6.3, scale = maxW / 150_000;
    rowsD.forEach((r, i) => {
      const y = 2.0 + i * 1.35;
      T(s, r[0], M, y, 3.45, 0.55, { fontSize: 14, bold: true, color: i === 1 ? H.navy : H.char, valign: "middle" });
      let x = bx;
      r[2].forEach((seg, j) => {
        const w = seg[1] * scale;
        if (w > 0.005) s.addShape(pres.shapes.RECTANGLE, { x, y, w, h: 0.55, fill: { color: cols[j] }, line: { color: H.white, width: 0.75 } });
        x += w;
      });
      T(s, `${manN(r[1].total, 1)}万円/月`, x + 0.15, y, 2.2, 0.55, { fontSize: 18, bold: true, color: i === 1 ? H.navy : H.char, valign: "middle" });
      T(s, r[2].filter((g) => g[1] > 0).map((g) => `${g[0]} ${Math.round(g[1]).toLocaleString("ja-JP")}`).join("　/　") + "（円）", bx, y + 0.6, 8.5, 0.35, { fontSize: 11, color: H.gray });
    });
    const lg = ["家賃・ローン返済", "税・保険", "更新料・修繕積立", "駐車場"];
    lg.forEach((l, j) => {
      const x = M + 3.6 + j * 2.0;
      s.addShape(pres.shapes.RECTANGLE, { x, y: 5.97, w: 0.22, h: 0.22, fill: { color: cols[j] }, line: { color: cols[j] } });
      T(s, l, x + 0.3, 5.92, 1.65, 0.32, { fontSize: 11, color: H.char, valign: "middle" });
    });
    note(s, `※ 仮定値：固定資産税等 年${manN(A.propTaxYear)}万円、火災・地震保険 年${manN(A.insOwnYear)}万円、修繕積立 月${manN(A.repairMonth, 1)}万円、賃貸の家財保険 年${manN(A.insRentYear)}万円、更新料 2年ごとに家賃1か月、同等賃貸の家賃 月${manN(A.rentEqual)}万円＋駐車場 月${manN(A.parkingMonth)}万円。住宅ローン控除・購入諸費用（初期費用）は含みません。`);
  }

  // P13 住宅ローン残債の推移
  {
    const s = slideOf(S3, "P13｜住宅ローン残債の推移", "返済が進むほど借入は減る。ただし「残債の減少＝利益」ではない", {
      point: `残債は5年後${man(K.bal(5))}、10年後${man(K.bal(10))}、20年後${man(K.bal(20))}、35年で完済。最初の10年で減る元金は約${man(K.prin10)}。売却時に手元に残るのは「売却価格 − 売却費用 − 残債」であり、元金を返した分がそのまま利益になるわけではない。`,
      ask: ["10年後、どんな暮らしをしていると思いますか？ 同じ家に住んでいそうですか？", "繰上げ返済に回せそうな余裕資金は、年にどれくらいありそうですか？"],
      qa: [["10年で750万円も返すなら、その分は貯金と同じでしょう？", "借入が減る点は貯金に似ていますが、引き出せるのは売却やリフォームローンなどを通じてだけで、その価値も売却価格しだいです。貯金のように自由に使えるお金ではありません。"]],
    });
    const yrs = Array.from({ length: 36 }, (_, i) => i);
    s.addChart(pres.charts.AREA, [{ name: "ローン残高", labels: yrs.map((y) => (y % 5 ? "" : y + "年")), values: yrs.map((y) => +(K.bal(y) / 10_000).toFixed(0)) }], {
      x: M, y: 1.8, w: 7.6, h: 4.45, chartColors: [H.navy], chartColorsOpacity: 85,
      showTitle: true, title: "住宅ローン残高の推移（万円）", titleFontSize: 13, titleColor: H.char, titleFontFace: "+mn-lt", showLegend: false,
      catAxisLabelColor: H.gray, catAxisLabelFontSize: 11, catAxisLabelFontFace: "+mn-lt", catAxisLabelRotate: 0,
      valAxisLabelColor: H.gray, valAxisLabelFontSize: 10, valAxisLabelFontFace: "+mn-lt", valAxisMaxVal: 3500, valAxisMinVal: 0,
      valGridLine: { color: "E5E7EB", size: 0.5 }, catGridLine: { style: "none" },
    });
    const pts = [5, 10, 20, 35];
    const cx = 8.5, cw = CW - (cx - M), ch = 0.98;
    pts.forEach((y, i) => {
      const yy = 1.85 + i * (ch + 0.17);
      card(s, cx, yy, cw, ch, y === 10 ? H.navy : H.mist);
      T(s, `${y}年後（${A.age + y}歳）`, cx + 0.3, yy, 1.9, ch, { fontSize: 14, bold: true, color: y === 10 ? H.goldL : H.gray, valign: "middle" });
      T(s, y === 35 ? "完済" : man(K.bal(y)), cx + 2.1, yy, cw - 2.35, ch, { fontSize: 24, bold: true, color: y === 10 ? H.white : H.navy, align: "right", valign: "middle" });
    });
    note(s, `※ 借入${man(A.loan)}・年利${pct(A.rate)}（仮定・全期間一定）・${A.years}年・元利均等返済、繰上げ返済なしの試算。売却時の手取り ＝ 売却価格 − 売却費用 − ローン残債（P15）。`);
  }

  // P14 将来の不動産価値
  {
    const s = slideOf(S3, "P14｜将来の不動産価値", "将来の価格は誰にも分からない。だから「幅」で考える", {
      point: "将来価格の予想はしない。土地と建物に分け、下落・横ばい・上昇の3つの仮定シナリオで10年後の価値の「幅」を示す。新築は購入価格に販売経費などが含まれるため、購入直後から市場価格が下がりやすい点も伝える。",
      ask: ["このエリアの10年後、人が増えていると思いますか、減っていると思いますか？", "建物の手入れ（外壁・設備など）にはどのくらい関心がありますか？"],
      qa: [["結局、上がるんですか、下がるんですか？", "分かりません。分からないことを前提に、下落シナリオでも生活が破綻しない計画かどうかを確認するのがこの資料の考え方です。"],
        ["このエリアは人気だから大丈夫では？", "人気は価格を支える要因の一つですが、保証にはなりません。周辺の成約事例や人口の動きなど、客観的なデータを一緒に確認しましょう。"]],
    });
    const cats = ["購入時", ...K.scen.map((x) => `10年後：${x.key}\n${manN(x.sale)}万円`)];
    cats[0] = `購入時\n${manN(A.price)}万円`;
    s.addChart(pres.charts.BAR, [
      { name: "土地", labels: cats, values: [A.landPrice, ...K.scen.map((x) => x.land)].map((v) => Math.round(v / 10_000)) },
      { name: "建物", labels: cats, values: [A.bldgPrice, ...K.scen.map((x) => x.bldg)].map((v) => Math.round(v / 10_000)) },
    ], {
      x: M, y: 1.8, w: 7.4, h: 4.45, barDir: "col", barGrouping: "stacked", chartColors: [H.gold, H.navy],
      showTitle: true, title: "土地・建物の価値（万円）— 3つの仮定シナリオ", titleFontSize: 13, titleColor: H.char, titleFontFace: "+mn-lt",
      showValue: true, dataLabelPosition: "ctr", dataLabelColor: H.white, dataLabelFontSize: 11, dataLabelFontFace: "+mn-lt", dataLabelFormatCode: "#,##0",
      showLegend: true, legendPos: "b", legendFontSize: 11, legendFontFace: "+mn-lt", legendColor: H.char,
      catAxisLabelColor: H.char, catAxisLabelFontSize: 11, catAxisLabelFontFace: "+mn-lt", valAxisLabelColor: H.gray, valAxisLabelFontSize: 10, valAxisLabelFontFace: "+mn-lt",
      valGridLine: { color: "E5E7EB", size: 0.5 }, catGridLine: { style: "none" }, valAxisMaxVal: 4000, barGapWidthPct: 55,
    });
    const cx = 8.3, cw = CW - (cx - M);
    T(s, "シナリオの前提（仮定）", cx, 1.85, cw, 0.4, { fontSize: 15, bold: true, color: H.navy });
    const data = [[th("シナリオ"), th("土地（年率）", { align: "center" }), th("建物（10年後）", { align: "center" })]];
    K.scen.forEach((x, i) => {
      const f = i % 2 ? H.white : H.mist;
      data.push([td(x.key, { bold: true, color: H.navy, fill: { color: f } }), td((x.landRate > 0 ? "＋" : x.landRate < 0 ? "−" : "±") + Math.abs(x.landRate * 100).toFixed(1) + "%", { align: "center", fill: { color: f } }), td(`購入時の${Math.round(x.bldgRate * 100)}%`, { align: "center", fill: { color: f } })]);
    });
    s.addTable(data, { x: cx, y: 2.3, w: cw, colW: [1.2, 1.5, cw - 2.7], rowH: 0.45, border: { type: "solid", pt: 0.5, color: H.line } });
    card(s, cx, 4.3, cw, 1.95, H.goldL);
    T(s, "知っておきたいこと", cx + 0.25, 4.4, cw - 0.5, 0.35, { fontSize: 13, bold: true, color: H.gold });
    T(s, "新築の価格には販売経費なども含まれるため、購入直後から市場価格が下がりやすい傾向があります。点検・修繕の記録は売却時の評価に役立ちます。", cx + 0.25, 4.8, cw - 0.5, 1.4, { fontSize: 13, lineSpacingMultiple: 1.15 });
    note(s, "※ 3つのシナリオは説明のための仮定であり、将来の価格を予想・保証するものではありません。実際の価格は立地・建物の状態・金利・市況などで変動します。");
  }

  // P15 10年後に売却すると
  {
    const s = slideOf(S3, "P15｜10年後に売却するとどうなるか", "「売れば得」とは限らない。手取りまで計算して確かめる", {
      point: `10年後の残債は約${man(K.b10)}。下落シナリオでは約${man(Math.abs(K.scen[0].net))}の持ち出し、横ばいでもほぼトントン〜わずかな持ち出し、上昇シナリオで約${man(K.scen[2].net)}の手取り。購入諸費用と新築からの値下がりがあるため、短期の売却は不利になりやすい。売る可能性がある人ほど、立地（市場性）と頭金の厚みが重要になる。`,
      ask: ["10年以内に住み替える可能性は、どのくらいありそうですか？", "売却で持ち出しが出た場合、預貯金で対応できそうですか？"],
      qa: [["持ち出しになるなら買わないほうがいい？", "短期で売る前提なら、賃貸のほうが合理的なことも多いです。長く住む予定か、売却時にも需要がある立地か——この2点が判断の分かれ目です。"],
        ["売らずに貸すことはできる？", "条件が整えば可能です。ただし住宅ローンは原則として本人居住が前提のため、貸す場合は金融機関への相談が必要です。賃料が返済・管理費用を上回るかも確認します。"]],
    });
    const cw = (CW - 0.6) / 3;
    K.scen.forEach((x, i) => {
      const cx = M + i * (cw + 0.3), y0 = 1.85;
      card(s, cx, y0, cw, 4.3, H.mist);
      T(s, `${x.key}シナリオ`, cx + 0.3, y0 + 0.2, cw - 0.6, 0.4, { fontSize: 17, bold: true, color: H.navy });
      const lines = [["想定売却価格", man(x.sale)], ["売却費用", "− " + man(x.cost)], ["ローン残債", "− " + man(x.bal)]];
      lines.forEach((l, j) => {
        T(s, l[0], cx + 0.3, y0 + 0.8 + j * 0.5, 1.9, 0.45, { fontSize: 14, valign: "middle", color: H.gray });
        T(s, l[1], cx + 1.9, y0 + 0.8 + j * 0.5, cw - 2.2, 0.45, { fontSize: 16, bold: true, align: "right", valign: "middle" });
      });
      s.addShape(pres.shapes.LINE, { x: cx + 0.3, y: y0 + 2.4, w: cw - 0.6, h: 0, line: { color: H.line, width: 1 } });
      T(s, x.net >= 0 ? "売却後の手取り" : "売却後の持ち出し", cx + 0.3, y0 + 2.55, cw - 0.6, 0.35, { fontSize: 13, bold: true, color: x.net >= 0 ? H.gain : H.loss });
      T(s, sgn(x.net), cx + 0.3, y0 + 2.9, cw - 0.6, 0.8, { fontSize: 34, bold: true, color: x.net >= 0 ? H.gain : H.loss });
      T(s, x.net >= 0 ? "残債を返して手元に残る見込み" : "残債を返すために預貯金などから補う必要", cx + 0.3, y0 + 3.7, cw - 0.6, 0.5, { fontSize: 12, color: H.gray });
    });
    note(s, `※ 売却費用＝仲介手数料の上限（売却価格×3%＋6万円）×消費税1.1＋その他費用${manN(A.sellOther)}万円（仮定）。譲渡所得税は考慮せず（居住用財産の3,000万円特別控除などの適用は要件を要確認）。10年間で返済した元金は約${man(K.prin10)}ですが、手取りは売却価格しだいで変わります。`);
  }

  // P16 リスク
  {
    pres.addSection({ title: S4 });
    const s = slideOf(S4, "P16｜単身者が考えておくべきリスク", "「返せるか」だけでなく、「困ったときに持ちこたえられるか」", {
      point: `単身者は世帯収入が1本のため、収入が止まったときの備えが特に重要。サンプル条件では購入後の手元資金が約${man(K.cashLeft, 1)}しか残らず、生活費6か月分（仮定 ${man(K.reserve)}）に届かない。頭金を${man(1_000_000)}に抑えれば手元に約${man(K.altLeft, 1)}残る（月々の返済は${yen(K.altPmt)}に増える）。リスクを先に示すことが信頼につながる。`,
      ask: ["病気やけがで3か月働けなくなったら、生活費はどう工面しますか？", "勤務先の就業不能・休業時の保障や、加入中の保険の内容を把握していますか？"],
      qa: [["頭金は多いほうがいいのでは？", `借入と利息は減りますが、手元資金が薄くなります。単身者の場合は、まず生活費の半年分程度を手元に残し、残りを頭金にする考え方をおすすめしています。`],
        ["団信に入れば安心ですよね？", "団体信用生命保険は、死亡・高度障害などで残債が弁済される保険です。病気で働けない期間の収入減は、商品によって保障の範囲が異なるため、内容を確認しましょう。"]],
    });
    const risks = [
      ["LuWallet", "収入減少", "減給・転職・失業（収入は1本）", "生活費6か月分を確保"],
      ["LuHeartPulse", "病気・けが", "働けない期間の収入減", "就業不能時の保障を確認"],
      ["LuPlane", "転勤・転職", "住み続けられなくなる", "売却・賃貸の可能性を確認"],
      ["LuWrench", "修繕費", "外壁・屋根・給湯器などの交換", "毎月の修繕積立（P12）"],
      ["LuPercent", "金利上昇", `＋1%で月約${manN(K.pmtUp - K.pmt, 1)}万円増（試算）`, "金利タイプと余裕資金"],
      ["LuCloudLightning", "災害", "地震・水害・土砂災害", "ハザードマップと保険"],
    ];
    const gw = (7.9 - 0.3) / 2, gh = 1.3;
    for (let i = 0; i < 6; i++) {
      const x = M + (i % 2) * (gw + 0.3), y = 1.85 + Math.floor(i / 2) * (gh + 0.2);
      card(s, x, y, gw, gh, H.mist);
      await iconDisc(s, risks[i][0], x + 0.22, y + 0.25, 0.62, H.navy);
      T(s, risks[i][1], x + 1.05, y + 0.12, gw - 1.2, 0.36, { fontSize: 15, bold: true, color: H.navy });
      T(s, risks[i][2], x + 1.05, y + 0.48, gw - 1.2, 0.38, { fontSize: 12 });
      T(s, "備え：" + risks[i][3], x + 1.05, y + 0.86, gw - 1.2, 0.35, { fontSize: 12, bold: true, color: H.gold });
    }
    const cx = M + 8.2, cw = CW - 8.2;
    card(s, cx, 1.85, cw, 4.3, H.navy);
    T(s, "購入後の手元資金", cx + 0.3, 2.0, cw - 0.6, 0.35, { fontSize: 14, bold: true, color: H.goldL });
    T(s, `約${man(K.cashLeft, 1)}`, cx + 0.3, 2.4, cw - 0.6, 0.75, { fontSize: 36, bold: true, color: H.white });
    T(s, `預貯金${man(A.savings)} − 頭金${man(A.down)} − 諸費用${man(K.buyCost, 1)}`, cx + 0.3, 3.15, cw - 0.6, 0.35, { fontSize: 11, color: "C9D0DA" });
    T(s, `生活費6か月分（仮定 ${man(K.reserve)}）に不足`, cx + 0.3, 3.55, cw - 0.6, 0.4, { fontSize: 14, bold: true, color: "F2B8A8" });
    s.addShape(pres.shapes.LINE, { x: cx + 0.3, y: 4.1, w: cw - 0.6, h: 0, line: { color: "3A4A66", width: 1 } });
    T(s, "見直し案：頭金を100万円にすると", cx + 0.3, 4.2, cw - 0.6, 0.35, { fontSize: 12, bold: true, color: H.goldL });
    T(s, [{ text: `手元資金 約${man(K.altLeft, 1)}`, options: { breakLine: true } }, { text: `返済 ${yen(K.altPmt)}/月（借入${man(K.altLoan)}）` }], cx + 0.3, 4.6, cw - 0.6, 0.9, { fontSize: 14, bold: true, color: H.white, lineSpacingMultiple: 1.2 });
    T(s, "頭金と予備資金のバランスを一緒に決めましょう。", cx + 0.3, 5.5, cw - 0.6, 0.55, { fontSize: 12, color: "C9D0DA" });
    note(s, `※ 生活費 月${manN(A.living)}万円・予備資金6か月分は本資料での目安（仮定）。金利上昇は年利${pct(A.rate)}→${pct(A.rate + 0.01)}が全期間続いた場合の単純試算（返済${yen(K.pmtUp)}/月）。実際の変動金利の見直しルールは商品により異なります。`);
  }

  // P17 最終比較
  {
    const s = slideOf(S4, "P17｜賃貸・マンション・戸建ての最終比較", "正解はひとつではない。「何を優先するか」で選ぶ", {
      point: "ここまでの内容を7つの物差しで一覧化。戸建てが全項目で優れているわけではなく、流動性・維持管理の手軽さでは賃貸が強い。お客様自身に優先順位をつけてもらい、どの選択肢が合うかを一緒に確認する。",
      ask: ["この7項目のうち、あなたにとって大事なものを上から3つ選ぶとしたら？", "選んだ3つで見ると、どの住まい方がいちばん合っていそうですか？"],
      qa: [["結局、戸建てを勧めたいんでしょう？", "優先順位によっては賃貸やマンションが合う方もいます。たとえば「数年以内に転勤の可能性がある」「管理は任せたい」なら、無理に戸建てを選ぶ必要はありません。"]],
    });
    const rows = [
      ["生活価値（広さ・独立性）", "△", "○", "◎"],
      ["資金負担（初期・毎月）", "◎", "△", "△"],
      ["自由度（改修・使い方）", "△", "○", "◎"],
      ["維持管理の手軽さ", "◎", "○", "△"],
      ["資産性（立地・条件しだい）", "―", "○", "○"],
      ["流動性（住み替えやすさ）", "◎", "○", "△"],
      ["将来の選択肢（住む・売る・貸す）", "△", "○", "○"],
    ];
    const sym = (v) => td(v, { align: "center", fontSize: 18, bold: true, color: v === "◎" ? H.gold : v === "△" || v === "―" ? H.gray : H.navy });
    const data = [[th("比較の物差し"), th("賃貸", { align: "center" }), th("分譲マンション", { align: "center" }), th("土地付き戸建て", { align: "center", fill: { color: H.gold } })]];
    rows.forEach((r, i) => {
      const f = i % 2 ? H.white : H.mist;
      const c = [td(r[0], { bold: true, color: H.navy, fill: { color: f } }), ...r.slice(1).map(sym)];
      c.slice(1).forEach((x) => (x.options.fill = { color: f }));
      data.push(c);
    });
    s.addTable(data, { x: M, y: 1.8, w: 7.6, colW: [3.1, 1.5, 1.5, 1.5], rowH: 0.52, border: { type: "solid", pt: 0.5, color: H.line } });
    T(s, "◎ 強み　○ 条件しだいで良好　△ 注意が必要　― 該当しない", M, 6.05, 7.6, 0.3, { fontSize: 10, color: H.gray });
    const fit = [
      ["LuKeyRound", "賃貸が合う人", "転勤・転職の予定がある／住む場所が未定／身軽さと手元資金を優先"],
      ["LuBuilding2", "マンションが合う人", "駅近・都市部の利便性を重視／管理は任せたい／ワンフロアで暮らしたい"],
      ["LuHouse", "戸建てが合う人", "広さ・独立性・駐車場や趣味の空間を重視／同じ地域に長く住む想定がある"],
    ];
    const cx = M + 7.9, cw = CW - 7.9;
    for (let i = 0; i < 3; i++) {
      const y = 1.8 + i * 1.45;
      card(s, cx, y, cw, 1.3, i === 2 ? H.navy : H.mist);
      await iconDisc(s, fit[i][0], cx + 0.2, y + 0.2, 0.55, i === 2 ? H.gold : H.navy);
      T(s, fit[i][1], cx + 0.95, y + 0.15, cw - 1.1, 0.4, { fontSize: 15, bold: true, color: i === 2 ? H.white : H.navy, valign: "middle" });
      T(s, fit[i][2], cx + 0.95, y + 0.55, cw - 1.15, 0.7, { fontSize: 12, color: i === 2 ? "E6E9EE" : H.char });
    }
    note(s, "※ 評価は一般的な傾向にもとづく目安です。個別の物件・立地・契約条件・家計の状況によって変わります。");
  }

  // P18 まとめ
  {
    const s = pres.addSlide({ masterName: "DARK", sectionTitle: S4 });
    T(s, "P18｜まとめ", M, 0.45, 6, 0.34, { fontSize: 12, bold: true, color: H.gold });
    T(s, "家を買うことが目的ではない。\nこれからの暮らしを、自分で選ぶこと。", M, 0.85, CW, 1.4, { fontFace: FONT_H, fontSize: 30, bold: true, color: H.white, lineSpacingMultiple: 1.15 });
    const cw = (CW - 0.6) / 3, y0 = 2.6, ch = 3.6;
    // 1 得られる可能性
    card(s, M, y0, cw, ch, "24365A");
    T(s, "戸建て所有で得られる可能性", M + 0.3, y0 + 0.2, cw - 0.6, 0.4, { fontSize: 15, bold: true, color: H.goldL });
    T(s, ["住む・使う「居住価値」", "土地という個別性のある実物資産", "趣味・仕事・車・ペットの空間", "住宅ローンによる長期の取得", "住む・売る・貸すという選択肢"].map((t, i, a) => ({ text: t, options: { bullet: true, breakLine: i < a.length - 1 } })),
      M + 0.3, y0 + 0.75, cw - 0.6, ch - 0.95, { fontSize: 14, color: H.white, paraSpaceAfter: 8 });
    // 2 確認すべき条件
    const x2 = M + cw + 0.3;
    card(s, x2, y0, cw, ch, "24365A");
    T(s, "購入前に確認すべき条件", x2 + 0.3, y0 + 0.2, cw - 0.6, 0.4, { fontSize: 15, bold: true, color: H.goldL });
    const chk = ["生活費6か月分の予備資金", "本当の住居費を払い続けられるか", "金利上昇時の返済余力", "下落シナリオでの手取り", "立地・接道・用途地域・災害リスク", "住み続ける予定の期間"];
    for (let i = 0; i < chk.length; i++) {
      const yy = y0 + 0.75 + i * 0.45;
      s.addImage({ data: await icon("LuCheck", H.gold), x: x2 + 0.3, y: yy + 0.06, w: 0.26, h: 0.26 });
      T(s, chk[i], x2 + 0.65, yy, cw - 0.8, 0.4, { fontSize: 13, color: H.white, valign: "middle" });
    }
    // 3 3つの選択肢
    const x3 = M + 2 * (cw + 0.3);
    card(s, x3, y0, cw, ch, H.white);
    T(s, "次の一歩は、3つから選べます", x3 + 0.3, y0 + 0.2, cw - 0.6, 0.4, { fontSize: 15, bold: true, color: H.navy });
    const ch3 = [["A", "購入に進む", "資金計画の確定・物件の詳細確認・事前審査へ"], ["B", "比較を続ける", "条件を変えて再試算・他の物件や賃貸と比べる"], ["C", "今回は見送る", "賃貸を続けながら予備資金・積立を優先する"]];
    ch3.forEach((c, i) => {
      const yy = y0 + 0.75 + i * 0.92;
      badge(s, x3 + 0.3, yy + 0.05, 0.5, c[0], i === 0 ? H.gold : H.navy);
      T(s, c[1], x3 + 0.95, yy, cw - 1.2, 0.35, { fontSize: 15, bold: true, color: H.navy });
      T(s, c[2], x3 + 0.95, yy + 0.36, cw - 1.2, 0.5, { fontSize: 12, color: H.char });
    });
    T(s, "どの選択も、あなたにとって正しい判断になり得ます。", M, 6.4, 8, 0.4, { fontSize: 13, color: H.goldL });
    T(s, COMPANY, 8.5, 6.4, W - M - 8.5, 0.4, { fontSize: 13, bold: true, color: H.white, align: "right" });
    T(s, "本資料の数値は架空のサンプル条件と仮定値による試算で、将来の価格・金利・税制を保証するものではありません。税制・ローン条件は最新情報を確認し、必要に応じて税理士・金融機関等の専門家にご相談ください。", M, 6.85, CW, 0.45, { fontSize: 9, color: "9AA5B4" });
    addNotes(s, "P18｜まとめ", "家を買うことが目的ではない。これからの暮らしを、自分で選ぶこと。", {
      point: "結論をお客様に委ねる。得られる可能性と確認すべき条件を並べたうえで、「購入に進む」「比較を続ける」「見送る」の3つを同じ重さで提示する。見送りも正しい判断として尊重することで、長期的な信頼関係をつくる。",
      ask: ["今日の内容で、いちばん印象に残ったのはどのページですか？", "A・B・Cのうち、今の気持ちに一番近いのはどれですか？", "次に確認したいこと（再試算の条件・物件の詳細など）は何ですか？"],
      qa: [["もう少し考えたいです。", "もちろんです。資料はお持ち帰りいただき、条件を変えた再試算（頭金・金利・期間・物件価格）もいつでもお作りします。決めないことも大切な判断です。"],
        ["今買わないと損ですか？", "「今買わないと損」と断言できる根拠はありません。予備資金・住居費・住む期間の3点がそろったときが、あなたにとっての買い時です。"]],
    });
  }

  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, "単身者向け戸建て提案資料.pptx");
  await pres.writeFile({ fileName: file });
  fs.writeFileSync(path.join(OUT, "営業トーク台本.md"), script());
  console.log("wrote", file);
  printCheck();
}

// ───────────────────────── 4. 台本(md) と 検算ログ ─────────────────────────
function script() {
  const L = [];
  L.push("# 単身者向け 戸建て所有 提案資料 — 営業トーク台本", "", `> 自動生成（build.js）。数値はスライドと同じ計算結果です。発行：${COMPANY}`, "");
  L.push("## 試算の前提と計算結果", "", "| 項目 | 値 | 区分 |", "|---|---|---|");
  const r = (a, b, c) => L.push(`| ${a} | ${b} | ${c} |`);
  r("顧客", `${A.age}歳・単身・年収${man(A.income)}・家賃${man(A.rent)}・預貯金${man(A.savings)}`, "サンプル条件");
  r("物件", `新築戸建て ${man(A.price)}（土地${A.land}㎡・建物${A.floor}㎡・駐車場${A.parking}台）`, "サンプル条件");
  r("ローン", `頭金${man(A.down)}・借入${man(A.loan)}・年利${pct(A.rate)}・${A.years}年・元利均等`, "サンプル条件（金利は試算用の仮定）");
  r("毎月返済額", yen(K.pmt), "計算");
  r("総返済額／利息", `${man(K.total, 1)}／${man(K.interest, 1)}`, "計算");
  r("返済負担率（年収比）", pct(K.dti), "計算");
  r("購入諸費用", `${man(K.buyCost, 1)}（物件価格の${A.buyCostRate * 100}%）`, "仮定値");
  r("購入後の手元資金", man(K.cashLeft, 1), "計算");
  r("残債 5/10/20/35年", [5, 10, 20, 35].map((y) => man(K.bal(y), 1)).join("／"), "計算");
  r("戸建ての住居費（月）", `${yen(K.own.total)}（返済＋税${yen(K.own.tax)}＋保険${yen(K.own.ins)}＋修繕${yen(K.own.repair)}）`, "計算（税・保険・修繕は仮定値）");
  r("現在の賃貸の住居費（月）", yen(K.rentNow.total), "計算（更新料・保険は仮定値）");
  r("同等賃貸の住居費（月）", yen(K.rentEq.total), "仮定値");
  K.scen.forEach((x) => r(`10年後売却：${x.key}`, `売却${man(x.sale, 1)} − 費用${man(x.cost, 1)} − 残債${man(x.bal, 1)} ＝ ${sgn(x.net)}`, "仮定シナリオ"));
  r("金利＋1%時の返済", yen(K.pmtUp), "計算");
  r("頭金100万円案", `借入${man(K.altLoan)}・返済${yen(K.altPmt)}・手元${man(K.altLeft, 1)}`, "計算");
  L.push("");
  NOTES.forEach((n) => {
    L.push(`## ${n.kicker}`, "", `**メインメッセージ：** ${n.title}`, "", "**① このページで伝えるべきこと**", "", n.point, "", "**② 顧客に投げかける質問**", "");
    n.ask.forEach((q) => L.push(`- ${q}`));
    L.push("", "**③ よくある反論と適切な回答**", "");
    n.qa.forEach((q) => L.push(`- **「${q[0]}」**  `, `  ${q[1]}`));
    L.push("");
  });
  return L.join("\n");
}
function printCheck() {
  // 検算：残債0・元金合計＝借入額・手取り＝売却−費用−残債
  const sumPrin = Array.from({ length: A.years }, (_, i) => K.yearSplit(i + 1).prin).reduce((a, b) => a + b, 0);
  console.log({ pmt: Math.round(K.pmt), total: Math.round(K.total), interest: Math.round(K.interest), dti: pct(K.dti),
    bal35: Math.round(K.bal(35)), sumPrin: Math.round(sumPrin), b10: Math.round(K.b10), cashLeft: K.cashLeft,
    own: Math.round(K.own.total), rentNow: Math.round(K.rentNow.total), rentEq: Math.round(K.rentEq.total),
    scen: K.scen.map((x) => [x.key, Math.round(x.sale), Math.round(x.cost), Math.round(x.net)]), pmtUp: Math.round(K.pmtUp), altPmt: Math.round(K.altPmt) });
}

build().catch((e) => { console.error(e); process.exit(1); });
