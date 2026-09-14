import fs from 'node:fs';
const { rows, deals, DATA_END } = JSON.parse(fs.readFileSync('deals.json','utf8'));
const P = JSON.parse(fs.readFileSync('profit.json','utf8'));
const S9 = JSON.parse(fs.readFileSync('sep9.json','utf8'));

const esc = (s)=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const n = (v)=>v==null?'—':Number(v).toLocaleString('ja-JP');

/* ---------- 集計 ---------- */
const STAGES = ['事前承認','契約完了','本承認','金消契約','決済完了','案件完了'];
const reached = STAGES.map((s,i)=>({ stage:s, n: deals.filter(d=>d.maxStage>=i+1).length }));
const atStage = STAGES.map((s,i)=>({ stage:s, n: deals.filter(d=>d.maxStage===i+1).length }));
const live = deals.filter(d=>!d.done).sort((a,b)=>b.idleDays-a.idleDays);
const byOwner = Object.entries(deals.reduce((a,d)=>((a[d.owner||'(未記入)']=(a[d.owner||'(未記入)']||0)+1),a),{})).sort((a,b)=>b[1]-a[1]);
const bankKey = (b)=>{
  if(!b) return '(未記入)';
  const t=b.replace(/\s|　/g,'');
  for(const k of ['中央労金','中労金','水戸信用金庫','水戸信金','結城信用金庫','結城信金','栃木銀行','東邦銀行','楽天銀行','足利小山信用金庫','鹿沼信金','鹿沼信用金庫','筑波銀行','群馬銀行','大光銀行','福島銀行','常陽銀行','アルヒ','SBI','アプラス','オリコ','JA','現金'])
    if(t.includes(k)) return ({'中労金':'中央労金','水戸信金':'水戸信用金庫','結城信金':'結城信用金庫','鹿沼信金':'鹿沼信用金庫'})[k]||k;
  return t;
};
const byBank = Object.entries(deals.reduce((a,d)=>{const k=bankKey(d.bank);a[k]=(a[k]||0)+1;return a;},{})).sort((a,b)=>b[1]-a[1]);
const sellerKey=(s)=>{if(!s)return '(未記入)';const t=s.replace(/様|㈱|株式会社|\(株\)|（株）/g,'').trim();if(!t)return '(未記入)';if(/^(無し|なし)$/.test(t))return '仲介なし（直接）';return t;};
const bySeller = Object.entries(deals.reduce((a,d)=>{const k=sellerKey(d.broker||d.seller);a[k]=(a[k]||0)+1;return a;},{})).sort((a,b)=>b[1]-a[1]);
const byMonth = Object.entries(rows.reduce((a,r)=>{const k=r.date.slice(0,7);a[k]=(a[k]||0)+1;return a;},{})).sort();
const leadDone = deals.filter(d=>d.done && d.leadDays>0);
const avgLead = Math.round(leadDone.reduce((s,d)=>s+d.leadDays,0)/leadDone.length);

/* ---------- チャート部品 ---------- */
const SEQ=['#86b6ef','#5598e7','#2a78d6','#1c5cab','#104281'];
function vbars(data,{unit='万円',fmt=n,color='var(--s1)',refs=[]}={}){
  const M = Math.max(...data.map(d=>d.v), ...refs.map(r=>r.v)) * 1.12;
  return `<div class="vchart">
  <div class="vplot">
    ${refs.map(r=>`<div class="refline" style="bottom:${(r.v/M*100).toFixed(2)}%;border-color:${r.color||'var(--ink2)'}"><span style="color:${r.color||'var(--ink2)'}">${esc(r.label)}</span></div>`).join('')}
    ${data.map(d=>`<div class="vcol" tabindex="0" data-tip="${esc(d.label)}｜${fmt(d.v)}${unit}${d.memo?`　${esc(d.memo)}`:''}">
      <div class="vbar" style="height:${(d.v/M*100).toFixed(2)}%;background:${d.color||color}"><span class="vval">${fmt(d.v)}</span></div>
    </div>`).join('')}
  </div>
  <div class="vlabs">${data.map(d=>`<div class="vlab">${esc(d.short??d.label)}</div>`).join('')}</div>
</div>`;
}
function hbars(data,{unit='件',color='var(--s1)',colorBy=null}={}){
  const M=Math.max(...data.map(d=>d.v));
  return `<div class="hchart">${data.map((d,i)=>`<div class="hrow" tabindex="0" data-tip="${esc(d.label)}｜${n(d.v)}${unit}">
    <div class="hlab">${esc(d.label)}</div>
    <div class="htrack"><div class="hfill" style="width:${Math.max(d.v/M*100,1.5).toFixed(1)}%;background:${colorBy?colorBy(d,i):color}"></div></div>
    <div class="hval">${n(d.v)}${d.sub?`<span class="hsub">${esc(d.sub)}</span>`:''}</div></div>`).join('')}</div>`;
}

/* ---------- 稼働中案件テーブル ---------- */
const alertOf=(d)=> d.idleDays>=60?['critical','要再確認']: d.idleDays>=30?['warn','停滞']:['good','進行中'];
const liveRows = live.map(d=>{const [lv,lb]=alertOf(d);return `<tr data-stage="${esc(d.stageLabel)}" data-owner="${esc(d.owner||'(未記入)')}" data-alert="${lv}">
  <td class="nm">${esc(d.customer)}${d.seq>1?`<span class="seq">案件${d.seq}</span>`:''}</td>
  <td><span class="pill p${d.maxStage}">${esc(d.stageLabel)}</span></td>
  <td>${esc(d.owner||'—')}</td><td class="sm">${esc(bankKey(d.bank))}</td>
  <td class="sm">${esc(d.next||'—')}</td><td class="sm">${esc(d.nextAt||'—')}</td>
  <td class="num">${d.reportCount}</td><td class="num">${d.last.slice(5)}</td>
  <td class="num"><span class="st st-${lv}">${d.idleDays}日</span></td>
  <td class="sm"><span class="st st-${lv}">${lb}</span></td></tr>`;}).join('');

/* ---------- 6月 案件別利益 ---------- */
const juneAll=[...P.june.jisha.map(x=>({...x,grp:'自社'})),...P.june.other.map(x=>({...x,grp:x.type}))]
  .sort((a,b)=>b.rieki-a.rieki);
const juneMax=Math.max(...juneAll.map(x=>x.rieki));
const juneChart = juneAll.map(x=>`<div class="hrow" tabindex="0" data-tip="${esc(x.name)}｜利益 ${n(x.rieki)}万円・物件巾 ${n(x.haba)}万円・${esc(x.status)}">
  <div class="hlab">${esc(x.name)}<span class="grp">${esc(x.grp)}</span></div>
  <div class="htrack"><div class="hfill" style="width:${(x.rieki/juneMax*100).toFixed(1)}%;background:${x.grp==='自社'?'var(--s1)':'var(--s2)'}"></div></div>
  <div class="hval">${n(x.rieki)}<span class="hsub">万円</span></div></div>`).join('');

/* ---------- 表記ゆれ ---------- */
const FIX=[['綱川大吾','綱川大悟'],['吉村拓也','吉村拓哉'],['加來嵩時','加来嵩時'],['岡潤祐','岡潤佑'],['渡邉裕也','渡邊裕也'],['小池雅弘','小池雅広'],['宮崎定規','宮﨑定規']];
const missing = rows.filter(r=>!r.bank||!r.owner).length;

const html = `<!DOCTYPE html>
<html lang="ja"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>第6期 営業・案件ダッシュボード｜株式会社 Martial Arts</title>
<style>
:root{
  --surface-0:#eef1f6; --surface-1:#fcfcfb; --ink:#0b0b0b; --ink2:#52514e; --muted:#7a7973;
  --line:#e3e5e2; --line2:#f0efec;
  --s1:#2a78d6; --s2:#eb6834;
  --good:#008300; --warn:#eda100; --critical:#e34948;
  --seq1:${SEQ[0]}; --seq2:${SEQ[1]}; --seq3:${SEQ[2]}; --seq4:${SEQ[3]}; --seq5:${SEQ[4]};
  --hero:#0d366b;
}
*{box-sizing:border-box}
body{margin:0;background:linear-gradient(180deg,var(--hero) 0,#184f95 300px,var(--surface-0) 300px,var(--surface-0) 100%);
  color:var(--ink);line-height:1.65;-webkit-font-smoothing:antialiased;
  font-family:-apple-system,"Hiragino Kaku Gothic ProN","Yu Gothic",Meiryo,IPAGothic,sans-serif;}
.wrap{max-width:1180px;margin:0 auto;padding:26px 20px 72px}
header.hero{color:#fff;padding:12px 4px 26px}
.eyebrow{font-size:11px;letter-spacing:.2em;font-weight:800;color:#9ec5f4}
h1{font-size:29px;font-weight:800;margin:7px 0 8px;letter-spacing:.01em}
.sub{color:#cde2fb;font-size:13.5px;max-width:820px}
.tag{display:inline-block;background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.2);
  color:#e8eef7;font-size:11px;padding:3px 10px;border-radius:999px;margin:11px 6px 0 0}
.grid{display:grid;gap:15px}
.k4{grid-template-columns:repeat(4,1fr)}
@media(max-width:860px){.k4{grid-template-columns:repeat(2,1fr)}}
.card{background:var(--surface-1);border:1px solid var(--line);border-radius:15px;padding:17px 18px;
  box-shadow:0 10px 28px -20px rgba(13,54,107,.4)}
.kpi .lab{font-size:11.5px;color:var(--ink2);font-weight:700}
.kpi .num{font-size:27px;font-weight:800;letter-spacing:-.02em;margin-top:3px;font-variant-numeric:tabular-nums}
.kpi .num small{font-size:13px;font-weight:700;color:var(--ink2);margin-left:3px}
.kpi .note{font-size:11.5px;color:var(--muted);margin-top:2px}
section{margin-top:30px}
h2{font-size:17.5px;font-weight:800;margin:0 0 3px;display:flex;align-items:center;gap:9px}
h2 .dot{width:9px;height:9px;border-radius:3px;background:var(--s1)}
.lead{color:var(--ink2);font-size:12.5px;margin:0 0 13px}
.panel{background:var(--surface-1);border:1px solid var(--line);border-radius:15px;padding:19px 20px;
  box-shadow:0 10px 28px -22px rgba(13,54,107,.35)}
.two{display:grid;grid-template-columns:1fr 1fr;gap:15px}
@media(max-width:860px){.two{grid-template-columns:1fr}}
.src{font-size:11px;color:var(--muted);margin-top:11px;border-top:1px solid var(--line2);padding-top:8px}
/* 縦棒 */
.vchart{padding-top:20px}
.vplot{position:relative;display:flex;gap:6px;align-items:flex-end;height:198px;
  border-bottom:1px solid var(--line);padding:0 2px}
.vcol{flex:1;display:flex;align-items:flex-end;justify-content:center;height:100%;border-radius:6px 6px 0 0;
  cursor:default;outline:none}
.vcol:hover,.vcol:focus-visible{background:var(--line2)}
.vbar{position:relative;width:74%;border-radius:4px 4px 0 0;min-height:2px}
.vval{position:absolute;left:50%;transform:translateX(-50%);top:-16px;font-size:10.5px;font-weight:800;
  color:var(--ink2);font-variant-numeric:tabular-nums;white-space:nowrap}
.vlabs{display:flex;gap:6px;padding:6px 2px 0}
.vlab{flex:1;text-align:center;font-size:10.5px;color:var(--muted);white-space:nowrap}
.refline{position:absolute;left:0;right:0;border-top:2px dashed;z-index:2;pointer-events:none}
.refline span{position:absolute;left:2px;top:-16px;font-size:10.5px;font-weight:800;
  background:var(--surface-1);padding:0 5px}
/* 横棒 */
.hchart{display:flex;flex-direction:column;gap:7px}
.hrow{display:grid;grid-template-columns:132px 1fr 74px;align-items:center;gap:11px;border-radius:7px;outline:none}
.hrow:hover,.hrow:focus-visible{background:var(--line2)}
.hlab{font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hlab .grp{font-size:10px;font-weight:700;color:var(--muted);margin-left:6px}
.htrack{background:var(--line2);border-radius:6px;height:19px;overflow:hidden}
.hfill{height:100%;border-radius:4px;display:block}
.hval{font-size:12.5px;font-weight:800;text-align:right;font-variant-numeric:tabular-nums}
.hval .hsub{font-size:10px;font-weight:700;color:var(--muted);margin-left:2px}
/* ファネル */
.funnel{display:flex;flex-direction:column;gap:7px}
.frow{display:grid;grid-template-columns:96px 1fr 108px;align-items:center;gap:11px}
.fbar{height:38px;border-radius:7px;display:flex;align-items:center;padding:0 13px;color:#fff;
  font-weight:800;font-size:13px;min-width:54px}
.fname{font-size:12.5px;font-weight:700}
.fmeta{font-size:11px;color:var(--ink2);text-align:right;font-variant-numeric:tabular-nums}
/* テーブル */
.tblwrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:12.5px}
th,td{padding:8px 9px;border-bottom:1px solid var(--line2);text-align:left;vertical-align:top}
thead th{font-size:10.5px;color:var(--ink2);font-weight:800;border-bottom:2px solid var(--line);white-space:nowrap;
  position:sticky;top:0;background:var(--surface-1);cursor:pointer;user-select:none}
thead th:hover{color:var(--s1)}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
td.nm{font-weight:700;white-space:nowrap}
td.sm{font-size:11.5px;color:var(--ink2);max-width:250px}
.seq{font-size:9.5px;font-weight:800;color:#fff;background:var(--s2);border-radius:4px;padding:1px 5px;margin-left:5px;vertical-align:1px}
.pill{display:inline-block;font-size:11px;font-weight:800;color:#fff;border-radius:999px;padding:2px 9px;white-space:nowrap}
.p1{background:var(--seq1);color:#0d366b}.p2{background:var(--seq2);color:#0d366b}.p3{background:var(--seq3)}
.p4{background:var(--seq4)}.p5{background:var(--seq5)}.p6{background:var(--seq5)}
.st{font-weight:800;font-size:11.5px;white-space:nowrap}
.st-good{color:var(--good)}.st-warn{color:#8a5d00}.st-critical{color:#b3201f}
.filters{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:13px}
.fbtn{font:inherit;font-size:11.5px;font-weight:700;border:1px solid var(--line);background:var(--surface-1);
  color:var(--ink2);border-radius:999px;padding:4px 12px;cursor:pointer}
.fbtn[aria-pressed="true"]{background:var(--s1);border-color:var(--s1);color:#fff}
.legend{display:flex;gap:14px;flex-wrap:wrap;font-size:11.5px;color:var(--ink2);margin-bottom:11px;font-weight:700}
.legend i{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:5px;vertical-align:-1px}
.callout{border-left:3px solid var(--s2);background:#fff6f1;border-radius:0 9px 9px 0;padding:12px 15px;font-size:12.5px;margin-top:14px}
.callout b{color:#a8380e}
.mini{font-size:11.5px;color:var(--ink2)}
ul.tight{margin:6px 0 0;padding-left:1.2em}ul.tight li{margin:3px 0;font-size:12.5px}
#tip{position:fixed;z-index:99;pointer-events:none;background:#111;color:#fff;font-size:11.5px;font-weight:600;
  padding:6px 10px;border-radius:7px;max-width:330px;opacity:0;transition:opacity .1s;line-height:1.5}
@media print{
  body{background:#fff}.wrap{max-width:none;padding:0}
  header.hero{color:#0b0b0b;background:#fff}.eyebrow{color:var(--s1)}.sub{color:var(--ink2)}
  .tag{background:#f0efec;color:var(--ink2);border-color:var(--line)}
  .card,.panel{box-shadow:none;break-inside:avoid}section{break-inside:avoid}
  .filters,#tip{display:none}thead th{position:static}
}
</style></head><body>
<div class="wrap">
<header class="hero">
  <div class="eyebrow">MARTIAL ARTS ／ 第6期 経営ダッシュボード</div>
  <h1>営業・案件ダッシュボード</h1>
  <p class="sub">報告ログ（${rows.length}件 / ${deals.length}案件・2026-03-22〜${DATA_END}）と「第6期目 利益表」（令和7年8月〜令和8年8月）・令和8年9月の利益管理ダッシュボードを突き合わせ、<b>案件がいまどこで止まっているか</b>と<b>それがいくらの利益になったか</b>、<b>固定費に届いているか</b>を1枚で見るためのボードです。</p>
  <span class="tag">報告ログ ${rows.length}件</span><span class="tag">案件 ${deals.length}件</span>
  <span class="tag">顧客 ${new Set(rows.map(r=>r.customer)).size}名</span><span class="tag">利益表 13ヶ月</span>
  <span class="tag">データ最終日 ${DATA_END}</span><span class="tag" style="background:rgba(227,73,72,.25);border-color:rgba(227,73,72,.5)">令和8年9月 収支 ▲${n(Math.abs(S9.shushi))}万</span>
</header>

<div class="grid k4">
  <div class="card kpi"><div class="lab">令和8年9月 収支見込</div><div class="num" style="color:var(--critical)">▲${n(Math.abs(S9.shushi))}<small>万円</small></div><div class="note">利益 ${n(S9.total)}万 − 固定費 ${n(S9.kotei)}万</div></div>
  <div class="card kpi"><div class="lab">うち確定している利益</div><div class="num">${n(S9.kakutei)}<small>万円</small></div><div class="note">見込${n(S9.total)}万の${(S9.kakutei/S9.total*100).toFixed(0)}%／未確定 ${n(S9.mikakutei)}万</div></div>
  <div class="card kpi"><div class="lab">第6期 利益合計</div><div class="num">${n(P.total.rieki)}<small>万円</small></div><div class="note">13ヶ月・月平均 ${n(P.average.rieki)}万円</div></div>
  <div class="card kpi"><div class="lab">稼働中の案件</div><div class="num">${live.length}<small>件</small></div><div class="note">報告ログ全${deals.length}案件中・完了 ${deals.length-live.length}件</div></div>
</div>

<div class="callout" style="margin-top:15px;border-left-color:var(--critical);background:#fdf2f2">
  <b>固定費 ${n(S9.kotei)}万円／月を下回った月が、第6期13ヶ月のうち${P.months.filter(m=>m.rieki<S9.kotei).length}ヶ月あります。</b>
  直近は令和8年8月 ${n(1662)}万円（▲${n(S9.kotei-1662)}万）、令和8年9月見込 ${n(S9.total)}万円（▲${n(Math.abs(S9.shushi))}万）で<b>2ヶ月連続の固定費割れ</b>。
  さらに9月見込のうち確定は${n(S9.kakutei)}万円のみで、残り${n(S9.mikakutei)}万円は審査・契約の結果次第です。
</div>

<section>
  <h2><span class="dot"></span>月次 利益推移（第6期）</h2>
  <p class="lead">各月の利益表「利益」欄の合計。単位：万円。</p>
  <div class="panel">
    <div class="legend"><span><i style="background:var(--s1)"></i>実績（利益表）</span><span><i style="background:var(--s2)"></i>令和8年9月 見込</span><span><i style="width:14px;height:0;border-top:2px dashed var(--critical);border-radius:0"></i>固定費 3,000万円／月</span></div>
    ${vbars([...P.months.map(m=>({label:m.m,short:m.short,v:m.rieki,memo:m.memo})),{label:'令和8年9月（見込）',short:'R8/9',v:S9.total,color:'var(--s2)',memo:'9月ダッシュボード見込'}],{refs:[{v:S9.kotei,label:`固定費 ${n(S9.kotei)}万`,color:'var(--critical)'}]})}
    <div class="callout"><b>令和7年12月が突出（7,955万円／12本）</b>。月平均${n(P.average.rieki)}万円に対して約2.5倍で、この1ヶ月が第6期全体の${(7955/P.total.rieki*100).toFixed(0)}%を占めます。直近の令和8年8月は${n(1662)}万円と13ヶ月で最低。</div>
    <div class="src">出典：⭐️第6期目 利益表（担当：武田）／「第6期 月次推移サマリー」シート。売上欄は原本が自由記述のため、集計対象は利益のみ。</div>
  </div>
</section>

<section>
  <h2><span class="dot"></span>私募債 調達推移</h2>
  <p class="lead">月次推移サマリーの私募債欄（判明分）。単位：万円。</p>
  <div class="panel">
    ${vbars(P.months.map(m=>({label:m.m,short:m.short,v:m.shibo??0})),{color:'var(--s2)'})}
    <div class="src">出典：同上。R7/10・R8/7・R8/8 は原本に記載がないため 0 として描画（実績ゼロとは限りません）。</div>
  </div>
</section>

<section>
  <h2><span class="dot"></span>案件パイプライン</h2>
  <p class="lead">報告ログ${rows.length}件を顧客ごとの案件（${deals.length}件）にまとめ、到達した最上位ステージで分類。</p>
  <div class="panel">
    <div class="funnel">
      ${reached.map((r,i)=>`<div class="frow" tabindex="0" data-tip="${esc(r.stage)}まで到達：${r.n}件（${(r.n/deals.length*100).toFixed(0)}%）／このステージで滞留：${atStage[i].n}件">
        <div class="fname">${esc(r.stage)}</div>
        <div><div class="fbar" style="width:${Math.max(r.n/deals.length*100,8).toFixed(1)}%;background:${SEQ[Math.min(i,4)]};${i<2?'color:#0d366b':''}">${r.n}件</div></div>
        <div class="fmeta">到達 ${(r.n/deals.length*100).toFixed(0)}％<br>滞留 ${atStage[i].n}件</div></div>`).join('')}
    </div>
    <div class="callout"><b>「金消契約」に${atStage[3].n}件が滞留して見えますが、大半は実際には着地しています。</b>利益表では綱川様・池田様・渡邉様が令和8年6月に決済して利益計上され、関様・本田様・小池様・松倉様・吉村様は令和8年9月に私募債案件として計上されています。それでも報告ログ側に「決済完了」の投稿はありません。<b>詰まっているのは案件ではなく報告</b>で、ログだけを見ると金消で止まって見えます。</div>
    <div class="src">ステージ順：事前承認→契約完了→本承認→金消契約→決済完了→案件完了。到達＝そのステージ以上に到達した案件数、滞留＝そこが最終到達点の案件数。完了案件の平均リードタイム ${avgLead}日（初回報告→最終報告）。</div>
  </div>
</section>

<section>
  <h2><span class="dot"></span>稼働中案件 ${live.length}件（最終報告からの経過日数順）</h2>
  <p class="lead">決済完了・案件完了の報告が無い案件。経過日数は<b>データ最終日 ${DATA_END} 基準</b>です。</p>
  <div class="panel">
    <div class="filters" id="filters">
      <button class="fbtn" aria-pressed="true" data-f="all">すべて（${live.length}）</button>
      ${['critical','warn','good'].map(l=>{const c=live.filter(d=>alertOf(d)[0]===l).length;const lb={critical:'要再確認（60日〜）',warn:'停滞（30〜59日）',good:'進行中（〜29日）'}[l];
        return `<button class="fbtn" aria-pressed="false" data-f="${l}">${lb}（${c}）</button>`}).join('')}
    </div>
    <div class="legend">
      <span><i style="background:var(--critical)"></i>要再確認 60日〜</span>
      <span><i style="background:var(--warn)"></i>停滞 30〜59日</span>
      <span><i style="background:var(--good)"></i>進行中 〜29日</span>
      <span class="mini">列見出しをクリックで並べ替え</span>
    </div>
    <div class="tblwrap"><table id="livetbl"><thead><tr>
      <th>お客様</th><th>最終ステージ</th><th>担当</th><th>金融機関</th><th>次回予定</th><th>予定日時</th>
      <th class="num">報告数</th><th class="num">最終報告</th><th class="num">経過</th><th>状態</th>
    </tr></thead><tbody>${liveRows}</tbody></table></div>
    <div class="src">出典：営業報告ログ（Slack 報告一覧）。同一顧客で決済完了・案件完了の後に新しい報告が始まる場合は別案件（案件2）として分離しています。</div>
  </div>
</section>

<div class="two">
  <section style="margin-top:30px"><h2><span class="dot"></span>担当者別 案件数</h2>
    <p class="lead">報告ログ上の主担当（最新報告基準）。</p>
    <div class="panel">${hbars(byOwner.map(([k,v])=>({label:k,v})))}
    <div class="src">役職表記（係長代理・課長・部長・CMO）は氏名に統合。</div></div>
  </section>
  <section style="margin-top:30px"><h2><span class="dot"></span>金融機関別 案件数</h2>
    <p class="lead">表記ゆれ（信金／信用金庫、支店名）を統合。</p>
    <div class="panel">${hbars(byBank.slice(0,10).map(([k,v])=>({label:k,v})))}
    <div class="src">上位10件を表示。全${byBank.length}区分。</div></div>
  </section>
</div>

<div class="two">
  <section style="margin-top:30px"><h2><span class="dot"></span>仕入・仲介業者別</h2>
    <p class="lead">報告ログの業者②（仲介）優先、無ければ業者①（売主）。</p>
    <div class="panel">${hbars(bySeller.slice(0,8).map(([k,v])=>({label:k,v})))}</div>
  </section>
  <section style="margin-top:30px"><h2><span class="dot"></span>月別 報告件数</h2>
    <p class="lead">報告ログの投稿数。単位：件。</p>
    <div class="panel">${vbars(byMonth.map(([k,v])=>({label:k,short:k.slice(5)+'月',v})),{unit:'件'})}
    <div class="src">2026-03は3/22以降のみ、2026-08は8/21まで。</div></div>
  </section>
</div>

<section>
  <h2><span class="dot"></span>令和8年9月 パイプライン（${S9.jisha.length + S9.shibo.length}件）</h2>
  <p class="lead">最新月の利益管理ダッシュボードより。単位：万円。<b>確定は三原様の${n(S9.kakutei)}万円のみ</b>で、残りはステータス上まだ動いています。</p>
  <div class="panel">
    <div class="legend"><span><i style="background:var(--s1)"></i>自社案件</span><span><i style="background:var(--s2)"></i>私募債案件</span>
      <span class="mini">⭕️＝確定</span></div>
    ${(()=>{const all=[...S9.jisha.map(x=>({...x,grp:'自社'})),...S9.shibo.map(x=>({...x,grp:'私募債'}))].sort((a,b)=>b.rieki-a.rieki);
      const M=Math.max(...all.map(x=>x.rieki));
      return `<div class="hchart">${all.map(x=>`<div class="hrow" tabindex="0" data-tip="${esc(x.name)}（${esc(x.grp)}）｜利益 ${n(x.rieki)}万円・物件巾 ${n(x.haba)}万円${x.status&&x.status!=='—'?`・${esc(x.status)}`:''}${x.log?`　報告ログ：${esc(x.log)}`:'　報告ログに該当なし'}">
        <div class="hlab">${esc(x.name)}${x.fix?'<span class="grp" style="color:var(--good)">⭕️確定</span>':''}<span class="grp">${esc(x.grp)}</span></div>
        <div class="htrack"><div class="hfill" style="width:${(x.rieki/M*100).toFixed(1)}%;background:${x.grp==='自社'?'var(--s1)':'var(--s2)'}"></div></div>
        <div class="hval">${n(x.rieki)}<span class="hsub">万円</span></div></div>`).join('')}</div>`;})()}
    <div class="two" style="margin-top:16px">
      <div class="card"><div class="kpi"><div class="lab">自社 合計</div><div class="num">${n(S9.jishaTotal)}<small>万円</small></div><div class="note">${S9.jisha.length}件</div></div></div>
      <div class="card"><div class="kpi"><div class="lab">私募債 合計</div><div class="num">${n(S9.shiboTotal)}<small>万円</small></div><div class="note">${S9.shibo.length}件／合計利益の${(S9.shiboTotal/S9.total*100).toFixed(0)}%</div></div></div>
    </div>
    <div class="callout"><b>9件のうち${[...S9.jisha,...S9.shibo].filter(x=>x.log).length}件は、報告ログの案件がそのまま9月に着地したものです。</b>
      ${[...S9.jisha,...S9.shibo].filter(x=>x.log).map(x=>`${esc(x.name)}＝${esc(x.log)}`).join('／')}。
      報告ログ側で「金消契約」止まりに見えていた案件の多くは、実際には私募債案件として9月の利益に載っています。
      残る${[...S9.jisha,...S9.shibo].filter(x=>!x.log).length}件（木村様・富地様）は報告ログに対応する投稿がありません（木村様は愛知支社）。</div>
    <div class="src">出典：利益管理ダッシュボード（Martial Arts）令和8年9月。固定費 ${n(S9.kotei)}万円／月は同シートの記載値。</div>
  </div>
</section>

<section>
  <h2><span class="dot"></span>令和8年6月 案件別 利益内訳</h2>
  <p class="lead">利益表で案件単位の内訳が取れている唯一の月。合計 ${n(P.june.rieki)}万円（売上 ${n(P.june.uriage)}万円）。単位：万円。</p>
  <div class="panel">
    <div class="legend"><span><i style="background:var(--s1)"></i>自社案件</span><span><i style="background:var(--s2)"></i>私募債・リフォーム</span></div>
    <div class="hchart">${juneChart}</div>
    <div class="two" style="margin-top:16px">
      <div class="card"><div class="kpi"><div class="lab">自社案件 小計</div><div class="num">${n(P.june.jishaSub.rieki)}<small>万円</small></div>
        <div class="note">4件／融資 ${n(P.june.jishaSub.yushi)}万円・物件巾 ${n(P.june.jishaSub.haba)}万円</div></div></div>
      <div class="card"><div class="kpi"><div class="lab">私募債・リフォーム 小計</div><div class="num">${n(P.june.otherSub.rieki)}<small>万円</small></div>
        <div class="note">6件／私募債5件 ${n(952)}万円・リフォーム1件 ${n(171)}万円</div></div></div>
    </div>
    <div class="callout">利益の<b>${(P.june.otherSub.rieki/P.june.rieki*100).toFixed(0)}%が私募債・リフォーム</b>から出ています。自社不動産4件（${n(P.june.jishaSub.rieki)}万円）と拮抗しており、6月に限れば<b>不動産以外の収益が利益を支えた月</b>と読めます。</div>
    <div class="src">出典：利益表「令和8年6月 利益サマリー」。客名は原本表記（渡邉様＝報告ログの渡邊裕也、佐藤拓＝佐藤拓夢、綱川様＝綱川大悟、池田様＝池田好希、宮崎様＝宮﨑定規）。</div>
  </div>
</section>

<section>
  <h2><span class="dot"></span>顧客台帳サマリー（総顧客 ${n(P.ledger.total)}名）</h2>
  <p class="lead">利益表ブックの「顧客台帳サマリー（自動集計）」より。報告ログの${deals.length}案件は、この台帳の一部が動いている姿です。</p>
  <div class="two">
    <div class="panel"><div class="mini" style="font-weight:800;margin-bottom:9px">ランク別</div>
      ${hbars(P.ledger.rank.map(r=>({label:r.k,v:r.v,sub:`${r.p}%`})),{colorBy:(d,i)=>SEQ[[4,2,1,0][i]]})}
      <div class="src">S（契約・有力）51名に対し C（見込・追客）が271名＝${P.ledger.rank[3].p}%。母数の大半は追客フェーズ。</div></div>
    <div class="panel"><div class="mini" style="font-weight:800;margin-bottom:9px">ステータス・フラグ</div>
      ${hbars(P.ledger.status.map(s=>({label:s.k,v:s.v})),{colorBy:(d)=>({'契約済み':'var(--good)','否決':'var(--critical)','打ち切り':'var(--critical)','再アタック候補':'var(--warn)'})[d.label]||'var(--s1)'})}
      <div class="src">打ち切り49・否決23に対し、再アタック候補22が明示されています。</div></div>
  </div>
  <div class="two" style="margin-top:15px">
    <div class="panel"><div class="mini" style="font-weight:800;margin-bottom:9px">担当者別 関与件数（台帳ベース）</div>
      ${hbars(P.ledger.owner.map(o=>({label:o.k,v:o.v})),{colorBy:(d)=>d.label==='退職者'?'var(--critical)':'var(--s1)'})}
      <div class="src">最大が「退職者」85件。担当者不在の顧客が台帳の約26%を占め、再配分の対象になります。複数記載を含むため合計は総顧客数と一致しません。</div></div>
    <div class="panel"><div class="mini" style="font-weight:800;margin-bottom:9px">仕入業者別（記入あり ${P.ledger.supplierTotal}件）</div>
      ${hbars(P.ledger.supplier.map(s=>({label:s.k,v:s.v})))}
      <div class="src">台帳328名のうち仕入業者の記入は${P.ledger.supplierTotal}件のみ。</div></div>
  </div>
</section>

<section>
  <h2><span class="dot"></span>データ品質メモ</h2>
  <p class="lead">このボードを作る過程で見つかった、元データ側で直すべき点。</p>
  <div class="panel">
    <div class="two">
      <div>
        <div class="mini" style="font-weight:800">1. お客様名の表記ゆれ（同一人物・${FIX.length}組を統合）</div>
        <ul class="tight">${FIX.map(([a,b])=>`<li><code>${esc(a)}</code> → <b>${esc(b)}</b></li>`).join('')}</ul>
      </div>
      <div>
        <div class="mini" style="font-weight:800">2. 決済完了の報告が抜けている</div>
        <p class="mini">利益表では令和8年6月に決済済みの案件（綱川・池田・渡邉）に、報告ログの「決済完了」投稿がありません。<b>決済完了の報告を必須化</b>すれば、このボードは着地まで自動で追えます。</p>
        <div class="mini" style="font-weight:800;margin-top:11px">3. 項目の欠落・ラベル混入</div>
        <p class="mini">${missing}件の報告で金融機関または担当が空欄。また <code>:tada:</code> <code>:spiralnotepad:備考：</code> などSlackのテンプレート文字列が同行②・日時欄に流れ込んでおり、集計時に除去しています。報告フォーム側での入力位置の固定を推奨します。</p>
      </div>
    </div>
    <div class="callout"><b>示唆：</b>報告ログは「契約が取れた」までは丁寧に、「お金になった」の手前で途切れています。利益表とログを繋ぐ鍵は<b>お客様名の統一</b>と<b>決済完了の報告</b>の2点だけです。</div>
  </div>
</section>

<div class="panel" style="margin-top:26px;font-size:11.5px;color:var(--ink2)">
  <b>出典・注記</b>／① 営業報告ログ ${rows.length}件（2026-03-22〜${DATA_END}）。② ⭐️第6期目 利益表（担当：武田）＝月次推移サマリー・令和8年6月利益サマリー・顧客台帳サマリー。③ 利益管理ダッシュボード（Martial Arts）令和8年9月。金額は原本どおり<b>万円単位</b>。<br>
  経過日数は実日付ではなく<b>データ最終日 ${DATA_END}</b> を基準に算出しています（それ以降の報告は未反映）。件数は報告ログから機械的に導出した参考値で、会計上の確定値ではありません。<br>
  顧客台帳の年収・勤務先・預金額・与信履歴は個人情報のため、このボードには一切含めていません（集計値のみ利用）。
</div>
</div>
<div id="tip" role="status"></div>
<script>
(function(){
  var tip=document.getElementById('tip');
  function show(e,t){tip.textContent=t;tip.style.opacity='1';move(e);}
  function move(e){var x=(e.clientX||0)+14,y=(e.clientY||0)+16;
    var r=tip.getBoundingClientRect();
    if(x+r.width>innerWidth-8)x=innerWidth-r.width-8;
    if(y+r.height>innerHeight-8)y=(e.clientY||0)-r.height-12;
    tip.style.left=x+'px';tip.style.top=y+'px';}
  function hide(){tip.style.opacity='0';}
  document.addEventListener('mouseover',function(e){var t=e.target.closest('[data-tip]');if(t)show(e,t.dataset.tip);});
  document.addEventListener('mousemove',function(e){if(tip.style.opacity==='1')move(e);});
  document.addEventListener('mouseout',function(e){if(e.target.closest('[data-tip]'))hide();});
  document.addEventListener('focusin',function(e){var t=e.target.closest('[data-tip]');
    if(t){var r=t.getBoundingClientRect();show({clientX:r.left+r.width/2,clientY:r.top},t.dataset.tip);}});
  document.addEventListener('focusout',hide);

  var f=document.getElementById('filters'),tb=document.querySelector('#livetbl tbody');
  f.addEventListener('click',function(e){var b=e.target.closest('.fbtn');if(!b)return;
    [].forEach.call(f.querySelectorAll('.fbtn'),function(x){x.setAttribute('aria-pressed',String(x===b));});
    var k=b.dataset.f;
    [].forEach.call(tb.rows,function(r){r.hidden=!(k==='all'||r.dataset.alert===k);});});

  var th=document.querySelectorAll('#livetbl thead th'),dir={};
  [].forEach.call(th,function(h,i){h.addEventListener('click',function(){
    dir[i]=!dir[i];var rows=[].slice.call(tb.rows);
    rows.sort(function(a,b){
      var x=a.cells[i].textContent.trim(),y=b.cells[i].textContent.trim();
      var nx=parseFloat(x.replace(/[^0-9.-]/g,'')),ny=parseFloat(y.replace(/[^0-9.-]/g,''));
      var c=(!isNaN(nx)&&!isNaN(ny))?nx-ny:x.localeCompare(y,'ja');
      return dir[i]?c:-c;});
    rows.forEach(function(r){tb.appendChild(r);});});});
})();
</script>
</body></html>`;

fs.mkdirSync('out',{recursive:true});
fs.writeFileSync('out/案件進捗ボード.html', html);
console.log('written', html.length, 'bytes');
console.log('live', live.length, 'avgLead', avgLead, 'missing', missing);
console.log('alerts', JSON.stringify(['critical','warn','good'].map(l=>[l,live.filter(d=>alertOf(d)[0]===l).length])));
