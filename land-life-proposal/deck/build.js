// 人生を、自分の土地から。— 単身者向け 戸建て所有の提案資料（16:9・24ページ）ジェネレーター
// 版（editions/）ごとに会社情報・サンプル・言い回しを差し替えて同じ構成の資料を作る。
//   node deck/build.js            → 全版
//   node deck/build.js martialarts → マーシャルアーツ版だけ
// 出力：dist/<版>/人生を、自分の土地から。_<版名>.pptx と 営業トーク集_<版名>.md
// 数値はすべて lib/engine.js の compute(edition.sample) から。スライドに数字を直書きしない。
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const React = require("react");
const RDS = require("react-dom/server");
const sharp = require("sharp");
const Lu = require("react-icons/lu");
const LL = require("../lib/engine");
const R = require("../lib/rules");
const EDITIONS = require("../editions");

const ROOT = path.join(__dirname, "..");
const IMG = path.join(ROOT, "..", "construction-portfolio", "img");
const OUT = path.join(ROOT, "dist");

const { fmt } = LL;
const { yen, man, manN, pct } = fmt;
const sgn = (v) => (v >= 0 ? "＋" : "−") + manN(Math.abs(v)) + "万円";
const desc = (o) => `${R.KIND[o.p.kind]}・${R.PERF[o.credit.judge.ok ? o.credit.judge.perf : o.p.perf]}`;

// ───────────────────────── デザイン ─────────────────────────
const H = {
  navy: "17233B", char: "2B2F36", white: "FFFFFF", ivory: "F7F4EE", mist: "EEF0F3", line: "DDE0E5",
  gold: "B89B6A", goldD: "8A6F3E", goldL: "EADFCB", gray: "6B7078", soft: "8C99AD",
  loss: "9E4B3B", gain: "3D7258", navyL: "26375A", onNavy: "C9D0DA",
};
const FH = "Yu Mincho", FB = "Yu Gothic";
const W = 13.333, M = 0.7, CW = W - 2 * M;

// ───────────────────────── 1回のビルドの状態（buildDeck が毎回作り直す） ─────────────────────────
let pres, ED, BRAND, S, X, CU, NA, UB, PAGES, PHOTOS, cur, page;

function initPres() {
  pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  pres.title = "人生を、自分の土地から。";
  pres.subject = "単身者向け 戸建て所有のご提案";
  pres.author = BRAND.name;
  pres.company = BRAND.name.replace(/&/g, "&amp;");
  pres.theme = { headFontFace: FH, bodyFontFace: FB };
  const footer = [
    { text: { text: BRAND.name, options: { x: M, y: 7.05, w: 5, h: 0.28, fontSize: 9, color: H.gray, fontFace: FB, margin: 0 } } },
    { text: { text: "人生を、自分の土地から。", options: { x: 5.2, y: 7.05, w: 6.6, h: 0.28, fontSize: 9, color: H.gray, fontFace: FB, margin: 0, align: "right" } } },
  ];
  const ph = (fill) => [
    { placeholder: { options: { name: "kicker", type: "body", x: M, y: 0.42, w: CW, h: 0.3, fontSize: 11, bold: true, color: H.goldD, fontFace: FB, margin: 0, valign: "middle", align: "left", charSpacing: 1 }, text: "" } },
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.74, w: CW, h: 0.85, fontSize: 30, bold: true, color: H.navy, fontFace: FH, margin: 0, valign: "middle", align: "left" }, text: "" } },
  ];
  const num = { x: 12.15, y: 7.05, w: 0.5, h: 0.28, fontSize: 9, color: H.gray, fontFace: FB, align: "right" };
  pres.defineSlideMaster({ title: "LIGHT", background: { color: H.white }, objects: [...footer, ...ph(H.white)], slideNumber: num });
  pres.defineSlideMaster({ title: "IVORY", background: { color: H.ivory }, objects: [...footer, ...ph(H.ivory)], slideNumber: { ...num } });
  pres.defineSlideMaster({ title: "BLANK", background: { color: H.white } });
  pres.defineSlideMaster({ title: "NAVY", background: { color: H.navy } });
}

// ───────────────────────── 部品 ─────────────────────────
const iconCache = {};
async function icon(name, color) {
  const k = name + color;
  if (!iconCache[k]) {
    const svg = RDS.renderToStaticMarkup(React.createElement(Lu[name], { size: 256, color: "#" + color, strokeWidth: 1.6 })).replace(/currentColor/g, "#" + color);
    iconCache[k] = "image/png;base64," + (await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64");
  }
  return iconCache[k];
}
const textOf = (t) => (Array.isArray(t) ? t.map((r) => r.text).join("") : String(t));
function T(s, text, x, y, w, h, o = {}) {
  if (cur) cur.text += textOf(text) + "\n";
  s.addText(text, { x, y, w, h, isTextBox: true, margin: 0, fontFace: FB, fontSize: 14, color: H.char, valign: "top", ...o });
}
function box(s, x, y, w, h, fill, o = {}) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.06, fill: { color: fill }, line: { color: o.line || fill, width: o.lw || 0.75 }, ...o.extra });
}
function rect(s, x, y, w, h, fill, transparency = 0) {
  s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: fill, transparency }, line: { color: fill, transparency: transparency ? 100 : 0, width: 0 } });
}
// 写真には必ず注記を付ける（施工事例かイメージかは版ごとに ED.photoCaption で決める）
function photo(s, file, x, y, w, h, cap) {
  cap = cap || ED.photoCaption;
  PHOTOS.push({ file, caption: cap, page });
  s.addImage({ path: path.join(IMG, file), x, y, w, h, sizing: { type: "cover", w, h }, altText: cap });
  T(s, cap, x + w - 1.6, y + h - 0.3, 1.5, 0.24, { fontSize: 9, color: "FFFFFF", align: "right", valign: "middle", shadow: { type: "outer", color: "000000", blur: 3, offset: 1, angle: 90, opacity: 0.5 } });
}
function tag(s, text, x, y, w, h, fill = H.navy, color = H.white, fs = 12) {
  box(s, x, y, w, h, fill);
  T(s, text, x, y, w, h, { fontSize: fs, bold: true, color, align: "center", valign: "middle" });
}
async function disc(s, name, x, y, d, fill = H.navy, color = "FFFFFF") {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill } });
  const p = d * 0.25;
  s.addImage({ data: await icon(name, color), x: x + p, y: y + p, w: d - 2 * p, h: d - 2 * p });
}
async function ico(s, name, x, y, d, color) { s.addImage({ data: await icon(name, color), x, y, w: d, h: d }); }
function note(s, text, dark = false) { T(s, text, M, 6.42, CW, 0.5, { fontSize: 10, color: dark ? H.onNavy : H.gray, valign: "bottom" }); }
function hline(s, x, y, w, color = H.line, width = 0.75) { s.addShape(pres.shapes.LINE, { x, y, w, h: 0, line: { color, width } }); }
const CHART = {
  titleFontSize: 12, titleColor: H.char, titleFontFace: "+mn-lt", showLegend: true, legendPos: "b", legendFontSize: 11, legendFontFace: "+mn-lt", legendColor: H.char,
  catAxisLabelColor: H.gray, catAxisLabelFontSize: 10, catAxisLabelFontFace: "+mn-lt", valAxisLabelColor: H.gray, valAxisLabelFontSize: 10, valAxisLabelFontFace: "+mn-lt",
  valGridLine: { color: "E6E8EC", size: 0.5 }, catGridLine: { style: "none" }, catAxisLineColor: "C9CED6", valAxisLineShow: false,
};

const ACTS = ["", "ACT 1 ─ 憧れ", "ACT 2 ─ 発見", "ACT 3 ─ 納得", "ACT 4 ─ 安心", "ACT 5 ─ 行動"];
const SEC = ["", "第1幕 憧れ", "第2幕 発見", "第3幕 納得", "第4幕 安心", "第5幕 行動"];
function slide(act, master, title, n) {
  page++;
  const ex = (ED.extraNotes || {})[page] || {};
  n = { ...n, ask: [...n.ask, ...(ex.ask || [])], worry: [...n.worry, ...(ex.worry || [])], answer: [...n.answer, ...(ex.answer || [])] };
  if (n.section) pres.addSection({ title: SEC[act] });
  const s = pres.addSlide({ masterName: master, sectionTitle: SEC[act] });
  cur = { page, act, title, notes: { msg: n.msg, ask: n.ask, worry: n.worry, answer: n.answer, next: n.next }, text: title + "\n" };
  PAGES.push(cur);
  if (master !== "BLANK" && master !== "NAVY") {
    s.addText(`${ACTS[act]}　｜　P${String(page).padStart(2, "0")}`, { placeholder: "kicker", align: "left" });
    s.addText(title, { placeholder: "title", align: "left" });
  }
  const t = [
    ["伝えるメッセージ", n.msg], ["顧客への質問", n.ask.map((q) => "・" + q).join("\n")], ["想定される不安", n.worry.map((q) => "・" + q).join("\n")],
    ["根拠に基づく回答", n.answer.map((q) => "・" + q).join("\n")], ["次のページへのつなぎ", n.next],
  ];
  s.addNotes(t.map(([k, v]) => `【${k}】\n${v}`).join("\n\n"));
  return s;
}

// ───────────────────────── スライド ─────────────────────────
async function slides() {
  // ════════ 第1幕 憧れ ════════
  // P01
  {
    const s = slide(1, "BLANK", "人生を、自分の土地から。", {
      section: true,
      msg: "最初の1枚は説明しない。写真とコピーだけを見てもらい、「自分の家」という感覚を持ってもらう。今日は売り込みではなく、暮らし方を一緒に考える時間だと伝える。",
      ask: ["この写真を見て、最初にどんなことを感じましたか？", "今日、どんなことが分かれば「来てよかった」と思えますか？"],
      worry: ["売り込まれるのではないか", "単身で家を買うのは早いのではないか"],
      answer: ["今日のゴールは購入を決めることではなく、賃貸・マンション・戸建てを同じ物差しで比べられるようになること", "資料はお持ち帰りいただける。見送りも大切な選択肢として扱う"],
      next: "「では、ひとりで暮らすからこそできる暮らし方から見ていきましょう。」",
    });
    photo(s, "p23.jpg", 0, 0, W, 7.5, ED.photoCaption);
    rect(s, 0, 0, 7.4, 7.5, H.navy, 18);
    T(s, BRAND.nameEn, M, 0.55, 5, 0.3, { fontSize: 12, bold: true, color: H.gold, charSpacing: 4 });
    T(s, "人生を、\n自分の土地から。", M, 1.7, 6.6, 2.6, { fontFace: FH, fontSize: 56, bold: true, color: H.white, lineSpacingMultiple: 1.1 });
    T(s, "ひとりで暮らす。その自由を、もっと大きく。", M, 4.45, 6.6, 0.5, { fontSize: 18, color: H.goldL });
    T(s, "単身者のための 戸建て所有のご提案", M, 6.35, 6, 0.3, { fontSize: 11, color: H.onNavy });
    T(s, BRAND.name, M, 6.68, 6, 0.35, { fontSize: 14, bold: true, color: H.white });
  }

  // P02
  {
    const s = slide(1, "BLANK", "一人だからこそ、暮らしを自由に。", {
      msg: "「家族のための家」という前提を外す。誰にも合わせなくていい単身者だからこそ、家の使い方を自分で決められる。3つの場面で、具体的な暮らしを想像してもらう。",
      ask: ["休日、いちばん長く過ごしている場所はどこですか？", "今の住まいで「本当はこうしたい」と思っていることは？"],
      worry: ["一人で一戸建ては広すぎるのでは", "掃除や手入れが大変そう"],
      answer: ["広さは「何に使うか」が決まって初めて価値になる。用途が決まらなければコンパクトな物件や賃貸が合理的なこともある", "手入れの手間はデメリットとして正直に扱う（P20で維持費を確認）"],
      next: "「その自由が、家の中でどう形になるのか。写真で見てみましょう。」",
    });
    photo(s, "p03.jpg", 6.9, 0, W - 6.9, 7.5);
    T(s, `${ACTS[1]}　｜　P02`, M, 0.55, 5.6, 0.3, { fontSize: 11, bold: true, color: H.goldD });
    T(s, "一人だからこそ、\n暮らしを自由に。", M, 0.95, 5.8, 1.7, { fontFace: FH, fontSize: 36, bold: true, color: H.navy, lineSpacingMultiple: 1.1 });
    T(s, ED.lead.p02, M, 2.75, 5.8, 0.75, { fontSize: 15, color: H.char });
    for (let i = 0; i < 3; i++) {
      const r = ED.scenes[i], y = 3.75 + i * 0.95;
      await disc(s, r[0], M, y, 0.7, i === 1 ? H.gold : H.navy);
      T(s, r[1], M + 0.95, y + 0.02, 1.2, 0.32, { fontSize: 16, bold: true, color: H.navy });
      T(s, r[2], M + 0.95, y + 0.36, 5.0, 0.36, { fontSize: 14 });
    }
    T(s, BRAND.name, M, 7.05, 5, 0.28, { fontSize: 9, color: H.gray });
  }

  // P03
  {
    const s = slide(1, "LIGHT", "もし、家のすべてが自分の空間だったら。", {
      msg: "リビング・個室・収納・外まわり・ガレージ。賃貸のワンルームや1LDKでは分けられない空間が、すべて自分のものになる。写真を指しながら「この部屋を何に使うか」を一緒に決める。",
      ask: ["この中で、いちばん欲しい空間はどれですか？", "空いている一部屋があったら、何に使いますか？"],
      worry: ["写真のような家は高いのでは", "使わない部屋が無駄になりそう"],
      answer: ["写真は施工事例・イメージ。実際の物件は予算と希望条件から選ぶ（P10・P23）", "使い道が決まらない部屋は、収納・来客・将来の用途など候補を先に挙げてから判断する"],
      next: "「では、10年後のご自分を少し想像してみましょう。」",
    });
    const L = [M, 1.75, 6.2, 4.6];
    photo(s, "p26.jpg", ...L);
    tag(s, "リビング", L[0] + 0.2, L[1] + 0.2, 1.3, 0.4, H.white, H.navy);
    const g = [["p03.jpg", "趣味・仕事の個室"], ["p05.jpg", "収納"], ["p16.jpg", "外まわり・庭"], ["p01.jpg", "ガレージ・駐車場"]];
    const gx = M + 6.45, gw = (CW - 6.45 - 0.25) / 2, gh = (4.6 - 0.25) / 2;
    g.forEach((t, i) => {
      const x = gx + (i % 2) * (gw + 0.25), y = 1.75 + Math.floor(i / 2) * (gh + 0.25);
      photo(s, t[0], x, y, gw, gh);
      tag(s, t[1], x + 0.15, y + 0.15, Math.min(gw - 0.3, 0.32 + t[1].length * 0.19), 0.38, H.white, H.navy, 11);
    });
    note(s, `※ ${ED.photoNote}実現できる空間は物件によって異なります。`);
  }

  // P04
  {
    const s = slide(1, "IVORY", "10年後、どんな場所で暮らしていたいですか。", {
      msg: "ここで初めてお客様に書いてもらう。「家を買うか」ではなく「どう暮らしたいか」が出発点。書いた言葉は、後半の物件条件（P10・P23）と提案書にそのまま使う。",
      ask: ["10年後、どの街に住んでいたいですか？", "家で、どんな時間を過ごしていたいですか？", "家に「これだけは欲しい」空間は？", "暮らしの中で、大切にしたいものは何ですか？"],
      worry: ["10年後のことは分からない", "結婚するかもしれない"],
      answer: ["分からなくて大丈夫。今の希望を書くだけでよく、変わったときの選択肢（売る・住み替える・貸す）はP17で確認する", "本資料は結婚を前提にしない。家族構成が変わった場合も、その時点の状況で判断できる"],
      next: "「書いていただいた暮らしを、どう実現するか。まず『住まいとお金』の関係から整理します。」",
    });
    T(s, "答えに正解はありません。\n思いつくまま、ここに書き込んでください。", M, 1.75, 4.2, 0.9, { fontSize: 15, color: H.char, lineSpacingMultiple: 1.2 });
    await ico(s, "LuPencilLine", M, 2.9, 0.6, H.goldD);
    T(s, "書いた言葉は、後のページで\n物件の条件に置き換えていきます。", M, 3.7, 4.2, 0.8, { fontSize: 13, color: H.gray, lineSpacingMultiple: 1.2 });
    const q = ["住んでいたい街・場所", "家で過ごしたい時間", "家に欲しい空間", "大切にしたいもの"];
    const bx = M + 4.6, bw = (CW - 4.6 - 0.3) / 2, bh = 2.25;
    q.forEach((t, i) => {
      const x = bx + (i % 2) * (bw + 0.3), y = 1.75 + Math.floor(i / 2) * (bh + 0.3);
      box(s, x, y, bw, bh, H.white, { line: H.line });
      T(s, `0${i + 1}`, x + 0.3, y + 0.25, 0.5, 0.35, { fontSize: 14, bold: true, color: H.gold });
      T(s, t, x + 0.75, y + 0.25, bw - 1, 0.35, { fontSize: 15, bold: true, color: H.navy });
      for (let k = 0; k < 3; k++) s.addShape(pres.shapes.LINE, { x: x + 0.3, y: y + 1.05 + k * 0.4, w: bw - 0.6, h: 0, line: { color: "C9CED6", width: 0.75, dashType: "dash" } });
    });
  }

  // ════════ 第2幕 発見 ════════
  // P05
  {
    const s = slide(2, "LIGHT", "住まいは、金融資産とは違う。", {
      section: true,
      msg: "株・NISAと自宅は「どちらが得か」ではなく役割が違う。金融資産は増やす・備えるための手段。自宅は住みながら使える実物資産。株を否定せず「住まいは株では代わりがききません」と、両方持つ前提で話す。",
      ask: ["今、NISAやiDeCoで積立をしていますか？", "資産について、いちばん大事にしているのは「増やす」「守る」「使う」のどれですか？"],
      worry: ["家を買うよりNISAで運用したほうが得では", "家を買ったら積立をやめないといけないのでは"],
      answer: ["利回りと換金性だけなら金融資産が有利な面がはっきりある。ただ住まいは誰でも必ずお金を払うもので、比べる土俵が違う", "購入後も積立を続けられる返済額にすること。それが両立の条件（P11・P19）", "「必ず値上がりする」「絶対に損しない」は宅建業法で禁じられた断定的説明。言わない"],
      next: "「では、自宅にしかない『土地』という価値を見ていきます。」",
    });
    const cw = 5.2, y0 = 1.85, ch = 4.3;
    const rowsL = [["目的", "増やす・備える"], ["使い方", "持っているだけ"], ["現金化", "比較的すぐ（価格は変動）"], ["維持", "ほぼ不要（保有コストは少額）"]];
    const rowsR = [["目的", "住む・使う"], ["使い方", "毎日、暮らしの場として"], ["現金化", "数か月と費用がかかる"], ["維持", "修繕・税金・保険が必要"]];
    const col = (x, title, sub, rows, dark) => {
      box(s, x, y0, cw, ch, dark ? H.navy : H.mist);
      T(s, title, x + 0.4, y0 + 0.3, cw - 0.8, 0.45, { fontSize: 20, bold: true, color: dark ? H.white : H.navy, fontFace: FH });
      T(s, sub, x + 0.4, y0 + 0.78, cw - 0.8, 0.3, { fontSize: 12, color: dark ? H.gold : H.goldD });
      rows.forEach((r, i) => {
        const y = y0 + 1.3 + i * 0.7;
        hline(s, x + 0.4, y, cw - 0.8, dark ? H.navyL : H.line);
        T(s, r[0], x + 0.4, y + 0.1, 1.2, 0.5, { fontSize: 13, color: dark ? H.onNavy : H.gray, valign: "middle" });
        T(s, r[1], x + 1.55, y + 0.1, cw - 1.95, 0.5, { fontSize: 15, bold: true, color: dark ? H.white : H.char, valign: "middle" });
      });
    };
    col(M, "株式・投資信託", "NISA口座などで保有", rowsL, false);
    col(W - M - cw, "自宅（土地付き戸建て）", "住みながら使える実物資産", rowsR, true);
    const cx = (W - 1.6) / 2, cy = y0 + ch / 2 - 0.8;
    s.addShape(pres.shapes.OVAL, { x: cx, y: cy, w: 1.6, h: 1.6, fill: { color: H.white }, line: { color: H.gold, width: 1.5 } });
    T(s, "比べる\n土俵が\n違う", cx, cy, 1.6, 1.6, { fontSize: 14, bold: true, color: H.navy, align: "center", valign: "middle", fontFace: FH });
    note(s, "※ NISAは投資で得た利益が非課税になる「制度（口座）」で、投資商品そのものではありません。どちらが有利かは目的と期間で変わります。本資料は特定の金融商品の勧誘を目的としません。");
  }

  // P06
  {
    const s = slide(2, "LIGHT", "土地を所有するということ。", {
      msg: "不動産は「場所の権利」。動かせない、二つとない、登記で持ち主を示す。土地付き戸建ては、その場所を法令の範囲で自由に使い、貸し、売り、建て替えられる。ただし土地の価格も上下する。",
      ask: ["住む場所を選ぶとき、絶対に譲れない条件は何ですか？", "この街に、どのくらい住み続けるイメージがありますか？"],
      worry: ["土地は値下がりしないのでは（誤解）", "土地があれば何でも建てられるのでは（誤解）"],
      answer: ["土地価格も人口や需要で上下する。値上がりは保証できない。だから立地・接道・用途地域など『価値の理由』を確認する（P21）", "建てられる建物は建築基準法・都市計画法（用途地域・建ぺい率・容積率など）で決まり、重要事項説明で確認する"],
      next: "「土地と建物では、価値の動き方がまったく違います。」",
    });
    photo(s, "p15.jpg", M, 1.75, 5.3, 4.65);
    const x0 = M + 5.75, w0 = CW - 5.75;
    T(s, "不動産とは、\n「場所の権利」。", x0, 1.75, w0, 1.25, { fontFace: FH, fontSize: 28, bold: true, color: H.navy, lineSpacingMultiple: 1.1 });
    const pts = [
      ["01", "二つとない", "同じ立地・形・道路付けの土地は存在しない。だから定価がなく、価格は査定と交渉で決まる。"],
      ["02", "所有する", "登記で持ち主を公に示す。法令の範囲で、使う・貸す・売る・建て替えるを自分で決められる。"],
      ["03", "選択肢が残る", "住み続ける、売る、住み替える、条件が整えば貸す。将来の状況に合わせて選べる。"],
    ];
    pts.forEach((p, i) => {
      const y = 3.2 + i * 1.08;
      T(s, p[0], x0, y, 0.6, 0.4, { fontSize: 20, bold: true, color: H.gold, fontFace: FH });
      T(s, p[1], x0 + 0.65, y + 0.02, w0 - 0.65, 0.36, { fontSize: 16, bold: true, color: H.navy });
      T(s, p[2], x0 + 0.65, y + 0.4, w0 - 0.65, 0.62, { fontSize: 13, color: H.char });
    });
    note(s, "※ 民法86条1項「土地及びその定着物は、不動産とする」。土地の利用は建築基準法・都市計画法等の制限を受けます。土地価格の上昇を保証するものではありません。");
  }

  // P07
  {
    const s = slide(2, "LIGHT", "土地と建物、二つの価値。", {
      msg: "物件価格を土地と建物に分けて見る。建物は年数とともに評価が下がるのが一般的で、手入れで差がつく。土地は劣化しないが、市場で上下する。「どこの土地か」と「どう手入れするか」の両方が大切。",
      ask: ["この物件価格のうち、土地と建物がそれぞれいくらか気になりますか？", "建物の手入れには、どのくらい関心がありますか？"],
      worry: ["木造は20年ほどで価値がゼロになると聞いた", "建物の価値が下がるなら損では"],
      answer: ["中古市場では木造の建物は築20〜25年ほどで評価がかなり低くなるのが一般的（元資料『戸建ての基礎知識』）。ただし寿命ではなく、点検・修繕の記録は評価につながる", "木造住宅の法定耐用年数22年は税務上の基準で、建物の寿命ではない", "中古戸建ては『建物が安くなった分、土地付きで手に入る家』とも言える（P15）"],
      next: "「では、所有することで得られる『空間の自由』を具体的に見ていきます。」",
    });
    const yrs = [0, 5, 10, 15, 20, 25, 30];
    const flat = LL.SCENARIOS[1];
    s.addChart(pres.charts.LINE, [
      { name: "土地（横ばいと仮定）", labels: yrs.map((y) => y + "年"), values: yrs.map((t) => Math.round(LL.valueAt(NA.p, flat, t).land / 1e4)) },
      { name: "建物（年数とともに下がる一例）", labels: yrs.map((y) => y + "年"), values: yrs.map((t) => Math.round(LL.valueAt(NA.p, flat, t).bldg / 1e4)) },
    ], { ...CHART, x: M, y: 1.75, w: 7.4, h: 4.6, chartColors: [H.gold, H.navy], lineSize: 3, lineDataSymbol: "circle", lineDataSymbolSize: 7,
      showTitle: true, title: "概念図：価値の動き方の違い（万円）", valAxisMinVal: 0, valAxisMaxVal: 2500 });
    const x0 = M + 7.75, w0 = CW - 7.75;
    box(s, x0, 1.8, w0, 2.15, H.ivory);
    await ico(s, "LuMapPin", x0 + 0.3, 2.05, 0.45, H.goldD);
    T(s, "土地", x0 + 0.9, 2.05, 2, 0.45, { fontSize: 20, bold: true, color: H.navy, fontFace: FH, valign: "middle" });
    T(s, "劣化しない。価値は立地・需要・金利・人口など「市場」で上下する。", x0 + 0.3, 2.7, w0 - 0.6, 1.1, { fontSize: 14, lineSpacingMultiple: 1.15 });
    box(s, x0, 4.15, w0, 2.15, H.navy);
    await ico(s, "LuHammer", x0 + 0.3, 4.4, 0.45, H.gold);
    T(s, "建物", x0 + 0.9, 4.4, 2, 0.45, { fontSize: 20, bold: true, color: H.white, fontFace: FH, valign: "middle" });
    T(s, "年数とともに評価が下がるのが一般的。点検・修繕・リフォームで差がつく。", x0 + 0.3, 5.05, w0 - 0.6, 1.1, { fontSize: 14, color: H.white, lineSpacingMultiple: 1.15 });
    note(s, `※ 概念図です。将来価格を示すものではありません。試算では${NA.p.label}${man(NA.p.price)}を土地${man(NA.p.landPrice)}・建物${man(NA.p.bldgPrice)}と仮定し、建物は10年で${NA.p.b10 * 100}%・下限10%とした一例です。`);
  }

  // P08
  {
    const s = slide(2, "LIGHT", "賃貸では得にくい、空間の自由。", {
      msg: "賃貸では契約上の制約を受けやすい「改装・音・ペット・駐車場」。所有すれば、法令と近隣への配慮の範囲で自分の判断で決められる。ただし実現できるかは物件しだいなので、条件も必ずセットで伝える。",
      ask: ["今、賃貸の規約や間取りであきらめていることはありますか？", "駐車場は何台あると安心ですか？"],
      worry: ["賃貸でも広い部屋を借りれば同じでは", "ペットを飼うと売るときに不利では"],
      answer: ["広さは家賃で買えるが、造作・防音・駐車場・ペットは契約で制限されやすい（P12で総住居費を比較）", "飼育の跡は売却時の評価に影響しうる。床材・壁材の選び方と補修で備える"],
      next: "「マンションという選択肢とも、公平に比べておきましょう。」",
    });
    const sc = ED.p08 || [
      ["p03.jpg", "在宅勤務・趣味", "個室を書斎や趣味の部屋に。生活音と分けられる。", "条件：間取り・通信環境・防音"],
      ["p01.jpg", "車・バイク", "敷地内で、出し入れも手入れも自分のペースで。", "条件：駐車スペース・前面道路の幅"],
      ["p16.jpg", "ペットと庭", "飼育規約に縛られにくく、外の空間も使える。", "条件：近隣への配慮・自治体のルール"],
    ];
    const cw = (CW - 0.6) / 3;
    sc.forEach((c, i) => {
      const x = M + i * (cw + 0.3);
      photo(s, c[0], x, 1.75, cw, 2.75);
      T(s, c[1], x, 4.68, cw, 0.42, { fontSize: 18, bold: true, color: H.navy, fontFace: FH });
      T(s, c[2], x, 5.12, cw, 0.62, { fontSize: 14 });
      box(s, x, 5.8, cw, 0.42, H.goldL);
      T(s, c[3], x + 0.15, 5.8, cw - 0.3, 0.42, { fontSize: 12, bold: true, color: H.goldD, valign: "middle" });
    });
    note(s, `※ ${ED.photoNote}実現できるかは物件の間取り・敷地条件・法令・近隣環境によって異なります。`);
  }

  // P09
  {
    const s = slide(2, "LIGHT", "マンションと戸建て、何が違う？", {
      msg: "どちらにも長所と短所がある。マンションにも敷地の共有持分がある（「マンションは土地がない」は誤り）。違いは土地を単独で持つか共有するか、管理を自分で決めるか管理組合で決めるか。",
      ask: ["管理は「任せたい」派ですか、「自分で決めたい」派ですか？", "駅からの距離と広さ、どちらを優先しますか？"],
      worry: ["戸建ては修繕費が読めない", "マンションのほうが売りやすいのでは"],
      answer: [`戸建ては管理費・修繕積立金がない代わりに自分で積み立てる（試算では月${manN(NA.p.repairMonth, 1)}万円を住居費に含める）`, "駅近マンションは流通しやすい傾向がある。戸建ては立地・土地条件で個別性が大きいので、売れる・貸せる立地を選ぶことが大切"],
      next: "「では、あなたの暮らしに合う戸建てとはどんなものか。希望を条件に置き換えてみます。」",
    });
    const cw = (CW - 0.4) / 2;
    const cols = [
      ["LuBuilding2", "分譲マンション", [["駅近・都市部に多く、通勤に便利"], ["共用部の管理を管理会社に任せられる"], ["オートロックなど防犯設備が整いやすい"]],
        [["管理費・修繕積立金が毎月かかる（月2〜4万円ほどが目安）"], ["改修できるのは専有部分のみ（管理規約の範囲）"], ["駐車場は別契約・空き待ちのことも"]], false],
      ["LuHouse", "土地付き戸建て", [["土地を単独で所有。建物は独立した1棟"], ["管理費・修繕積立金がない（自分で積立）"], ["音・駐車場・庭・改修の自由度が高い"]],
        [["修繕の時期と費用を自分で計画・負担する"], ["郊外・駅から離れた立地が多い傾向"], ["防犯・草取りなど、手入れを自分で行う"]], true],
    ];
    for (let i = 0; i < 2; i++) {
      const [ic, title, pros, cons, dark] = cols[i];
      const x = M + i * (cw + 0.4);
      box(s, x, 1.75, cw, 4.55, dark ? H.navy : H.mist);
      await disc(s, ic, x + 0.35, 1.98, 0.6, dark ? H.gold : H.navy);
      T(s, title, x + 1.1, 1.98, cw - 1.4, 0.6, { fontSize: 20, bold: true, color: dark ? H.white : H.navy, fontFace: FH, valign: "middle" });
      T(s, "良いところ", x + 0.35, 2.8, 2, 0.3, { fontSize: 12, bold: true, color: dark ? H.gold : H.goldD });
      pros.forEach((p, k) => { T(s, [{ text: "◯　", options: { color: dark ? H.gold : H.goldD, bold: true } }, { text: p[0] }], x + 0.35, 3.12 + k * 0.42, cw - 0.7, 0.4, { fontSize: 14, color: dark ? H.white : H.char, valign: "middle" }); });
      T(s, "気をつけたいところ", x + 0.35, 4.48, 3, 0.3, { fontSize: 12, bold: true, color: dark ? H.onNavy : H.gray });
      cons.forEach((p, k) => { T(s, [{ text: "△　", options: { color: dark ? H.onNavy : H.gray, bold: true } }, { text: p[0] }], x + 0.35, 4.8 + k * 0.42, cw - 0.7, 0.4, { fontSize: 14, color: dark ? H.white : H.char, valign: "middle" }); });
    }
    note(s, "※ 分譲マンションも敷地を区分所有者で共有しています（敷地利用権）。一般的な傾向の比較で、管理費等の金額・駐車場の有無などは物件ごとに異なります。");
  }

  // P10
  {
    const s = slide(2, "IVORY", "あなたの暮らしに合う戸建てとは。", {
      msg: "単身者を一括りにしない。P04で書いた希望を「物件で確認する条件」に置き換える。3つのタイプは例で、実際はシミュレーターで希望を入力すると、物件ごとに合う・合わない・未確認が自動で出る。",
      ask: ["3つのタイプのうち、いちばん近いのはどれですか？", "「これがないなら買わない」という条件を1つ挙げるとしたら？"],
      worry: ["条件を全部満たす物件はないのでは", "優先順位がつけられない"],
      answer: ["全部を満たす物件はまれ。「必須」と「あればうれしい」を分けると判断しやすい", "迷う場合は、毎月の住居費と通勤時間を先に決めると絞り込みやすい"],
      next: "「暮らしのイメージができたところで、お金の現実を確かめていきます。」",
    });
    const P = ED.personas;
    const cw = (CW - 0.6) / 3;
    for (let i = 0; i < 3; i++) {
      const x = M + i * (cw + 0.3);
      box(s, x, 1.75, cw, 3.9, H.white, { line: H.line });
      await disc(s, P[i][0], x + 0.3, 2.0, 0.62, H.navy);
      T(s, P[i][1], x + 1.05, 1.98, cw - 1.2, 0.36, { fontSize: 17, bold: true, color: H.navy, fontFace: FH });
      T(s, P[i][2], x + 1.05, 2.34, cw - 1.2, 0.3, { fontSize: 12, color: H.goldD });
      T(s, "物件で確認する条件", x + 0.3, 2.95, cw - 0.6, 0.3, { fontSize: 12, bold: true, color: H.gray });
      P[i][3].forEach((t, k) => {
        hline(s, x + 0.3, 3.3 + k * 0.72, cw - 0.6);
        T(s, t, x + 0.3, 3.36 + k * 0.72, cw - 0.6, 0.62, { fontSize: 14, valign: "middle" });
      });
    }
    box(s, M, 5.85, CW, 0.5, H.navy);
    T(s, "希望（P04）　→　物件の条件（このページ）　→　物件ごとの適合チェック（P23・シミュレーター）", M + 0.3, 5.85, CW - 0.6, 0.5, { fontSize: 14, bold: true, color: H.white, valign: "middle" });
  }

  // ════════ 第3幕 納得 ════════
  // P11
  {
    const fin = !!NA.p.financeCosts;
    const s = slide(3, "LIGHT", "購入は、月々の返済だけで考えない。", {
      section: true,
      msg: `お金は3つの数字で見る。①最初に払う「初期費用」${man(NA.cashOut)}、②毎月の「住居費」${manN(NA.own.total, 1)}万円（返済に税・保険・修繕を加える）、③買った後に残る「手元資金」${man(NA.cashLeft)}。${fin ? `諸費用を借入に含めるので、借入は物件価格より多い${man(NA.loan.amount)}になり、そのぶん利息も増えることを先に伝える。` : ""}`,
      ask: ["購入後も、手元にいくら残しておきたいですか？", "月々いくらまでなら、今の生活水準を変えずに払えそうですか？"],
      worry: ["頭金は多いほうがいいのでは", "諸費用がこんなにかかるとは思わなかった"],
      answer: [`頭金を増やすと借入と利息は減るが手元資金が薄くなる。単身者は収入源が1つなので、生活費の半年分程度を残す考え方がおすすめ（目安${man(NA.reserveTarget)}）`, "諸費用は登記費用・ローン手数料・保証料・保険などで、物件価格とは別に必要"],
      next: "「では、今の家賃と比べて毎月の支出がどう変わるかを見てみましょう。」",
    });
    const cw = (CW - 0.6) / 3;
    const cols = [
      ["初期費用（現金）", man(NA.cashOut), fin ? [["頭金", man(NA.p.down)], [`諸費用（価格の${pct(NA.p.buyCostRate, 1)}・借入に含める）`, man(NA.buyCost)]] : [["頭金", man(NA.p.down)], [`購入諸費用（価格の${pct(NA.p.buyCostRate, 1)}と仮定）`, man(NA.buyCost)]], H.navy],
      ["毎月の住居費", manN(NA.own.total, 1) + "万円", [["ローン返済", yen(NA.pmt)], ["固定資産税等・保険・修繕積立", yen(NA.own.upkeep)]], H.navy],
      ["購入後の手元資金", man(NA.cashLeft), [["預貯金", man(CU.savings)], ["予備資金の目安（生活費6か月）", man(NA.reserveTarget)]], NA.cashLeft >= NA.reserveTarget ? H.gain : H.loss],
    ];
    cols.forEach((c, i) => {
      const x = M + i * (cw + 0.3);
      box(s, x, 1.75, cw, 3.25, i === 2 ? H.ivory : H.mist);
      T(s, `0${i + 1}`, x + 0.35, 1.95, 0.6, 0.35, { fontSize: 14, bold: true, color: H.gold });
      T(s, c[0], x + 0.9, 1.95, cw - 1.2, 0.35, { fontSize: 15, bold: true, color: H.navy });
      T(s, c[1], x + 0.35, 2.45, cw - 0.7, 0.9, { fontSize: 40, bold: true, color: c[3] });
      c[2].forEach((r, k) => {
        hline(s, x + 0.35, 3.55 + k * 0.62, cw - 0.7);
        T(s, r[0], x + 0.35, 3.6 + k * 0.62, cw - 1.9, 0.52, { fontSize: 12, color: H.gray, valign: "middle" });
        T(s, r[1], x + cw - 1.65, 3.6 + k * 0.62, 1.3, 0.52, { fontSize: 14, bold: true, color: H.char, align: "right", valign: "middle" });
      });
    });
    box(s, M, 5.25, CW, 1.05, H.navy);
    await ico(s, "LuLightbulb", M + 0.35, 5.47, 0.6, H.gold);
    if (NA.cashLeft < NA.reserveTarget && NA.p.down > 0) {
      const down = Math.max(0, NA.p.down - (NA.reserveTarget - NA.cashLeft));
      const alt = LL.compute({ ...S, props: [{ ...S.props[ED.focus], down: Math.round(down / 100_000) * 100_000 }] }).props[0];
      T(s, `見直し案：頭金を${man(alt.p.down)}にすると`, M + 1.2, 5.32, 6, 0.4, { fontSize: 13, bold: true, color: H.gold });
      T(s, `手元資金 ${man(alt.cashLeft)}／毎月の返済 ${yen(alt.pmt)}（＋${yen(alt.pmt - NA.pmt)}）`, M + 1.2, 5.7, CW - 1.5, 0.45, { fontSize: 16, bold: true, color: H.white });
    } else {
      T(s, fin ? "頭金を入れすぎず、手元資金を残す計画" : "手元資金を残せる計画", M + 1.2, 5.32, 8, 0.4, { fontSize: 13, bold: true, color: H.gold });
      T(s, `手元資金 ${man(NA.cashLeft)} ／ 予備資金の目安 ${man(NA.reserveTarget)}${fin ? `　・　借入 ${man(NA.loan.amount)}（諸費用込み）` : ""}`, M + 1.2, 5.7, CW - 1.5, 0.45, { fontSize: 16, bold: true, color: H.white });
    }
    note(s, `※ サンプル条件（架空）：${NA.p.label}${man(NA.p.price)}・頭金${man(NA.p.down)}・借入${man(NA.loan.amount)}・年利${pct(S.loan.rate)}（試算用の仮定）・${S.loan.years}年・元利均等。固定資産税等 年${manN(NA.p.propTaxYear)}万円・保険 年${manN(NA.p.insYear)}万円・修繕積立 月${manN(NA.p.repairMonth, 1)}万円・生活費（住居費以外）月${manN(CU.livingMonth)}万円は仮定値。`);
  }

  // P12
  {
    const diff = NA.own.total - X.rent.total;
    const s = slide(3, "LIGHT", "賃貸と戸建て、支出はどう変わる？", {
      msg: `家賃と返済額だけを比べない。税金・保険・修繕・更新料・管理費・駐車場まで入れた「総住居費」で比べる。今の賃貸は月${manN(X.rent.total, 1)}万円、${NA.p.label}は${manN(NA.own.total, 1)}万円。何と比べるかで結論が変わることを示す。${X.afford ? `月々の返済を${manN(CU.monthlyWish, 1)}万円にするなら、物件価格の目安は約${manN(X.afford.price)}万円。` : ""}`,
      ask: ["今の家賃以外に、住まいにかかっている費用（更新料・駐車場など）はいくらですか？", `月${manN(Math.abs(diff), 1)}万円の差は、得られる広さや自由に見合うと感じますか？`],
      worry: ["家賃とほぼ同じ返済額なら買ったほうが得では", "結局、高くなるのでは"],
      answer: [`返済額（${manN(NA.pmt, 1)}万円）に、所有すると税金・保険・修繕がかかる。総額では今の賃貸より月${manN(Math.abs(diff), 1)}万円${diff >= 0 ? "多い" : "少ない"}`, "家賃は『住む権利』の対価で、無駄ではない。違いは、所有すると住みながら借入残高が減っていく点と、広さ・駐車場・自由度"],
      next: "「ここに、住宅ローン控除という税金の軽減が加わります。新築と中古で違いがあります。」",
    });
    const rows = [
      ["今の賃貸", [["家賃・返済", X.rent.rent], ["税・保険", X.rent.ins], ["修繕・更新料", X.rent.renew], ["管理費等・駐車場", X.rent.park]], X.rent.total],
      [`分譲マンション（${manN(S.condo.price)}万円と仮定）`, [["家賃・返済", X.condo.loan], ["税・保険", X.condo.tax + X.condo.ins], ["修繕・更新料", 0], ["管理費等・駐車場", X.condo.fees + X.condo.park]], X.condo.total],
      ...X.props.map((o) => [`${o.p.label}（サンプル）`, [["家賃・返済", o.own.loan], ["税・保険", o.own.tax + o.own.ins], ["修繕・更新料", o.own.repair], ["管理費等・駐車場", 0]], o.own.total]),
    ];
    const cols = [H.navy, H.soft, H.gold, "C9CED6"];
    const bx = M + 3.7, maxW = X.afford ? 4.1 : 5.6, sc = maxW / Math.max(...rows.map((r) => r[2]));
    rows.forEach((r, i) => {
      const y = 1.85 + i * 0.95;
      T(s, r[0], M, y, 3.55, 0.55, { fontSize: 14, bold: i >= 2, color: i >= 2 ? H.navy : H.char, valign: "middle" });
      let x = bx;
      r[1].forEach((seg, j) => { const w = seg[1] * sc; if (w > 0.01) rect(s, x, y + 0.05, w, 0.45, cols[j]); x += w; });
      T(s, `${manN(r[2], 1)}万円`, x + 0.15, y, 1.6, 0.55, { fontSize: 18, bold: true, color: i >= 2 ? H.navy : H.char, valign: "middle" });
    });
    ["家賃・ローン返済", "税金・保険", "修繕積立・更新料", "管理費等・駐車場"].forEach((l, j) => {
      const x = M + j * 1.75;
      rect(s, x, 5.75, 0.2, 0.2, cols[j]);
      T(s, l, x + 0.28, 5.7, 1.45, 0.3, { fontSize: 10, color: H.char, valign: "middle" });
    });
    if (X.afford) {
      const ax = M + 9.35, aw = CW - 9.35;
      box(s, ax, 1.85, aw, 3.7, H.navy);
      T(s, "家賃並みの支払いなら", ax + 0.2, 1.98, aw - 0.4, 0.55, { fontSize: 12, bold: true, color: H.gold });
      T(s, `返済 月${manN(CU.monthlyWish, 1)}万円`, ax + 0.2, 2.55, aw - 0.4, 0.4, { fontSize: 14, bold: true, color: H.white });
      T(s, "物件価格の目安", ax + 0.2, 3.1, aw - 0.4, 0.3, { fontSize: 11, color: H.onNavy });
      T(s, `約${manN(X.afford.price)}万円`, ax + 0.2, 3.4, aw - 0.4, 0.55, { fontSize: 20, bold: true, color: H.white });
      T(s, `${NA.p.financeCosts ? "諸費用込みの借入" : "頭金＋借入"}・年利${pct(S.loan.rate)}・${S.loan.years}年で計算。税・保険・修繕は別にかかります。`, ax + 0.2, 4.05, aw - 0.4, 1.3, { fontSize: 10, color: H.onNavy });
    }
    note(s, `※ 仮定値：賃貸は更新料2年ごとに1か月分・家財保険 年${manN(CU.rentInsYear ?? 20_000, 1)}万円。マンションは頭金${man(S.condo.down)}・管理費＋修繕積立金 月${manN(S.condo.fees, 1)}万円・駐車場 月${manN(S.condo.parking, 1)}万円。戸建ての税・保険・修繕はP11と同じ。住宅ローン控除・初期費用は含みません。`);
  }

  // P13
  {
    const s = slide(3, "LIGHT", "新築・中古で住宅ローン控除はどう違う？", {
      msg: `控除の枠（借入限度額×控除期間）は「新築か中古か」と「住宅の性能」で決まる。2026年以降は、性能の高い中古（ZEH水準・認定住宅）も3,500万円・13年に拡充された。省エネ基準を満たさない新築は原則対象外。性能を証明する書類があるかが分かれ目。`,
      ask: ["検討中の物件に、省エネ性能の証明書は付いていますか？", "入居はいつ頃を考えていますか？（2028年以降は新築の条件が変わります）"],
      worry: ["中古は控除が少ないのでは", "新築なら必ず控除を受けられるのでは"],
      answer: ["性能の高い中古はZEH水準・認定住宅なら3,500万円・13年。性能の証明がない中古は2,000万円・10年", "省エネ基準を満たさない新築は原則対象外。2028年以降入居の省エネ基準適合住宅は、2027年末までの建築確認等に限り2,000万円・10年", "子育て・若者夫婦世帯の上乗せは、単身者には適用しない（条件を満たす場合のみ）"],
      next: `「では、年収${manN(CU.gross)}万円の方なら実際にいくら軽くなるのか、年ごとに見てみましょう。」`,
    });
    const pw = (CW - 0.3) / 2;
    const rowsNew = [["認定長期優良・低炭素", 45e6, 13, ""], ["ZEH水準省エネ", 35e6, 13, ""], ["省エネ基準適合", 20e6, 13, "2028年以降入居は経過措置のみ（2,000万円・10年）"], ["その他（基準未満）", 0, 0, "2023年末までの建築確認等なら2,000万円・10年"]];
    const rowsUsed = [["認定長期優良・低炭素", 35e6, 13, ""], ["ZEH水準省エネ", 35e6, 13, ""], ["省エネ基準適合", 20e6, 13, ""], ["その他（証明なし）", 20e6, 10, "1981年以前の建築は耐震の証明が必要"]];
    const panel = (x, title, rows, dark) => {
      box(s, x, 1.75, pw, 3.6, dark ? H.navy : H.mist);
      T(s, title, x + 0.3, 1.85, pw - 0.6, 0.42, { fontSize: 17, bold: true, color: dark ? H.white : H.navy, fontFace: FH, valign: "middle" });
      const cs = 0.13, tx = x + pw - 0.3 - 13 * cs;
      T(s, "借入限度額", x + 2.2, 2.32, 1.3, 0.24, { fontSize: 10, color: dark ? H.onNavy : H.gray });
      T(s, "控除期間（最長13年）", tx, 2.32, 13 * cs, 0.24, { fontSize: 10, color: dark ? H.onNavy : H.gray });
      rows.forEach((r, i) => {
        const y = 2.65 + i * 0.68;
        T(s, r[0], x + 0.3, y, 2.0, 0.36, { fontSize: 13, bold: true, color: dark ? H.white : H.navy, valign: "middle" });
        T(s, r[1] ? manN(r[1]) + "万円" : "対象外", x + 2.2, y, 1.35, 0.36, { fontSize: 16, bold: true, color: r[1] ? (dark ? H.gold : H.goldD) : (dark ? "F0B9AC" : H.loss), valign: "middle" });
        for (let k = 0; k < 13; k++) {
          const on = k < r[2];
          rect(s, tx + k * cs, y + 0.09, cs - 0.03, 0.2, on ? (dark ? H.gold : H.navy) : (dark ? H.navyL : "D3D7DD"));
        }
        if (r[3]) T(s, r[3], x + 0.3, y + 0.37, pw - 0.6, 0.25, { fontSize: 10, color: dark ? H.onNavy : H.gray });
      });
    };
    panel(M, "新築（買取再販は新築に準じる）", rowsNew, false);
    panel(M + pw + 0.3, "中古（既存住宅）", rowsUsed, true);
    box(s, M, 5.5, CW, 0.82, H.ivory);
    T(s, "共通の主な要件", M + 0.3, 5.5, 1.6, 0.82, { fontSize: 13, bold: true, color: H.goldD, valign: "middle" });
    T(s, "控除率0.7%／床面積40㎡以上（40〜50㎡は合計所得1,000万円以下の年のみ）／合計所得2,000万円以下／返済期間10年以上／取得から6か月以内に入居／親族等からの取得は対象外", M + 1.95, 5.5, CW - 2.25, 0.82, { fontSize: 12, valign: "middle" });
    note(s, `※ 一般世帯の限度額。制度の基準日：${R.BASIS_DATE}時点（令和8年度税制改正後・2026〜2030年入居）。2028年以降入居の災害レッドゾーン内の新築は対象外。買取再販住宅の限度額は〔要確認〕。出典：${R.SOURCES.join("、")}。`);
  }

  // P14
  {
    const C = NA.credit, P = C.rows.filter((r) => r.inPeriod);
    const avgM = P.length ? C.total / P.length / 12 : 0;
    const s = slide(3, "LIGHT", "住宅ローン控除は、いくら受けられる？", {
      msg: `制度上の上限（年末残高×0.7%）は${C.judge.years}年で${man(C.totalMax, 1)}。実際に控除できるのは、その年の所得税と住民税（上限9.75万円）の範囲まで。年収${man(CU.gross)}のサンプルでは見込み${man(C.total, 1)}。控除は毎月の返済額を減らすのではなく、税金が軽くなる制度。${NA.p.financeCosts ? "諸費用を借入に含めた部分は控除の対象外なので、年末残高を住宅の取得分で按分して計算している。" : ""}`,
      ask: ["昨年の源泉徴収票はお手元にありますか？（あると詳しく計算できます）", "医療費控除・ふるさと納税など、ほかに税金が減る制度を使っていますか？"],
      worry: ["最大額が全部戻ってくるのでは", "控除で毎月の返済が安くなるのでは"],
      answer: ["戻るのは税額の範囲まで。本試算は概算で、所得が変われば見込みも変わる", `毎月の返済${yen(NA.pmt)}は変わらない。所得税は年末調整・確定申告で還付、住民税は翌年度に減額される`, "1年目は確定申告が必要（2年目以降は年末調整）"],
      next: "「控除を差し引いたうえで、2つの物件の10年間の総コストを比べます。」",
    });
    if (P.length) {
      const cats = P.map((r) => r.i + "年目");
      const v = (f) => P.map((r) => +(r[f] / 1e4).toFixed(1));
      const top = Math.ceil(Math.max(...P.map((r) => r.max)) / 1e4 / 5) * 5 + 5;
      s.addChart(pres.charts.BAR, [
        { name: "所得税から", labels: cats, values: v("fromIT") },
        { name: "住民税から", labels: cats, values: v("fromRT") },
        { name: "控除しきれない額（受け取れない）", labels: cats, values: v("unused") },
      ], { ...CHART, x: M, y: 1.75, w: 7.6, h: 4.6, barDir: "col", barGrouping: "stacked", chartColors: [H.navy, H.gold, "D3D7DD"],
        showTitle: true, title: `年ごとの控除見込額（万円）— ${desc(NA)}・${CU.moveInYear}年入居`, showValue: true, dataLabelPosition: "ctr", dataLabelColor: H.white,
        dataLabelFontSize: 9, dataLabelFontFace: "+mn-lt", dataLabelFormatCode: '[<1.5]"";0.0', valAxisMinVal: 0, valAxisMaxVal: top, barGapWidthPct: 45 });
    }
    const x0 = M + 7.9, w0 = CW - 7.9;
    box(s, x0, 1.8, w0, 2.3, H.navy);
    T(s, `${C.judge.years}年間の控除見込額（概算）`, x0 + 0.3, 1.95, w0 - 0.6, 0.3, { fontSize: 12, bold: true, color: H.gold });
    T(s, man(C.total, 1), x0 + 0.3, 2.25, w0 - 0.6, 0.75, { fontSize: 38, bold: true, color: H.white });
    T(s, `初年度 ${yen(C.first)}`, x0 + 0.3, 3.0, w0 - 0.6, 0.26, { fontSize: 11, color: H.white });
    T(s, `2年目以降 平均 ${yen(C.laterAvg)}`, x0 + 0.3, 3.26, w0 - 0.6, 0.26, { fontSize: 11, color: H.white });
    T(s, `上限 ${man(C.totalMax, 1)}・控除しきれない ${man(C.totalUnused, 1)}`, x0 + 0.3, 3.55, w0 - 0.6, 0.26, { fontSize: 11, color: H.goldL });
    box(s, x0, 4.3, w0, 2.0, H.mist);
    T(s, "返済額は変わらない", x0 + 0.3, 4.42, w0 - 0.6, 0.32, { fontSize: 14, bold: true, color: H.navy });
    [["毎月のローン返済", yen(NA.pmt)], ["控除の月割り（参考）", `約${manN(avgM, 1)}万円`], [`${C.judge.years + 1}年目以降`, "控除なし"]].forEach((l, i) => {
      T(s, l[0], x0 + 0.3, 4.85 + i * 0.45, 2.5, 0.4, { fontSize: 12, color: H.gray, valign: "middle" });
      T(s, l[1], x0 + 2.7, 4.85 + i * 0.45, w0 - 3.0, 0.4, { fontSize: 13, bold: true, color: H.navy, align: "right", valign: "middle" });
    });
    note(s, `※ 年収${man(CU.gross)}・単身・給与所得のみ、社会保険料を年収の15%と仮定した概算（所得税${yen(X.tax.incomeTax)}・住民税所得割${yen(X.tax.residentTax)}）。2028年以降も令和8・9年分の基礎控除等の特例が続くと仮定（保守的な前提）。住民税からの控除は課税総所得金額等×5%・最高97,500円（継続は〔要確認〕）。${NA.p.kind === "resale" ? "買取再販住宅の限度額は〔要確認〕。" : ""}確定額ではありません。`);
  }

  // P15
  {
    const s = slide(3, "LIGHT", `${X.props[0].p.kind === "new" ? "新築" : "中古"}と${X.props[1].p.kind === "new" ? "新築" : "中古"}、10年間の総コスト。`, {
      msg: `初期費用・返済・税・保険・修繕を10年分足し、住宅ローン控除を差し引く。${X.props.map((o) => `${o.p.label}は${man(o.ten.with)}`).join("、")}。控除の額だけでなく、価格と返済の差、修繕の時期まで含めて比べる。`,
      ask: ["2つの物件で、いちばん気になる違いは「価格」「性能」「修繕」のどれですか？", "中古の場合、購入前に建物の状態を調べる（インスペクション）ことに関心はありますか？"],
      worry: ["控除が多いほうが得では", "中古は修繕費が怖い"],
      answer: [`10年の控除は${X.props.map((o) => `${o.p.label}${man(o.ten.credit, 1)}`).join("・")}。控除の差より、価格と返済の差のほうが大きいことが多い`, "中古は修繕積立を多めに置いて比べる。リフォームの内容と時期を確認し、必要なら見積もりを取る", "性能・住み心地・売るときの価値（P16・P18）まで含めて比べる。控除の額だけで決めない"],
      next: "「では、払い続けた結果、残債と家の価値がどうなっていくかを見ます。」",
    });
    const segs = (t) => [["初期費用", t.initial, H.soft], ["ローン返済", t.loan, H.navy], ["固定資産税等", t.tax, "5E6B82"], ["保険", t.ins, "A9B2C0"], ["修繕積立", t.repair, H.gold]];
    const maxV = Math.max(...X.props.map((o) => o.ten.without)), bx = M + 2.2, bw = 5.9, sc = bw / maxV;
    X.props.forEach((o, i) => {
      const y = 1.95 + i * 1.9;
      T(s, o.p.label, M, y - 0.05, 2.1, 0.7, { fontSize: 14, bold: true, color: H.navy, fontFace: FH, valign: "middle" });
      T(s, `${man(o.p.price)}・${R.KIND[o.p.kind]}`, M, y + 0.7, 2.1, 0.3, { fontSize: 11, color: H.gray });
      let x = bx;
      segs(o.ten).forEach((g) => { const w = g[1] * sc; if (w > 0.005) rect(s, x, y + 0.05, w, 0.55, g[2]); if (w > 0.95) T(s, manN(g[1]), x, y + 0.05, w, 0.55, { fontSize: 11, bold: true, color: H.white, align: "center", valign: "middle" }); x += w; });
      T(s, man(o.ten.without), x + 0.15, y + 0.05, 1.6, 0.55, { fontSize: 14, color: H.gray, valign: "middle" });
      const wc = o.ten.with * sc;
      s.addShape(pres.shapes.LINE, { x: bx + wc, y: y + 0.7, w: 0, h: 0.5, line: { color: H.gain, width: 1.5 } });
      rect(s, bx, y + 0.78, wc, 0.32, "DCE8E1");
      T(s, `住宅ローン控除 −${man(o.ten.credit, 1)}　→　実質 ${man(o.ten.with)}`, bx + 0.15, y + 0.78, bw, 0.32, { fontSize: 13, bold: true, color: H.gain, valign: "middle" });
    });
    segs(NA.ten).forEach((g, j) => { const x = bx + j * 1.25; rect(s, x, 5.85, 0.2, 0.2, g[2]); T(s, g[0], x + 0.28, 5.8, 1.2, 0.3, { fontSize: 10, valign: "middle" }); });
    const x0 = M + 9.5, w0 = CW - 9.5;
    box(s, x0, 1.95, w0, 3.7, H.ivory);
    T(s, "10年後に売ったら（横ばい）", x0 + 0.2, 2.05, w0 - 0.4, 0.6, { fontSize: 12, bold: true, color: H.goldD });
    X.props.forEach((o, i) => {
      const sl = o.sale[1].byScen[1];
      const y = 2.8 + i * 1.4;
      T(s, o.p.label, x0 + 0.2, y, w0 - 0.4, 0.3, { fontSize: 12, bold: true, color: H.navy });
      T(s, `想定価格 ${man(sl.total)}\n残債 ${man(sl.balance)}`, x0 + 0.2, y + 0.32, w0 - 0.4, 0.55, { fontSize: 12, color: H.char });
      T(s, `売却手取り ${sgn(sl.net)}`, x0 + 0.2, y + 0.88, w0 - 0.4, 0.3, { fontSize: 12, bold: true, color: sl.net >= 0 ? H.gain : H.loss });
    });
    note(s, `※ 10年間＝初期費用（現金）＋返済120回＋固定資産税等・保険・修繕積立の10年分。${X.props.map((o) => `${o.p.label}：${man(o.p.price)}・${o.p.floor}㎡・${R.PERF[o.p.perf]}${o.p.financeCosts ? "・諸費用込みの借入" : ""}・修繕 月${manN(o.p.repairMonth, 1)}万円`).join("／")}（いずれも仮定値）。控除はP14と同じ概算。`);
  }

  // P16
  {
    const s = slide(3, "LIGHT", "住宅ローン残債と資産の関係。", {
      msg: "返済が進むと残債は減る。売るときの手元は「売却価格−売却費用−残債」。残債（紺の線）と物件の価値（金の線）の差が、売却時の手取りに近い。最初の数年は差が小さく、短期で売ると持ち出しになりやすい。",
      ask: ["10年以内に住み替える可能性は、どのくらいありそうですか？", "繰上げ返済に回せそうな余裕資金は、年にどれくらいありそうですか？"],
      worry: ["返済した分は全部自分の資産になるのでは（誤解）", "値下がりしたら借金だけ残るのでは"],
      answer: ["返済した元金がそのまま利益になるわけではない。手元に残る額は売却価格しだい", "下落シナリオでも生活が成り立つ計画かを、P18で年数ごとに確認する。長く住むほど残債が減り、選択肢が広がる"],
      next: "「ここからは、将来への不安に一つずつ答えていきます。まず、住まいを変えたくなったら。」",
    });
    const yrs = Array.from({ length: S.loan.years + 1 }, (_, t) => t);
    const lab = yrs.map((t) => (t % 5 ? "" : String(t)));
    const val = (k) => NA.values.find((v) => v.key === k).path.map((v) => Math.round(v / 1e4));
    const top = Math.ceil(Math.max(NA.loan.amount, NA.p.price) / 1e7) * 1000;
    s.addChart(pres.charts.LINE, [
      { name: "ローン残債", labels: lab, values: NA.balances.map((b) => Math.round(b / 1e4)) },
      { name: "物件の価値（横ばい）", labels: lab, values: val("flat") },
      { name: "物件の価値（上昇）", labels: lab, values: val("up") },
      { name: "物件の価値（下落）", labels: lab, values: val("down") },
    ], { ...CHART, x: M, y: 1.75, w: 8.4, h: 4.6, chartColors: [H.navy, H.gold, "D9C9A6", "C9CED6"], lineSize: 2.5, lineDataSymbol: "none",
      showTitle: true, title: `${NA.p.label}：残債と物件価値の推移（万円・横軸は年後）`, valAxisMinVal: 0, valAxisMaxVal: top, catAxisLabelRotate: 0 });
    const x0 = M + 8.7, w0 = CW - 8.7;
    T(s, "売却時の手取り", x0, 1.85, w0, 0.35, { fontSize: 14, bold: true, color: H.navy });
    box(s, x0, 2.25, w0, 1.1, H.navy);
    T(s, "売却価格\n− 売却費用 − 残債", x0 + 0.2, 2.25, w0 - 0.4, 1.1, { fontSize: 15, bold: true, color: H.white, align: "center", valign: "middle" });
    [5, 10, 20].forEach((t, i) => {
      const y = 3.6 + i * 0.85;
      T(s, `${t}年後`, x0, y, 1.0, 0.7, { fontSize: 13, bold: true, color: H.goldD, valign: "middle" });
      T(s, `価値 ${man(NA.values[1].path[t])}\n残債 ${man(NA.balances[t])}`, x0 + 1.0, y, w0 - 1.0, 0.7, { fontSize: 12, valign: "middle" });
    });
    note(s, `※ 価値は3つの仮定シナリオ（土地：年−1%／±0%／＋1%、建物：10年後に購入時の${Math.round((NA.p.b10 - 0.1) * 100)}／${Math.round(NA.p.b10 * 100)}／${Math.round((NA.p.b10 + 0.1) * 100)}%・下限10%）で、将来価格の予想・保証ではありません。${NA.p.kind !== "new" ? "リフォーム済み物件の価格には工事費が含まれ、購入直後の市場価格とは一致しません。" : "新築の価格には販売経費等が含まれ、購入直後から市場価格が下がりやすい傾向があります。"}`);
  }

  // ════════ 第4幕 安心 ════════
  // P17
  {
    const s = slide(4, "LIGHT", "将来、住まいを変えたくなったら。", {
      section: true,
      msg: "家を買っても、ずっと住み続けなければならないわけではない。売却・住み替え・条件付きの賃貸という3つの出口がある。どの出口も「売れる・貸せる立地」と「無理のない資金計画」で広がる（元資料：持ち家で成功するための2つのポイント）。",
      ask: ["転勤や転職の可能性は、どのくらいありますか？", "もし住まいを変えるなら、どんな理由が考えられますか？"],
      worry: ["転勤になったら困る", "すぐに売れなかったらどうしよう"],
      answer: ["住宅ローンは原則本人が住むことが前提。貸す場合は金融機関への相談が必要", "急ぐ場合は不動産会社の買取という方法もある（仲介より価格は下がることが多い）", "売却益には居住用財産の3,000万円特別控除などの特例がある（要件を要確認）"],
      next: "「では、5年後・10年後・20年後に売った場合の手取りを具体的に見てみます。」",
    });
    const R3 = [
      ["LuRefreshCw", "売却する", "仲介、または買取で", ["売却価格−売却費用−残債が手元に", "残債を上回らない場合は差額を準備", "居住用の売却益は3,000万円控除の特例あり（要件あり）"]],
      ["LuArrowRightLeft", "住み替える", "今の家を売って、次の家へ", ["売却と購入のタイミングを合わせる", "売却前に次を買う場合は資金の重なりに注意", "ライフスタイルの変化に合わせて広さを変える"]],
      ["LuKeyRound", "貸す（条件付き）", "住まない間、賃貸に出す", ["住宅ローンの金融機関に事前相談が必要", "家賃が返済・管理費・税を上回るか確認", "貸しやすい立地・間取りかが分かれ目"]],
    ];
    const cw = (CW - 0.6) / 3;
    for (let i = 0; i < 3; i++) {
      const x = M + i * (cw + 0.3);
      box(s, x, 1.75, cw, 3.55, i === 1 ? H.navy : H.mist);
      const dark = i === 1;
      await disc(s, R3[i][0], x + 0.35, 2.0, 0.66, dark ? H.gold : H.navy);
      T(s, R3[i][1], x + 1.15, 2.0, cw - 1.4, 0.4, { fontSize: 19, bold: true, color: dark ? H.white : H.navy, fontFace: FH });
      T(s, R3[i][2], x + 1.15, 2.4, cw - 1.4, 0.3, { fontSize: 12, color: dark ? H.gold : H.goldD });
      R3[i][3].forEach((t, k) => {
        hline(s, x + 0.35, 3.0 + k * 0.72, cw - 0.7, dark ? H.navyL : H.line);
        T(s, t, x + 0.35, 3.06 + k * 0.72, cw - 0.7, 0.62, { fontSize: 13, color: dark ? H.white : H.char, valign: "middle" });
      });
    }
    box(s, M, 5.5, CW, 0.82, H.ivory);
    T(s, "出口を広げる準備", M + 0.3, 5.5, 2.0, 0.82, { fontSize: 13, bold: true, color: H.goldD, valign: "middle" });
    T(s, "① 売れる・貸せる立地　② 無理のない返済額　③ 点検・修繕の記録　④ 頭金と予備資金のバランス", M + 2.3, 5.5, CW - 2.6, 0.82, { fontSize: 14, bold: true, color: H.navy, valign: "middle" });
    note(s, "※ 税の特例（居住用財産の3,000万円特別控除など）は適用要件・期限があります。賃貸に出す場合の住宅ローンの扱いは金融機関によって異なります。");
  }

  // P18
  {
    const cells = (o) => o.sale.flatMap((r) => r.byScen);
    const posN = cells(NA).filter((c) => c.net >= 0).length;
    const takeaway = posN === 0
      ? `この試算では、${NA.p.label}はどの時点で売っても持ち出しになります。売って利益を出す家ではなく、長く住む家として選ぶ。売る可能性があるなら、繰上げ返済・頭金で残債を早く減らすこと、売れる立地を選ぶことが備えになります。`
      : `${NA.p.label}は${posN}/9のケースで手取りがプラス。長く住むほど残債が減り、選択肢が広がります。`;
    const s = slide(4, "LIGHT", "5年後・10年後・20年後の選択肢。", {
      msg: `売った場合の手取りを、年数×3つのシナリオで一覧にする。最悪のケースも先に見せることで、安心と納得につなげる。${takeaway}`,
      ask: ["この表で、いちばん気になるマスはどこですか？", "下落シナリオの数字でも、生活は成り立ちそうですか？"],
      worry: ["結局、上がるのか下がるのか", "持ち出しになったらどうしよう"],
      answer: ["将来価格は誰にも分からない。だから幅で見て、下落でも成り立つ計画かを確認する", "持ち出しの可能性がある期間は、予備資金を厚めに持つ・繰上げ返済で残債を減らすなどで備える"],
      next: "「売るとき以外の不安、たとえば収入が減ったときのことも確認しておきましょう。」",
    });
    const pw = (CW - 0.4) / 2;
    X.props.map((o) => [o, o.p.label + "（サンプル）"]).forEach(([o, label], i) => {
      const x = M + i * (pw + 0.4);
      T(s, label, x, 1.75, pw, 0.4, { fontSize: 16, bold: true, color: H.navy, fontFace: FH });
      const cw0 = 1.35, cwS = (pw - cw0) / 3;
      ["下落", "横ばい", "上昇"].forEach((h, k) => T(s, h, x + cw0 + k * cwS, 2.2, cwS, 0.35, { fontSize: 12, bold: true, color: H.gray, align: "center", valign: "middle" }));
      o.sale.forEach((row, r) => {
        const y = 2.6 + r * 1.05;
        T(s, `${row.t}年後`, x, y, cw0, 0.5, { fontSize: 16, bold: true, color: H.navy, valign: "middle" });
        T(s, `残債 ${man(row.byScen[0].balance)}`, x, y + 0.5, cw0, 0.45, { fontSize: 10, color: H.gray, valign: "top" });
        row.byScen.forEach((c, k) => {
          const cx = x + cw0 + k * cwS + 0.05;
          const pos = c.net >= 0;
          box(s, cx, y, cwS - 0.1, 1.0, pos ? "E3EEE7" : "F4E4DF");
          T(s, sgn(c.net), cx, y + 0.08, cwS - 0.1, 0.5, { fontSize: 17, bold: true, color: pos ? H.gain : H.loss, align: "center", valign: "middle" });
          T(s, `価格 ${man(c.total)}`, cx, y + 0.56, cwS - 0.1, 0.36, { fontSize: 10, color: H.gray, align: "center", valign: "middle" });
        });
      });
    });
    box(s, M, 5.82, CW, 0.52, posN === 0 ? H.ivory : "E3EEE7");
    T(s, takeaway, M + 0.25, 5.82, CW - 0.5, 0.52, { fontSize: 12, bold: true, color: H.navy, valign: "middle" });
    note(s, "※ 手取り＝想定売却価格−売却費用（仲介手数料の上限＋その他10万円と仮定）−ローン残債。譲渡所得税は考慮していません。シナリオは説明のための仮定で、将来価格を予想・保証するものではありません。");
  }

  // P19
  {
    const comfort = ((NA.pmt + (CU.existingMonthly || 0)) * 12) / CU.gross;
    const comfortNoDebt = (NA.pmt * 12) / CU.gross;
    const s = slide(4, "LIGHT", "収入が減った場合は？", {
      msg: `単身者は収入源が1本。収入が2割・4割減ったときの返済負担と家計の余裕を先に見ておく。${NA.p.label}の返済比率（年収比${CU.existingMonthly ? "・既存の借入を含む" : ""}）は${pct(comfort)}で、目安は${pct(ED.comfortRatio, 0)}以内。数字を見ながら、借入額・頭金・物件価格を一緒に調整する。`,
      ask: ["病気やけがで3か月働けなくなったら、生活費はどう工面しますか？", "車のローンなど、今ある借入はいつ完済予定ですか？"],
      worry: ["収入が減っても返済は続く", "団信に入れば安心では"],
      answer: [`返済比率は${pct(ED.comfortRatio, 0)}以内（既存の借入を含む・年収比）を一つの目安にする。${CU.existingMonthly ? `既存の借入がなければ${pct(comfortNoDebt)}。` : ""}`, "団信は死亡・高度障害等で残債が弁済される保険。働けない期間の収入減は商品によって保障の範囲が異なるので確認する", "固定金利と変動金利を比べ、金利が上がっても払える額で借りる"],
      next: "「もう一つの不安、戸建ての維持費を具体的に見ておきましょう。」",
    });
    const cw = 2.55;
    NA.risk.forEach((r, i) => {
      const x = M + i * (cw + 0.25);
      const bad = r.loanRatio > 0.25;
      box(s, x, 1.75, cw, 4.55, i === 0 ? H.mist : H.ivory);
      T(s, i === 0 ? "今の収入" : `収入が${Math.round(r.drop * 100)}%減`, x + 0.25, 1.9, cw - 0.5, 0.35, { fontSize: 15, bold: true, color: H.navy });
      T(s, `手取り 月${manN(r.takeHomeM, 1)}万円`, x + 0.25, 2.25, cw - 0.4, 0.3, { fontSize: 10, color: H.gray });
      T(s, "返済 ÷ 手取り", x + 0.25, 2.7, cw - 0.5, 0.3, { fontSize: 11, color: H.gray });
      T(s, pct(r.loanRatio), x + 0.25, 2.98, cw - 0.5, 0.7, { fontSize: 34, bold: true, color: bad ? H.loss : H.gain });
      const gw = cw - 0.5, gx = x + 0.25, gy = 3.78;
      rect(s, gx, gy, gw, 0.16, "DADDE2");
      rect(s, gx, gy, Math.min(1, r.loanRatio / 0.6) * gw, 0.16, bad ? H.loss : H.gain);
      s.addShape(pres.shapes.LINE, { x: gx + (0.25 / 0.6) * gw, y: gy - 0.08, w: 0, h: 0.32, line: { color: H.navy, width: 1.25 } });
      T(s, "手取りの25%", gx + (0.25 / 0.6) * gw - 0.6, gy + 0.22, 1.2, 0.22, { fontSize: 9, color: H.navy, align: "center" });
      T(s, "毎月の余裕（手取り−支出）", x + 0.25, 4.6, cw - 0.4, 0.3, { fontSize: 10, color: H.gray });
      T(s, (r.gap >= 0 ? "＋" : "−") + yen(Math.abs(r.gap)), x + 0.25, 4.9, cw - 0.5, 0.45, { fontSize: 18, bold: true, color: r.gap >= 0 ? H.navy : H.loss });
      T(s, r.gap >= 0 ? "黒字" : `手元資金${man(NA.cashLeft)}で約${Math.floor(r.months)}か月`, x + 0.25, 5.4, cw - 0.5, 0.6, { fontSize: 11, color: r.gap >= 0 ? H.gray : H.loss });
    });
    const x0 = M + 3 * (cw + 0.25), w0 = CW - 3 * (cw + 0.25);
    box(s, x0, 1.75, w0, 4.55, H.navy);
    T(s, "借りすぎないための目安", x0 + 0.3, 1.9, w0 - 0.6, 0.35, { fontSize: 14, bold: true, color: H.gold });
    T(s, `返済比率（年収比${CU.existingMonthly ? "・既存借入込み" : ""}）`, x0 + 0.3, 2.3, w0 - 0.6, 0.3, { fontSize: 11, color: H.onNavy });
    T(s, [{ text: pct(comfort), options: { fontSize: 26, bold: true, color: comfort > ED.comfortRatio ? "F0B9AC" : H.white } }, { text: `　目安 ${pct(ED.comfortRatio, 0)}以内`, options: { fontSize: 12, color: H.goldL } }], x0 + 0.3, 2.6, w0 - 0.6, 0.55, { valign: "middle" });
    T(s, `審査金利${pct(S.screen.rate, 1)}で計算すると ${pct(NA.screen.ratio)}（基準 ${pct(NA.screen.limit, 0)}）`, x0 + 0.3, 3.2, w0 - 0.6, 0.5, { fontSize: 11, color: H.onNavy });
    T(s, `借入の目安の上限 約${man(NA.screen.maxLoan)}`, x0 + 0.3, 3.7, w0 - 0.6, 0.3, { fontSize: 12, bold: true, color: H.white });
    ["生活費6か月分の予備資金を残す", "固定・変動金利を比べて選ぶ", "就業不能に備える保障を確認", CU.existingMonthly ? "既存の借入は完済時期を確認" : "余裕がある年に繰上げ返済"].forEach((t, k) => {
      T(s, [{ text: "✓  ", options: { color: H.gold, bold: true } }, { text: t }], x0 + 0.3, 4.2 + k * 0.5, w0 - 0.5, 0.45, { fontSize: 13, color: H.white, valign: "middle" });
    });
    note(s, `※ ${NA.p.label}のサンプル。手取りは社会保険料15%・所得税・住民税を差し引いた概算。生活費（住居費以外）月${manN(CU.livingMonth)}万円${CU.existingMonthly ? `・既存の借入返済 月${manN(CU.existingMonthly, 1)}万円` : ""}は仮定値。審査の基準・審査金利は金融機関によって異なります（フラット35は年収400万円未満30%・以上35%）。`);
  }

  // P20
  {
    const s = slide(4, "IVORY", "戸建ての維持費を知る。", {
      msg: "戸建ては管理費・修繕積立金がない代わりに、修繕を自分で計画する。毎年かかるもの（固定資産税・保険）と、いつか来るもの（設備交換・外装）を分けて、毎月の積立で備える。知っていれば、維持費は「想定内」にできる。",
      ask: ["今、家の修繕や設備交換にかかる費用のイメージはありますか？", "毎月の積立は、自動で別口座に分けておく方法でも大丈夫ですか？"],
      worry: ["突然大きな修繕費がかかるのでは", "固定資産税はいくらかかるのか"],
      answer: ["交換・修繕の時期と費用は建物・仕様・使い方で大きく変わる。目安を知り、点検と見積もりで具体化する", "固定資産税は物件ごとに違い、新築住宅には一定期間の軽減措置がある（適用期限・要件は要確認）。試算では年12万円と仮定"],
      next: "「最後に、購入前に確認すべきことを整理しておきましょう。」",
    });
    const items = [["LuReceipt", "固定資産税・都市計画税", NA.p.propTaxYear, "毎年"], ["LuUmbrella", "火災・地震保険", NA.p.insYear, "毎年"], ["LuPiggyBank", "修繕・設備交換の積立", NA.p.repairMonth * 12, `月${manN(NA.p.repairMonth, 1)}万円`]];
    for (let i = 0; i < items.length; i++) {
      const it = items[i], y = 1.8 + i * 1.12;
      box(s, M, y, 5.2, 0.95, H.white);
      await disc(s, it[0], M + 0.2, y + 0.17, 0.6, H.navy);
      T(s, it[1], M + 1.0, y + 0.1, 2.8, 0.4, { fontSize: 14, bold: true, color: H.navy, valign: "middle" });
      T(s, it[3], M + 1.0, y + 0.5, 2.8, 0.35, { fontSize: 11, color: H.gray, valign: "middle" });
      T(s, `年${manN(it[2], 1)}万円`, M + 3.6, y, 1.45, 0.95, { fontSize: 18, bold: true, color: H.navy, align: "right", valign: "middle" });
    }
    const tot = items.reduce((a, b) => a + b[2], 0);
    T(s, [{ text: "合計　", options: { fontSize: 14, color: H.gray } }, { text: `年${manN(tot, 1)}万円`, options: { fontSize: 26, bold: true, color: H.goldD } }, { text: `（月${manN(tot / 12, 2)}万円）`, options: { fontSize: 13, color: H.gray } }], M, 5.25, 5.2, 0.6, { valign: "middle" });
    // 設備交換タイムライン（目安）
    const tx = M + 5.7, tw = CW - 5.7;
    T(s, "いつか来るもの（交換・修繕の目安）", tx, 1.8, tw, 0.35, { fontSize: 14, bold: true, color: H.navy });
    const yl = 2.45, x0 = tx + 0.1, x1 = tx + tw - 0.1, yrs = 35, px = (y) => x0 + ((x1 - x0) * y) / yrs;
    hline(s, x0, yl, x1 - x0, H.navy, 1.5);
    [0, 10, 20, 30].forEach((y) => { s.addShape(pres.shapes.LINE, { x: px(y), y: yl - 0.07, w: 0, h: 0.14, line: { color: H.navy, width: 1 } }); T(s, y + "年", px(y) - 0.3, yl + 0.1, 0.6, 0.25, { fontSize: 10, color: H.gray, align: "center" }); });
    const ev = [["給湯器・換気設備", 10, 15], ["外壁・屋根のメンテナンス", 15, 20], ["キッチン・浴室などの水回り", 20, 25], ["内装・床・建具", 20, 30]];
    ev.forEach((e, i) => {
      const y = 2.9 + i * 0.56;
      rect(s, px(e[1]), y + 0.1, px(e[2]) - px(e[1]), 0.24, i % 2 ? H.gold : H.navy);
      T(s, e[0], x0, y, px(e[1]) - x0 - 0.15, 0.44, { fontSize: 13, color: H.char, align: "right", valign: "middle" });
      T(s, `${e[1]}〜${e[2]}年`, px(e[2]) + 0.08, y, 0.95, 0.44, { fontSize: 10, color: H.gray, valign: "middle" });
    });
    box(s, tx, 5.25, tw, 0.95, H.white);
    T(s, `月${manN(NA.p.repairMonth, 1)}万円の積立で、30年で約${manN(NA.p.repairMonth * 360)}万円を準備できる計算。時期・費用は点検と見積もりで具体化します。`, tx + 0.3, 5.25, tw - 0.6, 0.95, { fontSize: 13, color: H.navy, bold: true, valign: "middle" });
    note(s, "※ 金額は試算用の仮定値、交換時期は一般的な目安で、建物・仕様・使い方によって大きく異なります。新築住宅の固定資産税の軽減措置には適用期限・要件があります。");
  }

  // P21
  {
    const s = slide(4, "LIGHT", "購入前に確認すべきこと。", {
      msg: "不安の多くは、購入前に確認できる。災害・接道・再建築・耐震・住宅性能・ローンの6つを、何で確認するかまでセットで伝える。不利な情報も先に伝えることが、信頼につながる。",
      ask: ["この6つのうち、ご自身で確認したことがあるものはありますか？", "現地は、昼と夜、平日と休日で見たことがありますか？"],
      worry: ["専門的で自分では分からない", "確認しても見落としがありそう"],
      answer: ["重要事項説明で宅地建物取引士が説明する事項が多い。事前に資料を共有し、分からない点はその場で確認する", "ハザードマップは国土交通省「ハザードマップポータルサイト」で誰でも確認できる"],
      next: "「ここまでを踏まえて、あなたにとっての戸建ての価値を言葉にしてみましょう。」",
    });
    const C6 = [
      ["LuWaves", "災害リスク", "洪水・土砂・地震などの想定", "ハザードマップポータル／重要事項説明"],
      ["LuRoute", "接道", "幅4m以上の道路に2m以上接しているか", "建築基準法43条／重要事項説明"],
      ["LuHammer", "再建築", "建て替えできるか（再建築不可・セットバック）", "役所の建築指導課／重要事項説明"],
      ["LuShieldCheck", "耐震", "1981年6月以降の建築確認か（新耐震）", "確認済証／インスペクション"],
      ["LuFileCheck", "住宅性能", "省エネ・認定の証明書（控除の枠に直結）", "性能証明書・評価書（P13）"],
      ["LuCalculator", ED.checkLoan[0], ED.checkLoan[1], ED.checkLoan[2]],
    ];
    const cw = (CW - 0.6) / 3, ch = 2.15;
    for (let i = 0; i < 6; i++) {
      const x = M + (i % 3) * (cw + 0.3), y = 1.75 + Math.floor(i / 3) * (ch + 0.25);
      box(s, x, y, cw, ch, H.mist);
      await disc(s, C6[i][0], x + 0.3, y + 0.3, 0.62, H.navy);
      T(s, C6[i][1], x + 1.1, y + 0.3, cw - 1.3, 0.62, { fontSize: 18, bold: true, color: H.navy, fontFace: FH, valign: "middle" });
      T(s, C6[i][2], x + 0.3, y + 1.05, cw - 0.6, 0.55, { fontSize: 14 });
      T(s, "確認方法：" + C6[i][3], x + 0.3, y + 1.62, cw - 0.6, 0.4, { fontSize: 11, color: H.goldD, bold: true });
    }
    note(s, "※ 接道義務は建築基準法43条（例外あり）。新耐震基準は1981年6月1日以降の建築確認。住宅ローン控除の耐震要件は登記上1982年1月1日以降の建築か、耐震の証明で判断します。");
  }

  // ════════ 第5幕 行動 ════════
  // P22
  {
    const s = slide(5, "IVORY", "あなたにとっての戸建ての価値。", {
      section: true,
      msg: "ここまでの話を、お客様自身の言葉でまとめてもらう。4つの価値のうち、どれが一番大きいかを聞き、P04で書いた希望とつなげる。営業担当がまとめるのではなく、お客様に語ってもらう。",
      ask: ["4つのうち、あなたにとって一番大きい価値はどれですか？", "逆に、あまり重要でないものは？"],
      worry: ["価値は分かったが、自分に合うか分からない", "まだ決めきれない"],
      answer: ["決めきれなくて当然。次のページで、具体的な物件が希望に合うかを確認してから判断すればよい", "比較を続ける・見送るも、大切な選択肢"],
      next: "「では、実際の物件が、あなたの希望にどのくらい合っているかを見てみましょう。」",
    });
    const V = [
      ["LuSofa", "生活価値", "毎日を、どう過ごしたい？", "静かさ・広さ・自分のリズムで暮らせること"],
      ["LuMapPin", "土地所有価値", "どの場所に、根を張りたい？", "二つとない場所を、自分の判断で使えること"],
      ["LuPackage", "空間価値", "どんな部屋が、欲しい？", "趣味・仕事・収納・車・ペットのための空間"],
      ["LuSignpost", "将来の選択肢", "10年後、どうしていたい？", "住み続ける・売る・住み替える・貸す"],
    ];
    const cw = (CW - 0.3) / 2, ch = 2.15;
    for (let i = 0; i < 4; i++) {
      const x = M + (i % 2) * (cw + 0.3), y = 1.75 + Math.floor(i / 2) * (ch + 0.25);
      box(s, x, y, cw, ch, H.white);
      await disc(s, V[i][0], x + 0.35, y + 0.35, 0.75, i === 0 || i === 3 ? H.navy : H.gold);
      T(s, V[i][1], x + 1.35, y + 0.3, cw - 1.6, 0.42, { fontSize: 20, bold: true, color: H.navy, fontFace: FH });
      T(s, V[i][2], x + 1.35, y + 0.76, cw - 1.6, 0.38, { fontSize: 15, bold: true, color: H.goldD });
      T(s, V[i][3], x + 1.35, y + 1.2, cw - 1.6, 0.7, { fontSize: 14 });
    }
  }

  // P23
  {
    const F = NA.fit;
    const sym = { ok: ["◯", H.gain], part: ["△", H.goldD], ng: ["✕", H.loss], unknown: ["？", H.soft] };
    const comfort = ((NA.pmt + (CU.existingMonthly || 0)) * 12) / CU.gross;
    const merits = F.filter((f) => f.status === "ok" && f.must).map((f) => `${f.label}：${f.detail}`).slice(0, 2);
    if (NA.credit.judge.ok) merits.push(`住宅ローン控除の対象（${man(NA.credit.judge.limit)}・${NA.credit.judge.years}年）`);
    const diff = NA.own.total - X.rent.total;
    const demerits = [];
    if (diff > 0) demerits.push(`総住居費 月${manN(NA.own.total, 1)}万円（今より＋${manN(diff, 1)}万円）`);
    if (comfort > ED.comfortRatio) demerits.push(`返済比率 ${pct(comfort)}（目安${pct(ED.comfortRatio, 0)}超）`);
    F.filter((f) => (f.status === "part" || f.status === "ng") && !(f.key === "budget" && diff > 0)).forEach((f) => demerits.push(`${f.label}：${f.detail}`));
    const unknowns = F.filter((f) => f.status === "unknown").map((f) => `${f.label}：${f.detail}`).concat(["周辺環境（昼・夜／平日・休日）"]);
    const s = slide(5, "LIGHT", "この物件は、あなたの希望に合っているか。", {
      msg: "物件を「良い・悪い」ではなく「あなたの希望に合うか」で見る。合う点・合わない点・まだ確認していない点を正直に並べる。未確認事項は、見学と調査で確かめる理由になる。",
      ask: ["この中で、必ず確かめたい未確認事項はどれですか？", "「△」の項目は、許容できそうですか？"],
      worry: ["デメリットがあるなら、やめたほうがいいのでは", "未確認事項が多いと不安"],
      answer: ["完璧な物件はまれ。必須条件を満たしているか、デメリットを許容できるかで判断する", "未確認事項は、見学・ハザードマップ・重要事項説明で一つずつ確かめられる"],
      next: "「確かめたいことが見えてきました。最後に、次の一歩をご提案します。」",
    });
    T(s, `${NA.p.label}（サンプル・架空）×　あなたの希望`, M, 1.7, 7.2, 0.35, { fontSize: 13, bold: true, color: H.goldD });
    F.forEach((f, i) => {
      const y = 2.1 + i * 0.4;
      if (i % 2 === 0) rect(s, M, y, 7.2, 0.4, H.mist);
      T(s, sym[f.status][0], M + 0.1, y, 0.45, 0.4, { fontSize: 16, bold: true, color: sym[f.status][1], align: "center", valign: "middle" });
      T(s, f.label + (f.must ? "（必須）" : ""), M + 0.6, y, 2.9, 0.4, { fontSize: 13, bold: true, color: H.navy, valign: "middle" });
      T(s, f.detail, M + 3.5, y, 3.65, 0.4, { fontSize: 12, valign: "middle" });
    });
    T(s, "◯ 合う　△ 一部　✕ 合わない　？ 未確認", M, 6.14, 7.2, 0.25, { fontSize: 10, color: H.gray });
    const x0 = M + 7.5, w0 = CW - 7.5;
    const boxes = [["メリット", H.navy, H.white, merits.slice(0, 3)], ["デメリット", H.mist, H.char, demerits.slice(0, 3)], ["未確認事項", H.ivory, H.char, unknowns.slice(0, 3)]];
    let y = 1.7;
    boxes.forEach((b) => {
      const h = 0.5 + Math.max(1, b[3].length) * 0.36;
      box(s, x0, y, w0, h, b[1]);
      T(s, b[0], x0 + 0.25, y + 0.1, w0 - 0.5, 0.3, { fontSize: 13, bold: true, color: b[1] === H.navy ? H.gold : H.goldD });
      (b[3].length ? b[3] : ["なし"]).forEach((t, k) => T(s, "・" + t, x0 + 0.25, y + 0.42 + k * 0.36, w0 - 0.4, 0.34, { fontSize: 11, color: b[2], valign: "middle" }));
      y += h + 0.15;
    });
    note(s, "※ サンプル物件（架空）での例です。実際の物件ではシミュレーターに希望と物件情報を入力すると、適合チェックと提案書を自動で作成します。");
  }

  // P24
  {
    const s = slide(5, "NAVY", "まずは、その暮らしを体感する。", {
      msg: "契約を迫らない。次の一歩を4つの具体的な行動として示し、お客様に選んでもらう。見送りも大切な判断として尊重する。",
      ask: ["4つのうち、どれから始めたいですか？", "見学するなら、いつ頃がご都合よいですか？"],
      worry: ["見学したら断りにくくなるのでは", "今買わないと損では"],
      answer: ["見学は確かめるための場。見て合わなければ、それも大事な情報", "『今買わないと損』と断言できる根拠はない。予備資金・住居費・住む期間がそろったときが、その人にとっての買い時"],
      next: "（終了）資料とパーソナル提案書をお渡しし、次回の日程を一緒に決める。",
    });
    T(s, `${ACTS[5]}　｜　P24`, M, 0.55, 6, 0.3, { fontSize: 11, bold: true, color: H.gold });
    T(s, "まずは、その暮らしを体感する。", M, 0.95, CW, 0.9, { fontFace: FH, fontSize: 36, bold: true, color: H.white });
    T(s, "決めるのは、見て、確かめてから。", M, 1.9, CW, 0.4, { fontSize: 16, color: H.goldL });
    const st = ED.steps;
    const cw = (CW - 0.9) / 4;
    for (let i = 0; i < 4; i++) {
      const x = M + i * (cw + 0.3);
      box(s, x, 2.65, cw, 2.75, H.navyL);
      T(s, `STEP 0${i + 1}`, x + 0.3, 2.85, cw - 0.6, 0.3, { fontSize: 11, bold: true, color: H.gold, charSpacing: 2 });
      await ico(s, st[i][0], x + 0.3, 3.25, 0.55, H.gold);
      T(s, st[i][1], x + 0.3, 3.95, cw - 0.6, 0.42, { fontSize: 16, bold: true, color: H.white, fontFace: FH });
      T(s, st[i][2], x + 0.3, 4.42, cw - 0.6, 0.9, { fontSize: 13, color: H.onNavy });
    }
    hline(s, M, 5.6, CW, H.navyL);
    T(s, BRAND.name, M, 5.7, 6, 0.4, { fontSize: 18, bold: true, color: H.white });
    T(s, `${BRAND.site}　TEL ${BRAND.tel}　${BRAND.staff}`, M, 6.1, 8, 0.3, { fontSize: 12, color: H.onNavy });
    T(s, ED.support, M, 6.4, CW, 0.28, { fontSize: 11, color: H.goldL });
    T(s, `本資料の数値は架空のサンプル条件と仮定値による試算で、将来の価格・金利・税制を保証するものではありません。税制は${R.BASIS_DATE}時点の情報です。最新の制度は国税庁・国土交通省等でご確認ください。宅地建物取引業の表示：${BRAND.license}`, M, 6.75, CW, 0.5, { fontSize: 9, color: H.onNavy });
  }

}

// ───────────────────────── 組み立て ─────────────────────────
async function buildDeck(edition, opts = {}) {
  ED = edition; BRAND = ED.brand; S = ED.sample; CU = S.customer;
  X = LL.compute(S);
  NA = X.props[ED.focus]; UB = X.props[1 - ED.focus];
  PAGES = []; PHOTOS = []; cur = null; page = 0;
  initPres();
  await slides();
  const out = { pages: PAGES, photos: PHOTOS };
  if (opts.write !== false) {
    const dir = path.join(OUT, ED.id);
    fs.mkdirSync(dir, { recursive: true });
    out.file = path.join(dir, `人生を、自分の土地から。_${ED.label}.pptx`);
    await pres.writeFile({ fileName: out.file });
    fs.writeFileSync(path.join(dir, `営業トーク集_${ED.label}.md`), talk());
  }
  return out;
}

// ───────────────────────── 営業トーク集（md） ─────────────────────────
function talk() {
  const L = [`# 営業トーク集 — 人生を、自分の土地から。（${ED.label}）`, "", `> ${BRAND.name}｜全24ページの営業ノート（\`deck/build.js\` から自動生成。スライドの発表者ノートと同じ内容）`, "",
    "## 使い方", "", "- 各ページ：①伝えるメッセージ ②顧客への質問 ③想定される不安 ④根拠に基づく回答 ⑤次のページへのつなぎ",
    "- 禁止：心理的な圧迫、虚偽の緊急性、将来の損失を断定した恐怖訴求、「必ず値上がりする」「絶対に損しない」などの断定（宅建業法）",
    "- 質問は「お客様自身の希望から魅力を発見できる」ものを優先する", ""];
  let act = 0;
  for (const p of PAGES) {
    const n = p.notes;
    if (p.act !== act) { act = p.act; L.push(`## ${SEC[act]}`, ""); }
    L.push(`### P${String(p.page).padStart(2, "0")}｜${p.title}`, "", `**① 伝えるメッセージ**　${n.msg}`, "", "**② 顧客への質問**");
    n.ask.forEach((q) => L.push(`- ${q}`));
    L.push("", "**③ 想定される不安**");
    n.worry.forEach((q) => L.push(`- ${q}`));
    L.push("", "**④ 根拠に基づく回答**");
    n.answer.forEach((q) => L.push(`- ${q}`));
    L.push("", `**⑤ 次のページへのつなぎ**　${n.next}`, "");
  }
  return L.join("\n");
}

module.exports = { buildDeck };

if (require.main === module) {
  const ids = process.argv[2] ? [process.argv[2]] : Object.keys(EDITIONS);
  (async () => {
    for (const id of ids) {
      if (!EDITIONS[id]) throw new Error(`版が見つかりません: ${id}（${Object.keys(EDITIONS).join(" / ")}）`);
      const r = await buildDeck(EDITIONS[id]);
      console.log("wrote", path.relative(ROOT, r.file), "pages:", r.pages.length);
    }
  })().catch((e) => { console.error(e); process.exit(1); });
}
