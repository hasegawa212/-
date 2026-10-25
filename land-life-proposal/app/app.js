// 人生を、自分の土地から。— 対話型シミュレーター（画面）
// 計算はすべて ../lib/engine.js（JM.compute）。このファイルは入力と表示だけを担当する。
(function () {
  "use strict";
  const { fmt, RULES: R, BRAND } = JM;
  const { yen, man, manN, pct } = fmt;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const sgn = (v, d = 0) => (v >= 0 ? "＋" : "−") + manN(Math.abs(v), d) + "万円";
  const KEY = "jm_house_sim_v1", KEY_ON = "jm_house_sim_persist";
  const C = { navy: "#17233B", gold: "#B89B6A", goldL: "#D9C9A6", soft: "#8C99AD", gray: "#C9CED6", gain: "#3D7258", loss: "#9E4B3B", mid: "#5E6B82" };

  // ───────── 状態 ─────────
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const fresh = () => ({ ...clone(JM.SAMPLE), dream: { place: "", time: "", space: "", value: "" }, ui: { step: 0, credit: true, prop: 0 } });
  let S = load() || fresh();
  let X = JM.compute(S);
  function load() {
    try { if (localStorage.getItem(KEY_ON) === "1") { const v = JSON.parse(localStorage.getItem(KEY)); if (v && v.customer && v.props) return { ...fresh(), ...v }; } } catch (e) { /* 保存なしで続行 */ }
    return null;
  }
  function save() { try { if (localStorage.getItem(KEY_ON) === "1") localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 無視 */ } }
  const get = (path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), S);
  function set(path, v) {
    const ks = path.split("."), last = ks.pop();
    const o = ks.reduce((a, k) => a[k], S);
    o[last] = v;
  }

  // ───────── 入力部品 ─────────
  // kind: man（万円で入力）/ pct（%で入力）/ num / text / date / select / check / area
  function F(path, label, kind = "num", o = {}) {
    const v = get(path);
    const attrs = `data-path="${path}" data-kind="${kind}"${o.re ? " data-re" : ""}`;
    if (kind === "check") return `<label class="chk"><input type="checkbox" ${attrs}${v ? " checked" : ""}> ${label}</label>`;
    let input;
    if (kind === "select") input = `<select ${attrs}>${o.options.map(([k, t]) => `<option value="${esc(k)}"${String(k) === String(v ?? "") ? " selected" : ""}>${esc(t)}</option>`).join("")}</select>`;
    else if (kind === "area") return `<div class="f"><label>${label}</label><textarea ${attrs} placeholder="${esc(o.ph || "")}">${esc(v)}</textarea></div>`;
    else {
      const dv = v == null || v === "" ? "" : kind === "man" ? +(v / 10_000).toFixed(2) : kind === "pct" ? +(v * 100).toFixed(3) : v;
      const type = kind === "text" ? "text" : kind === "date" ? "date" : "number";
      input = `<input type="${type}" inputmode="${type === "number" ? "decimal" : "text"}" ${attrs} value="${esc(dv)}" step="${o.step ?? "any"}"${o.min != null ? ` min="${o.min}"` : ""}${o.max != null ? ` max="${o.max}"` : ""}${o.ph ? ` placeholder="${esc(o.ph)}"` : ""}>`;
    }
    const unit = o.unit ?? (kind === "man" ? "万円" : kind === "pct" ? "%" : "");
    return `<div class="f"><label>${label}</label><div class="in">${input}${unit ? `<span class="unit">${unit}</span>` : ""}</div>${o.hint ? `<div class="hint">${o.hint}</div>` : ""}</div>`;
  }
  function readInput(el) {
    const k = el.dataset.kind;
    if (k === "check") return el.checked;
    if (k === "text" || k === "area" || k === "date") return el.value;
    if (k === "select") { const v = el.value; return v === "" ? null : /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v === "true" ? true : v === "false" ? false : v; }
    if (el.value === "") return k === "num" && el.dataset.path.endsWith("spouseAge") ? null : 0;
    const n = Number(el.value);
    if (!Number.isFinite(n)) return 0;
    return k === "man" ? Math.round(n * 10_000) : k === "pct" ? n / 100 : n;
  }

  // ───────── グラフ（SVG・ライブラリなし） ─────────
  function lineChart({ labels, series, yMax, h = 280, unit = "万円", every = 5 }) {
    const W = 760, L = 52, B = 28, T = 14, Rr = 12, iw = W - L - Rr, ih = h - T - B;
    const top = yMax || Math.max(...series.flatMap((s) => s.values)) * 1.1;
    const x = (i) => L + (iw * i) / (labels.length - 1), y = (v) => T + ih - (ih * v) / top;
    let g = "";
    for (let k = 0; k <= 4; k++) { const v = (top * k) / 4, yy = y(v); g += `<line x1="${L}" x2="${W - Rr}" y1="${yy}" y2="${yy}" stroke="#E6E8EC"/><text x="${L - 6}" y="${yy + 4}" font-size="11" text-anchor="end" fill="#6B7078">${Math.round(v / 10_000).toLocaleString()}</text>`; }
    labels.forEach((l, i) => { if (i % every === 0) g += `<text x="${x(i)}" y="${h - 8}" font-size="11" text-anchor="middle" fill="#6B7078">${l}</text>`; });
    series.forEach((s) => {
      g += `<polyline fill="none" stroke="${s.color}" stroke-width="${s.width || 2.5}" ${s.dash ? 'stroke-dasharray="6 5"' : ""} points="${s.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}"><title>${esc(s.name)}</title></polyline>`;
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${h}" role="img" aria-label="${esc(series.map((s) => s.name).join("・"))}（単位：${unit}）">${g}</svg>
      <div class="legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join("")}<span style="color:#6B7078">単位：${unit}</span></div>`;
  }
  function stackCols({ cats, series, h = 260, yMax }) {
    const W = 760, L = 44, B = 26, T = 12, Rr = 8, iw = W - L - Rr, ih = h - T - B;
    const tot = cats.map((_, i) => series.reduce((a, s) => a + s.values[i], 0));
    const top = yMax || Math.max(...tot, 1) * 1.15;
    const bw = iw / cats.length;
    let g = "";
    for (let k = 0; k <= 4; k++) { const v = (top * k) / 4, yy = T + ih - (ih * v) / top; g += `<line x1="${L}" x2="${W - Rr}" y1="${yy}" y2="${yy}" stroke="#E6E8EC"/><text x="${L - 6}" y="${yy + 4}" font-size="11" text-anchor="end" fill="#6B7078">${(v / 10_000).toFixed(0)}</text>`; }
    cats.forEach((c, i) => {
      let yy = T + ih;
      const x = L + i * bw + bw * 0.18, w = bw * 0.64;
      series.forEach((s) => {
        const hh = (ih * s.values[i]) / top;
        if (hh > 0.3) g += `<rect x="${x}" y="${yy - hh}" width="${w}" height="${hh}" fill="${s.color}"><title>${esc(c)} ${esc(s.name)} ${yen(s.values[i])}</title></rect>`;
        yy -= hh;
      });
      g += `<text x="${x + w / 2}" y="${h - 8}" font-size="11" text-anchor="middle" fill="#6B7078">${esc(c)}</text>`;
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${h}" role="img" aria-label="年ごとの内訳（単位：万円）">${g}</svg>
      <div class="legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join("")}<span style="color:#6B7078">単位：万円</span></div>`;
  }
  function hbars(rows, max, legend) {
    return `<div>${rows.map((r) => `<div style="display:grid;grid-template-columns:minmax(120px,190px) 1fr 110px;gap:10px;align-items:center;margin:10px 0">
        <div style="font-size:14px;${r.strong ? "font-weight:700;color:#17233B" : ""}">${esc(r.label)}</div>
        <div style="display:flex;height:26px;border-radius:4px;overflow:hidden;background:#F2F3F5">${r.segs.filter((s) => s.v > 0).map((s) => `<div title="${esc(s.name)} ${yen(s.v)}" style="width:${(100 * s.v) / max}%;background:${s.color}"></div>`).join("")}</div>
        <div style="font-weight:700;font-size:16px;color:#17233B">${r.total}</div></div>`).join("")}
      ${legend ? `<div class="legend">${legend.map(([n, c]) => `<span><i style="background:${c}"></i>${esc(n)}</span>`).join("")}</div>` : ""}</div>`;
  }
  const stat = (k, v, s = "", cls = "") => `<div class="stat"><div class="k">${k}</div><div class="v ${cls}">${v}</div>${s ? `<div class="s">${s}</div>` : ""}</div>`;
  const talk = (t) => `<div class="talk"><b>トーク例</b>　${t}</div>`;

  // ───────── 物件フォーム ─────────
  const KIND = Object.entries(R.KIND), PERF = Object.entries(R.PERF);
  function propForm(i) {
    const p = `props.${i}`, dark = i === 1;
    return `<div class="card ${dark ? "navy" : "white"}">
      <h3>物件${i ? "B" : "A"}　${F(`${p}.label`, "", "text")}</h3>
      <div class="section-title">基本</div>
      <div class="fields">
        ${F(`${p}.kind`, "新築・中古", "select", { options: KIND, re: 1 })}
        ${F(`${p}.perf`, "住宅性能区分", "select", { options: PERF, re: 1 })}
        ${F(`${p}.price`, "取得価格", "man", { step: 10 })}
        ${F(`${p}.landPrice`, "うち土地", "man", { step: 10, hint: "残りが建物（価値の分析に使用）" })}
        ${F(`${p}.landArea`, "土地面積", "num", { unit: "㎡" })}
        ${F(`${p}.floor`, "床面積", "num", { unit: "㎡" })}
        ${F(`${p}.down`, "頭金", "man", { step: 10 })}
        ${F(`${p}.buyCostRate`, "購入諸費用（価格比）", "pct", { step: 0.5, hint: "仲介手数料・登記・ローン費用など" })}
      </div>
      <div class="section-title">住宅ローン控除の要件</div>
      <div class="fields">
        ${F(`${p}.confirmDate`, "建築確認日", "date")}
        ${F(`${p}.builtDate`, "登記上の建築日", "date")}
        ${F(`${p}.firstBalance`, "初年度の年末残高（分かれば）", "man", { ph: "空欄＝自動計算" })}
      </div>
      ${F(`${p}.certs`, "性能を証明する書類がある（省エネ性能証明書・評価書・認定通知書など）", "check", { re: 1 })}
      ${F(`${p}.seismicCert`, "耐震基準適合の証明がある（1981年以前の中古で必要）", "check", { re: 1 })}
      ${F(`${p}.moveInOK`, "取得から6か月以内に入居する", "check", { re: 1 })}
      ${F(`${p}.redZone`, "災害レッドゾーン内にある", "check", { re: 1 })}
      ${F(`${p}.fromRelative`, "親族など特別な関係のある人から買う", "check", { re: 1 })}
      <div class="section-title">維持費（仮定値を入力）</div>
      <div class="fields">
        ${F(`${p}.propTaxYear`, "固定資産税等（年）", "man", { step: 0.5 })}
        ${F(`${p}.insYear`, "火災・地震保険（年）", "man", { step: 0.5 })}
        ${F(`${p}.repairMonth`, "修繕積立（月）", "man", { step: 0.1 })}
        ${F(`${p}.b10`, "建物の価値（10年後・横ばい）", "pct", { step: 5, hint: "購入時の建物価格に対する割合" })}
      </div>
      <div class="section-title">暮らしの条件（適合チェック用）</div>
      <div class="fields">
        ${F(`${p}.attrs.commute`, "通勤時間", "num", { unit: "分" })}
        ${F(`${p}.attrs.parking`, "駐車場", "num", { unit: "台" })}
        ${F(`${p}.attrs.study`, "書斎にできる部屋", "select", { options: [["true", "あり"], ["false", "なし"], ["", "未確認"]] })}
        ${F(`${p}.attrs.garden`, "庭・外の空間", "select", { options: [["true", "あり"], ["false", "なし"], ["", "未確認"]] })}
        ${F(`${p}.attrs.pet`, "ペット", "select", { options: [["true", "飼える"], ["false", "難しい"], ["", "未確認"]] })}
        ${F(`${p}.attrs.hazard`, "ハザードマップ", "select", { options: [["", "未確認"], ["low", "リスク低い"], ["mid", "一部注意"], ["high", "リスク高い"]] })}
      </div>
    </div>`;
  }

  // ───────── ステップ ─────────
  const AX = JM.AXES;
  const STEPS = [
    { act: "1 憧れ", title: "お客様のこと", lead: "まずはお客様のことと、10年後に送りたい暮らしを伺います。", form: () => `
      <div class="grid g2">
        <div class="card white"><h3>プロフィール</h3><div class="fields">
          ${F("customer.name", "お名前（提案書に表示・任意）", "text", { ph: "例：山田 太郎" })}
          ${F("customer.age", "年齢", "num", { unit: "歳" })}
          ${F("customer.household", "世帯", "select", { options: [["single", "単身"], ["married", "既婚（配偶者あり）"]], re: 1 })}
          ${S.customer.household === "married" ? F("customer.spouseAge", "配偶者の年齢", "num", { unit: "歳" }) : ""}
          ${F("customer.under19Dep", "19歳未満の扶養親族", "select", { options: [["false", "なし"], ["true", "あり"]], re: 1 })}
          ${F("customer.gross", "年収（給与）", "man", { step: 10 })}
          ${F("customer.rent", "今の家賃（月）", "man", { step: 0.1 })}
          ${F("customer.rentParking", "今の駐車場代（月）", "man", { step: 0.1 })}
          ${F("customer.savings", "預貯金", "man", { step: 10 })}
          ${F("customer.livingMonth", "生活費（住居費以外・月）", "man", { step: 0.5 })}
          ${F("customer.moveInYear", "入居予定年", "select", { options: [2026, 2027, 2028, 2029, 2030].map((y) => [y, y + "年"]), re: 1 })}
          ${F("customer.moveInMonth", "入居予定月", "num", { unit: "月", min: 1, max: 12 })}
        </div>
        <div class="section-title">税額（住宅ローン控除の計算に使用）</div>
        <div class="seg" role="group" aria-label="税額の入力方法">
          <button type="button" data-taxmode="estimate" class="${S.customer.taxMode !== "detail" ? "on" : ""}">概算（年収から推計）</button>
          <button type="button" data-taxmode="detail" class="${S.customer.taxMode === "detail" ? "on" : ""}">詳細（源泉徴収票の税額）</button>
        </div>
        ${S.customer.taxMode === "detail" ? `<div class="fields" style="margin-top:10px">
          ${F("customer.tax.totalIncome", "合計所得金額", "man", { step: 1 })}
          ${F("customer.tax.incomeTax", "所得税額（控除前）", "man", { step: 0.1, hint: "源泉徴収票の「源泉徴収税額」は復興税込み。控除前の基準所得税額を入力" })}
          ${F("customer.tax.taxable", "課税総所得金額等", "man", { step: 1 })}
          ${F("customer.tax.residentTax", "住民税所得割額", "man", { step: 0.1, hint: "住民税の決定通知書に記載" })}
        </div>` : `<div class="fields" style="margin-top:10px">${F("customer.socialRate", "社会保険料（年収比・概算用）", "pct", { step: 0.5 })}</div>`}
        </div>
        <div class="card ivory"><h3>10年後、どんな場所で暮らしていたいですか。</h3>
          <p class="hint" style="margin-top:-6px">答えに正解はありません。提案書の1ページ目に入ります。</p>
          ${F("dream.place", "住んでいたい街・場所", "area", { ph: "例：職場に30分以内、自然が近い街" })}
          ${F("dream.time", "家で過ごしたい時間", "area", { ph: "例：休日はガレージで車いじり" })}
          ${F("dream.space", "家に欲しい空間", "area", { ph: "例：在宅勤務の書斎、趣味の部屋" })}
          ${F("dream.value", "大切にしたいもの", "area", { ph: "例：静かさ、自分のペース" })}
        </div>
      </div>`,
      result: () => `<div class="card"><h3>税額と手取りの${S.customer.taxMode === "detail" ? "入力値" : "概算"}</h3><div class="stats">
        ${stat("合計所得金額", man(X.tax.totalIncome, 1))}${stat("所得税（控除前）", yen(X.tax.incomeTax))}
        ${stat("住民税所得割", yen(X.tax.residentTax))}${stat("手取り（年）", man(X.tax.takeHome, 1), "月 " + man(X.tax.takeHome / 12, 1))}</div>
        <p class="hint">概算は給与所得のみ・社会保険料＝年収×料率として推計します（2028年以降も令和8・9年分の控除の特例が続くと仮定した、税額を低めに見積もる保守的な前提）。源泉徴収票があれば「詳細」に切り替えてください。</p>
        ${talk("「答えは今の気持ちで大丈夫です。書いていただいた暮らしを、どう形にするかを一緒に考えます。」")}</div>` },

    { act: "2 発見", title: "物件の情報", lead: "比べたい物件を2つまで入力します（初期値は新築と中古のサンプル・架空）。", form: () => `
      <div class="card white" style="margin-bottom:16px"><h3>住宅ローンの条件（2物件共通）</h3><div class="fields">
        ${F("loan.rate", "金利（年・試算用）", "pct", { step: 0.05 })}${F("loan.years", "返済期間", "num", { unit: "年", min: 10, max: 50 })}</div>
        <p class="hint">金利は実在の商品条件ではなく試算用の仮定です。実際の金利・審査は金融機関によって異なります。</p></div>
      <div class="grid g2">${propForm(0)}${propForm(1)}</div>`,
      result: () => `<div class="grid g2">${X.props.map((o) => `<div class="card"><h3>${esc(o.p.label)}</h3><div class="stats">
        ${stat("借入額", man(o.loan.amount))}${stat("毎月の返済", yen(o.pmt))}${stat("毎月の住居費", man(o.own.total, 1), "返済＋税・保険・修繕")}
        ${stat("住宅ローン控除", o.credit.judge.ok ? `${man(o.credit.judge.limit)}・${o.credit.judge.years}年` : "対象外", o.credit.judge.ok ? "" : esc(o.credit.judge.reason), o.credit.judge.ok ? "" : "neg")}</div></div>`).join("")}</div>` },

    { act: "2 発見", title: "暮らしの優先順位", lead: "何を大切にするかで、合う住まい方は変わります。1（あまり重要でない）〜5（とても重要）で選んでください。", form: () => `
      <div class="grid g2"><div class="card white"><h3>優先順位</h3>
        ${AX.map((a) => `<div class="f" style="margin:10px 0"><label>${a.label}：<b id="pv-${a.key}">${S.priorities[a.key]}</b></label>
          <input class="range" type="range" min="1" max="5" step="1" data-path="priorities.${a.key}" data-kind="num" value="${S.priorities[a.key]}"></div>`).join("")}</div>
      <div class="card white"><h3>物件に求める条件</h3>
        <table><thead><tr><th>条件</th><th>使う</th><th>必須</th><th>希望値</th></tr></thead><tbody>
        ${S.wishes.map((w, i) => { const d = JM.WISHES.find((x) => x.key === w.key); const unit = { budget: "万円", commute: "分", floor: "㎡", parking: "台" }[w.key];
          return `<tr><td>${d.label}</td><td><input type="checkbox" data-path="wishes.${i}.on" data-kind="check" ${w.on !== false ? "checked" : ""}></td>
          <td><input type="checkbox" data-path="wishes.${i}.must" data-kind="check" ${w.must ? "checked" : ""}></td>
          <td>${unit ? `<div class="f"><div class="in" style="max-width:150px;margin-left:auto">${w.key === "budget" ? `<input type="number" data-path="wishes.${i}.value" data-kind="man" value="${w.value / 10_000}" step="0.5">` : `<input type="number" data-path="wishes.${i}.value" data-kind="num" value="${w.value}">`}<span class="unit">${unit}</span></div></div>` : "―"}</td></tr>`; }).join("")}
        </tbody></table></div></div>`,
      result: () => {
        const r = X.compare, nm = { rent: "賃貸", condo: "分譲マンション", house: "土地付き戸建て" };
        return `<div class="card"><h3>あなたの優先順位で見ると</h3>
          ${r.rank.map((k, i) => `<div class="rank"><div style="font-weight:700;color:#17233B">${i + 1}. ${nm[k]}</div><div class="bar"><i style="width:${(100 * r.score[k]) / r.max}%;background:${k === "house" ? C.gold : C.navy}"></i></div><div style="font-weight:700">${Math.round((100 * r.score[k]) / r.max)}点</div></div>`).join("")}
          <p class="hint">7つの物差しの一般的な傾向（◎3・○2・△1）に、選んだ重みを掛けた点数です。結論ではなく、話し合いのたたき台です。</p>
          ${talk("「点数が高い＝正解ではありません。上位2つの違いがどこから来ているか、一緒に見てみましょう。」")}</div>`;
      } },

    { act: "3 納得", title: "住宅ローン", lead: "元利均等返済で、毎月の返済・総返済額・手元に残るお金を確認します。", form: () => "", result: () => `
      <div class="grid g2">${X.props.map((o, i) => `<div class="card ${i ? "navy" : "white"}"><h3>${esc(o.p.label)}</h3>
        <div class="big">${yen(o.pmt)}<span style="font-size:15px;font-weight:400"> / 月</span></div>
        <div class="stats" style="margin-top:12px">
          ${stat("借入額", man(o.loan.amount))}${stat("総返済額", man(o.pmt * o.loan.years * 12))}
          ${stat("うち利息", man(o.pmt * o.loan.years * 12 - o.loan.amount))}${stat("返済 ÷ 年収", pct((o.pmt * 12) / S.customer.gross))}
          ${stat("返済 ÷ 手取り", pct(o.risk[0].loanRatio), "目安は25%以内", o.risk[0].loanRatio > 0.25 ? "neg" : "pos")}
          ${stat("初期費用", man(o.cashOut), `頭金${man(o.p.down)}＋諸費用${man(o.buyCost)}`)}
          ${stat("購入後の手元資金", man(o.cashLeft), `予備資金の目安 ${man(o.reserveTarget)}`, o.cashLeft < o.reserveTarget ? "neg" : "pos")}
          ${stat("完済年齢", (S.customer.age + S.loan.years) + "歳")}</div></div>`).join("")}</div>
      <div class="card" style="margin-top:16px"><h3>ローン残高の推移</h3>
        ${lineChart({ labels: X.props[0].balances.map((_, t) => t + "年"), series: X.props.map((o, i) => ({ name: o.p.label, color: i ? C.gold : C.navy, values: o.balances })) })}
        <p class="hint">毎月返済額 ＝ 借入額 × r ×（1＋r）ⁿ ÷ {（1＋r）ⁿ − 1}　r＝年利÷12、n＝返済回数。入居月に借入、翌月から返済と仮定。</p>
        ${talk("「月々の返済だけでなく、手元にいくら残るかを必ず一緒に見ます。単身の方は生活費の半年分を目安に残すのがおすすめです。」")}</div>` },

    { act: "3 納得", title: "住宅ローン控除", lead: `新築・中古・住宅性能・入居年から、控除の可否と年ごとの見込額を計算します（制度の基準日：${R.BASIS_DATE}時点）。`, form: () => "", result: () => `
      <div class="grid g2">${X.props.map((o, i) => { const c = o.credit, j = c.judge;
        return `<div class="card ${i ? "navy" : "white"}"><h3>${esc(o.p.label)}　<span class="pill">${c.estimated ? "概算" : "入力した税額"}</span></h3>
          <div class="verdict ${j.ok ? "ok" : "ng"}"><b>${j.ok ? "適用見込み" : "適用なし"}</b>　${esc(j.reason)}${j.warnings.length ? `<ul>${j.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>` : ""}</div>
          ${j.ok ? `<div class="stats">
            ${stat("借入限度額", man(j.limit), j.special ? "子育て・若者夫婦の上乗せ" : "一般")}${stat("控除率・期間", `${(j.rate * 100).toFixed(1)}%・${j.years}年`)}
            ${stat("初年度の控除見込額", yen(c.first), `上限 ${yen(c.firstMax)}`)}${stat("累計の控除見込額", man(c.total, 1), `制度上の上限 ${man(c.totalMax, 1)}`)}
            ${stat("所得税から／住民税から", `${manN(c.totalIT, 1)}／${manN(c.totalRT, 1)}万円`)}${stat("控除しきれない額", man(c.totalUnused, 1), "受け取れません")}
          </div>
          <div style="margin-top:12px">${stackCols({ cats: c.rows.filter((r) => r.inPeriod).map((r) => r.i), series: [
            { name: "所得税から", color: C.navy, values: c.rows.filter((r) => r.inPeriod).map((r) => r.fromIT) },
            { name: "住民税から", color: C.gold, values: c.rows.filter((r) => r.inPeriod).map((r) => r.fromRT) },
            { name: "控除しきれない額", color: C.gray, values: c.rows.filter((r) => r.inPeriod).map((r) => r.unused) }], h: 220 })}</div>` : ""}
          <details style="margin-top:10px"><summary>購入前に確認する書類</summary><ul style="font-size:13px">${j.docs.map((d) => `<li>${esc(d)}</li>`).join("")}<li>1年目は確定申告（2年目以降は年末調整）</li></ul></details>
        </div>`; }).join("")}</div>
      <div class="card" style="margin-top:16px"><h3>年ごとの明細（${esc(X.props[S.ui.prop].p.label)}）</h3>
        <div class="seg" style="margin-bottom:10px">${X.props.map((o, i) => `<button type="button" data-prop="${i}" class="${S.ui.prop === i ? "on" : ""}">${esc(o.p.label)}</button>`).join("")}</div>
        <div class="tbl-wrap"><table><thead><tr><th>年目</th><th>年</th><th>年末残高</th><th>上限（×0.7%）</th><th>所得税から</th><th>住民税から</th><th>控除しきれない</th></tr></thead><tbody>
        ${X.props[S.ui.prop].credit.rows.filter((r) => r.inPeriod).map((r) => `<tr><td>${r.i}</td><td>${r.year}</td><td>${man(r.balance, 1)}</td><td>${yen(r.max)}</td><td>${yen(r.fromIT)}</td><td>${yen(r.fromRT)}</td><td>${yen(r.unused)}${r.blocked ? `（${esc(r.blocked)}）` : ""}</td></tr>`).join("") || `<tr><td colspan="7">控除の対象外です</td></tr>`}
        </tbody></table></div>
        <p class="hint">上限＝min（年末残高, 借入限度額, 取得価格）×0.7%。実際の控除は所得税 → 翌年度の住民税（課税総所得金額等×5%・最高97,500円）の順で、控除しきれない額は受け取れません。単身者に子育て・若者夫婦世帯の上乗せは自動で適用しません。出典：${R.SOURCES.join("、")}。</p>
        ${talk("「控除は毎月の返済を減らすのではなく、所得税の還付と翌年の住民税の減額として戻ります。最大額ではなく、税額の範囲の見込み額でお話しします。」")}</div>` },

    { act: "3 納得", title: "住まい方の比較", lead: "家賃と返済額ではなく、税金・保険・修繕・管理費まで入れた「総住居費」で比べます。", form: () => `
      <div class="card white"><h3>比較するマンションの条件（仮定）</h3><div class="fields">
        ${F("condo.price", "価格", "man", { step: 10 })}${F("condo.down", "頭金", "man", { step: 10 })}${F("condo.fees", "管理費＋修繕積立金（月）", "man", { step: 0.1 })}
        ${F("condo.parking", "駐車場（月）", "man", { step: 0.1 })}${F("condo.propTaxYear", "固定資産税等（年）", "man", { step: 0.5 })}${F("condo.insYear", "保険（年）", "man", { step: 0.5 })}</div></div>`,
      result: () => {
        const cols = [C.navy, C.soft, C.gold, C.gray];
        const rows = [
          { label: "今の賃貸", segs: [{ v: X.rent.rent, color: cols[0], name: "家賃" }, { v: X.rent.ins, color: cols[1], name: "保険" }, { v: X.rent.renew, color: cols[2], name: "更新料" }, { v: X.rent.park, color: cols[3], name: "駐車場" }], total: man(X.rent.total, 1) },
          { label: "分譲マンション", segs: [{ v: X.condo.loan, color: cols[0], name: "返済" }, { v: X.condo.tax + X.condo.ins, color: cols[1], name: "税・保険" }, { v: X.condo.fees + X.condo.park, color: cols[3], name: "管理費等・駐車場" }], total: man(X.condo.total, 1) },
          ...X.props.map((o) => ({ label: o.p.label, strong: true, segs: [{ v: o.own.loan, color: cols[0], name: "返済" }, { v: o.own.tax + o.own.ins, color: cols[1], name: "税・保険" }, { v: o.own.repair, color: cols[2], name: "修繕積立" }], total: man(o.own.total, 1) })),
        ];
        const max = Math.max(...rows.map((r) => r.segs.reduce((a, s) => a + s.v, 0))) * 1.05;
        const t = (o) => (S.ui.credit ? o.ten.with : o.ten.without);
        return `<div class="card"><h3>毎月の総住居費</h3>${hbars(rows, max, [["家賃・ローン返済", cols[0]], ["税金・保険", cols[1]], ["修繕積立・更新料", cols[2]], ["管理費等・駐車場", cols[3]]])}
          <p class="hint">賃貸の更新料は2年ごとに1か月分、家財保険 年2万円と仮定。住宅ローン控除・初期費用は含みません。</p></div>
          <div class="card" style="margin-top:16px"><h3>10年間の総コスト　<span class="seg" style="vertical-align:middle;margin-left:8px"><button type="button" data-credit="1" class="${S.ui.credit ? "on" : ""}">控除あり</button><button type="button" data-credit="0" class="${S.ui.credit ? "" : "on"}">控除なし</button></span></h3>
          <div class="tbl-wrap"><table><thead><tr><th>項目</th>${X.props.map((o) => `<th>${esc(o.p.label)}</th>`).join("")}</tr></thead><tbody>
          ${[["物件価格", (o) => man(o.p.price)], ["初期費用（頭金＋諸費用）", (o) => man(o.ten.initial)], ["ローン返済（120回）", (o) => man(o.ten.loan)], ["固定資産税等（10年）", (o) => man(o.ten.tax)], ["保険（10年）", (o) => man(o.ten.ins)], ["修繕積立（10年）", (o) => man(o.ten.repair)],
             ["住宅ローン控除（10年）", (o) => (S.ui.credit ? "−" + man(o.ten.credit, 1) : "（含めない）")], ["10年間の総コスト", (o) => `<b>${man(t(o))}</b>`], ["10年後のローン残高", (o) => man(o.balances[10])], ["10年後の想定売却価格（横ばい）", (o) => man(o.sale[1].byScen[1].total)]]
            .map(([k, f]) => `<tr><td>${k}</td>${X.props.map((o) => `<td>${f(o)}</td>`).join("")}</tr>`).join("")}
          </tbody></table></div>
          ${talk("「控除の額だけで決めないでください。10年間に出ていくお金と、10年後に手元に残る価値の両方で比べます。」")}</div>`;
      } },

    { act: "3 納得", title: "土地・建物の価値", lead: "物件価格を土地と建物に分けて、価値の動き方の違いを見ます（将来価格の予想ではありません）。", form: () => "", result: () => {
      const o = X.props[S.ui.prop], flat = JM.SCENARIOS[1];
      const yrs = Array.from({ length: 31 }, (_, t) => t);
      return `<div class="seg" style="margin-bottom:12px">${X.props.map((x, i) => `<button type="button" data-prop="${i}" class="${S.ui.prop === i ? "on" : ""}">${esc(x.p.label)}</button>`).join("")}</div>
        <div class="grid g2"><div class="card white"><h3>土地と建物（横ばいシナリオ）</h3>
          ${lineChart({ labels: yrs.map((t) => t + "年"), series: [{ name: "土地", color: C.gold, values: yrs.map((t) => JM.valueAt(o.p, flat, t).land) }, { name: "建物", color: C.navy, values: yrs.map((t) => JM.valueAt(o.p, flat, t).bldg) }] })}</div>
        <div class="card"><h3>いまの内訳</h3><div class="stats">
          ${stat("土地", man(o.p.landPrice), `${o.p.landArea}㎡・${o.p.landArea ? manN(o.p.landPrice / o.p.landArea, 1) + "万円/㎡" : ""}`)}${stat("建物", man(o.p.price - o.p.landPrice), `${o.p.floor}㎡`)}
          ${stat("10年後（横ばい）", man(JM.valueAt(o.p, flat, 10).total), `土地 ${man(JM.valueAt(o.p, flat, 10).land)}・建物 ${man(JM.valueAt(o.p, flat, 10).bldg)}`)}
          ${stat("20年後（横ばい）", man(JM.valueAt(o.p, flat, 20).total), `建物は下限10%で計算`)}</div>
          <p class="hint">土地は劣化しないが市場で上下します。建物は年数とともに評価が下がるのが一般的で、点検・修繕の記録が評価につながります。木造の法定耐用年数22年は税務上の基準で、寿命ではありません。</p>
          ${talk("「土地は『どこにあるか』、建物は『どう手入れするか』で価値が決まります。だから立地と修繕計画の両方を見ます。」")}</div></div>`;
    } },

    { act: "4 安心", title: "将来の売却", lead: "5年後・10年後・20年後に売った場合の手取り（売却価格−売却費用−残債）を、3つの仮定シナリオで見ます。", form: () => "", result: () => `
      <div class="grid g2">${X.props.map((o, i) => `<div class="card ${i ? "ivory" : "white"}"><h3>${esc(o.p.label)}</h3>
        <div class="matrix"><div></div>${JM.SCENARIOS.map((s) => `<div class="h">${s.label}</div>`).join("")}
        ${o.sale.map((row) => `<div class="r">${row.t}年後<small>残債 ${man(row.byScen[0].balance)}</small></div>${row.byScen.map((c) => `<div class="c ${c.net >= 0 ? "p" : "m"}"><b>${sgn(c.net)}</b><small>価格 ${man(c.total)}</small></div>`).join("")}`).join("")}</div></div>`).join("")}</div>
      <div class="card" style="margin-top:16px"><h3>残債と物件価値（${esc(X.props[S.ui.prop].p.label)}）</h3>
        <div class="seg" style="margin-bottom:10px">${X.props.map((o, i) => `<button type="button" data-prop="${i}" class="${S.ui.prop === i ? "on" : ""}">${esc(o.p.label)}</button>`).join("")}</div>
        ${lineChart({ labels: X.props[S.ui.prop].balances.map((_, t) => t + "年"), series: [{ name: "ローン残債", color: C.navy, values: X.props[S.ui.prop].balances },
          ...X.props[S.ui.prop].values.map((v) => ({ name: "物件の価値（" + v.label + "）", color: v.key === "flat" ? C.gold : v.key === "up" ? C.goldL : C.gray, values: v.path, dash: v.key !== "flat" }))] })}
        <p class="hint">シナリオ：土地 年−1%／±0%／＋1%、建物 10年後に入力値−10／±0／＋10ポイント（下限10%）。売却費用＝仲介手数料の上限＋その他10万円。譲渡所得税は考慮していません（居住用財産の3,000万円特別控除などの特例は要件を要確認）。</p>
        ${talk("「短い期間で売ると持ち出しになりやすく、長く住むほど選択肢が広がります。最悪のケースも先に見ておきましょう。」")}</div>` },

    { act: "4 安心", title: "収入が減ったら", lead: "単身者は収入源が1つ。収入が減ったときの返済負担と、家計の余裕を確認します。", form: () => `
      <div class="card white"><h3>試算する収入の減少率</h3><div class="fields">
        ${S.drops.map((d, i) => F(`drops.${i}`, i === 0 ? "ケース1" : `ケース${i + 1}`, "pct", { step: 5 })).join("")}</div></div>`,
      result: () => `<div class="grid g2">${X.props.map((o, i) => `<div class="card ${i ? "ivory" : "white"}"><h3>${esc(o.p.label)}</h3>
        <div class="tbl-wrap"><table><thead><tr><th>収入</th><th>手取り（月）</th><th>返済÷手取り</th><th>住居費÷手取り</th><th>毎月の余裕</th></tr></thead><tbody>
        ${o.risk.map((r) => `<tr><td>${r.drop ? `${Math.round(r.drop * 100)}%減` : "今の収入"}</td><td>${man(r.takeHomeM, 1)}</td><td class="${r.loanRatio > 0.25 ? "neg" : "pos"}">${pct(r.loanRatio)}</td><td>${pct(r.housingRatio)}</td>
          <td class="${r.gap < 0 ? "neg" : ""}">${(r.gap >= 0 ? "＋" : "−") + yen(Math.abs(r.gap))}${r.gap < 0 ? `<br><small>手元資金で約${Math.floor(r.months)}か月</small>` : ""}</td></tr>`).join("")}
        </tbody></table></div></div>`).join("")}</div>
      <div class="card navy" style="margin-top:16px"><h3>備え方</h3>
        <ul style="margin:0;padding-left:20px;line-height:2">
          <li>返済は手取りの25%以内を目安に（一般的な目安。審査基準とは異なります）</li><li>生活費の6か月分程度を予備資金として残す</li>
          <li>固定金利と変動金利を比べる。金利が上がっても払える額で借りる</li><li>団信の保障範囲と、就業不能に備える保険を確認する</li><li>余裕のある年に繰上げ返済で残債を減らす</li></ul></div>` },

    { act: "5 行動", title: "提案書", lead: "ここまでの内容をA4の提案書にまとめます。右上の「提案書をPDFで出力」から印刷し、「PDFに保存」を選んでください。", form: () => "", result: () => `<div class="preview-wrap">${proposal()}</div>` },
  ];

  // ───────── 提案書（A4） ─────────
  function proposal() {
    const c = S.customer, today = new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
    const nm = { rent: "賃貸", condo: "分譲マンション", house: "土地付き戸建て" };
    const top3 = [...AX].sort((a, b) => S.priorities[b.key] - S.priorities[a.key]).slice(0, 3);
    const symb = { ok: ["◯", C.gain], part: ["△", "#8A6F3E"], ng: ["✕", C.loss], unknown: ["？", C.soft] };
    const foot = (n) => `<div class="foot"><span>${esc(BRAND.name)}｜人生を、自分の土地から。</span><span>${n} / 3</span></div>`;
    const dreams = [["住んでいたい街・場所", S.dream.place], ["家で過ごしたい時間", S.dream.time], ["家に欲しい空間", S.dream.space], ["大切にしたいもの", S.dream.value]];
    return `
    <section class="sheet"><div class="cover"><div class="sk" style="color:#B89B6A">PERSONAL PROPOSAL</div><h1 class="serif">人生を、自分の土地から。</h1>
      <div style="color:#EADFCB">${esc(c.name ? c.name + " 様" : "お客様")}のための 戸建て所有のご提案　｜　${today}</div></div>
      <div class="sk">01　あなたの10年後の暮らし</div>
      <div class="grid g2" style="margin:8px 0 14px">${dreams.map(([k, v]) => `<div class="card ivory" style="padding:12px"><div class="hint" style="margin:0">${k}</div><div style="min-height:36px;font-weight:700;color:#17233B">${esc(v) || "<span style='color:#AAB'>（未記入）</span>"}</div></div>`).join("")}</div>
      <div class="sk">02　大切にしたいこと</div>
      <p style="margin:6px 0 4px">${top3.map((a) => `<span class="pill" style="margin-right:6px">${esc(a.label)}</span>`).join("")}</p>
      <div style="margin:10px 0 16px">${X.compare.rank.map((k, i) => `<div class="rank" style="grid-template-columns:120px 1fr 50px"><div style="font-weight:700">${i + 1}. ${nm[k]}</div><div class="bar"><i style="width:${(100 * X.compare.score[k]) / X.compare.max}%;background:${k === "house" ? C.gold : C.navy}"></i></div><div>${Math.round((100 * X.compare.score[k]) / X.compare.max)}点</div></div>`).join("")}</div>
      <div class="sk">03　今の住まいとの比較（毎月の総住居費）</div>
      <div class="stats" style="margin-top:8px">${stat("今の賃貸", man(X.rent.total, 1))}${X.props.map((o) => stat(esc(o.p.label), man(o.own.total, 1), "返済＋税・保険・修繕")).join("")}${stat("分譲マンション（仮定）", man(X.condo.total, 1))}</div>
      ${foot(1)}</section>
    <section class="sheet"><div class="sk">04　物件の比較</div><h2 class="serif">数字で見る、2つの物件</h2>
      <table style="margin:10px 0 14px"><thead><tr><th>項目</th>${X.props.map((o) => `<th>${esc(o.p.label)}</th>`).join("")}</tr></thead><tbody>
      ${[["物件価格（土地／建物）", (o) => `${man(o.p.price)}（${manN(o.p.landPrice)}／${manN(o.p.price - o.p.landPrice)}）`], ["初期費用（頭金＋諸費用）", (o) => man(o.cashOut)], ["借入額／毎月の返済", (o) => `${man(o.loan.amount)}／${yen(o.pmt)}`],
         ["毎月の総住居費", (o) => man(o.own.total, 1)], ["返済÷手取り（目安25%）", (o) => pct(o.risk[0].loanRatio)], ["購入後の手元資金", (o) => man(o.cashLeft)],
         ["住宅ローン控除", (o) => (o.credit.judge.ok ? `${man(o.credit.judge.limit)}・${o.credit.judge.years}年` : "対象外")], ["控除見込（初年度／累計）", (o) => `${yen(o.credit.first)}／${man(o.credit.total, 1)}`],
         ["10年間の総コスト（控除後）", (o) => man(o.ten.with)], ["10年後に売却（横ばい）", (o) => sgn(o.sale[1].byScen[1].net)]]
        .map(([k, f]) => `<tr><td>${k}</td>${X.props.map((o) => `<td>${f(o)}</td>`).join("")}</tr>`).join("")}</tbody></table>
      <div class="sk">05　あなたの希望に合っているか</div>
      <div class="grid g2" style="margin-top:8px">${X.props.map((o) => `<div><div style="font-weight:700;color:#17233B;margin-bottom:4px">${esc(o.p.label)}</div>
        ${o.fit.map((f) => `<div class="fit" style="padding:4px 0;font-size:11px"><div class="sym" style="font-size:15px;color:${symb[f.status][1]}">${symb[f.status][0]}</div><div><b>${esc(f.label)}${f.must ? "（必須）" : ""}</b>　${esc(f.detail)}</div></div>`).join("")}</div>`).join("")}</div>
      <p class="hint">◯ 合う　△ 一部　✕ 合わない　？ 未確認（見学・ハザードマップ・重要事項説明で確認します）</p>
      ${foot(2)}</section>
    <section class="sheet"><div class="sk">06　将来の選択肢と、もしものとき</div><h2 class="serif">売る・住み替える・備える</h2>
      <div class="grid g2" style="margin:10px 0">${X.props.map((o) => `<div><div style="font-weight:700;color:#17233B;margin-bottom:4px">${esc(o.p.label)}：売却した場合の手取り</div>
        <table><thead><tr><th></th>${JM.SCENARIOS.map((s) => `<th>${s.label}</th>`).join("")}</tr></thead><tbody>${o.sale.map((r) => `<tr><td>${r.t}年後</td>${r.byScen.map((x) => `<td style="color:${x.net >= 0 ? C.gain : C.loss};font-weight:700">${sgn(x.net)}</td>`).join("")}</tr>`).join("")}</tbody></table>
        <div style="font-weight:700;color:#17233B;margin:10px 0 4px">収入が減った場合（返済÷手取り）</div>
        <table><tbody>${o.risk.map((r) => `<tr><td>${r.drop ? Math.round(r.drop * 100) + "%減" : "今の収入"}</td><td style="color:${r.loanRatio > 0.25 ? C.loss : C.gain};font-weight:700">${pct(r.loanRatio)}</td><td>${r.gap >= 0 ? "黒字" : "月" + yen(-r.gap) + "の不足"}</td></tr>`).join("")}</tbody></table></div>`).join("")}</div>
      <div class="sk" style="margin-top:12px">07　購入前に確認すること</div>
      <p style="font-size:12px;margin:6px 0">災害リスク（ハザードマップ）／接道（幅4m以上の道路に2m以上）／再建築の可否／耐震（1981年6月以降の建築確認）／住宅性能の証明書（控除の枠に直結）／ローンの事前審査</p>
      <div class="sk" style="margin-top:12px">08　次の一歩</div>
      <div class="grid g2" style="margin-top:6px">${["物件見学：昼と夜、平日と休日に", "資金計画：源泉徴収票で控除・返済を詳しく計算", "現地・書類の確認：ハザード・接道・性能証明", "次回のご提案：希望に合う物件を比較（見送りも選択肢）"].map((t, i) => `<div class="card ivory" style="padding:10px 12px;font-size:12px"><b style="color:#8A6F3E">STEP 0${i + 1}</b>　${t}</div>`).join("")}</div>
      <p class="hint" style="margin-top:12px">${esc(BRAND.name)}　${esc(BRAND.site)}　TEL ${esc(BRAND.tel)}　${esc(BRAND.staff)}</p>
      <p class="hint">本提案書の数値は入力条件と仮定値による試算で、将来の価格・金利・税制・控除額を保証するものではありません。住宅ローン控除は${R.BASIS_DATE}時点の制度にもとづく${X.props.some((o) => o.credit.estimated) ? "概算（税額は推計）" : "計算"}です。最新の制度は国税庁・国土交通省等でご確認ください。宅地建物取引業の表示：${esc(BRAND.license)}</p>
      ${foot(3)}</section>`;
  }

  // ───────── 描画 ─────────
  function renderNav() {
    let act = "";
    $("#nav").innerHTML = STEPS.map((s, i) => {
      const head = s.act !== act ? `<div class="act">第${s.act}</div>` : "";
      act = s.act;
      return `${head}<button type="button" data-step="${i}" class="${S.ui.step === i ? "on" : ""}" ${S.ui.step === i ? 'aria-current="step"' : ""}><span class="n">${i + 1}</span>${s.title}</button>`;
    }).join("");
  }
  function renderStep() {
    const s = STEPS[S.ui.step];
    $("#main").innerHTML = `<div class="kicker">STEP ${S.ui.step + 1} / ${STEPS.length}　｜　第${s.act}</div>
      <h2 class="page-title">${s.title}</h2><p class="lead">${s.lead}</p>
      <div id="form">${s.form()}</div><div id="result" style="margin-top:16px">${s.result()}</div>
      <div style="display:flex;justify-content:space-between;margin-top:22px;gap:8px">
        ${S.ui.step > 0 ? `<button class="btn" type="button" data-step="${S.ui.step - 1}">← ${STEPS[S.ui.step - 1].title}</button>` : "<span></span>"}
        ${S.ui.step < STEPS.length - 1 ? `<button class="btn primary" type="button" data-step="${S.ui.step + 1}">${STEPS[S.ui.step + 1].title} →</button>` : ""}</div>
      <p class="disclaimer">数値は入力条件と仮定値による試算で、将来の価格・金利・税制を保証するものではありません。入力内容はこの端末の中だけで計算し、送信しません。</p>`;
    renderNav();
  }
  function renderResult() { const r = $("#result"); if (r) r.innerHTML = STEPS[S.ui.step].result(); }
  function renderSum() {
    $("#sumbar").innerHTML = `<div class="it"><div class="k">今の賃貸（月）</div><div class="v">${man(X.rent.total, 1)}</div></div>` +
      X.props.map((o) => `<div class="it"><div class="k">${esc(o.p.label)}（月の住居費）</div><div class="v">${man(o.own.total, 1)}</div></div>
        <div class="it"><div class="k">${esc(o.p.label)}（控除見込・累計）</div><div class="v">${o.credit.judge.ok ? man(o.credit.total, 1) : "対象外"}</div></div>
        <div class="it"><div class="k">${esc(o.p.label)}（購入後の手元資金）</div><div class="v ${o.cashLeft < o.reserveTarget ? "neg" : ""}">${man(o.cashLeft)}</div></div>`).join("");
  }
  function recompute() {
    S.props.forEach((p) => { p.bldgPrice = Math.max(0, p.price - p.landPrice); });
    X = JM.compute(S);
    save();
  }
  function all() { recompute(); renderStep(); renderSum(); }

  // ───────── イベント ─────────
  document.addEventListener("input", (e) => {
    const el = e.target;
    if (!el.dataset || !el.dataset.path) return;
    set(el.dataset.path, readInput(el));
    if (el.type === "range") { const pv = $("#pv-" + el.dataset.path.split(".").pop()); if (pv) pv.textContent = el.value; }
    recompute(); renderResult(); renderSum();
  });
  document.addEventListener("change", (e) => { if (e.target.dataset && e.target.dataset.re !== undefined) all(); });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.step) { S.ui.step = +b.dataset.step; save(); renderStep(); $("#main").focus(); window.scrollTo(0, 0); }
    else if (b.dataset.taxmode) { S.customer.taxMode = b.dataset.taxmode; all(); }
    else if (b.dataset.credit) { S.ui.credit = b.dataset.credit === "1"; save(); renderResult(); }
    else if (b.dataset.prop) { S.ui.prop = +b.dataset.prop; save(); renderResult(); }
  });
  $("#btnPrint").addEventListener("click", () => { $("#proposal").innerHTML = proposal(); window.print(); });
  window.addEventListener("beforeprint", () => { $("#proposal").innerHTML = proposal(); });
  const dlg = $("#menu");
  $("#btnMenu").addEventListener("click", () => { try { $("#persist").checked = localStorage.getItem(KEY_ON) === "1"; } catch (e) { $("#persist").disabled = true; } dlg.showModal(); });
  $("#btnClose").addEventListener("click", () => dlg.close());
  $("#persist").addEventListener("change", (e) => {
    try {
      if (e.target.checked) {
        if (!confirm("入力内容（お客様情報を含む）をこのブラウザに保存します。共用の端末では使わないでください。よろしいですか？")) { e.target.checked = false; return; }
        localStorage.setItem(KEY_ON, "1"); save();
      } else { localStorage.removeItem(KEY_ON); localStorage.removeItem(KEY); }
    } catch (err) { alert("このブラウザでは保存できません。ファイルへの書き出しをご利用ください。"); e.target.checked = false; }
  });
  $("#btnExport").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: "application/json" }));
    a.download = `戸建て提案_${S.customer.name || "お客様"}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $("#btnImport").addEventListener("click", () => $("#file").click());
  $("#file").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const v = JSON.parse(await f.text()); if (!v.customer || !v.props) throw new Error(); S = { ...fresh(), ...v }; all(); dlg.close(); }
    catch (err) { alert("読み込めないファイルです。このシミュレーターで書き出したJSONを選んでください。"); }
    e.target.value = "";
  });
  $("#btnReset").addEventListener("click", () => { if (confirm("入力内容をサンプルに戻します。よろしいですか？")) { S = fresh(); all(); dlg.close(); } });

  $("#brandEn").textContent = BRAND.nameEn;
  all();
})();
