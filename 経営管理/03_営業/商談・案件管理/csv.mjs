import fs from 'node:fs';
const { rows, deals, DATA_END } = JSON.parse(fs.readFileSync('deals.json','utf8'));
const q = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
const LBL = ['','事前承認','契約完了','本承認','金消契約','決済完了','案件完了'];

const H1 = ['No','日付','報告種別','ステージ','お客様名','原本表記','売主業者','仲介業者','金融機関','担当','同行①','同行②','次回予定','予定日時','報告者','備考'];
const l1 = [H1.join(',')].concat(rows.map(r=>[r.no,r.date,r.kind,LBL[r.stage]||'',r.customer,
  r.rawCustomer===r.customer?'':r.rawCustomer,r.seller,r.broker,r.bank,r.owner,r.join1,r.join2,
  r.next,r.nextAt,r.reporter,r.note].map(q).join(','))).join('\n');
fs.writeFileSync('out/2026-09-14_営業報告ログ_正規化.csv','﻿'+l1+'\n');

const H2 = ['案件ID','お客様名','案件番号','最終ステージ','担当','金融機関','売主業者','仲介業者',
  '初回報告','最終報告','報告数','リードタイム(日)','最終報告からの経過(日)','完了','次回予定','予定日時'];
const l2 = [H2.join(',')].concat([...deals].sort((a,b)=>a.first.localeCompare(b.first)).map(d=>
  [d.id,d.customer,d.seq,d.stageLabel,d.owner,d.bank,d.seller,d.broker,d.first,d.last,
   d.reportCount,d.leadDays,d.idleDays,d.done?'完了':'稼働中',d.next,d.nextAt].map(q).join(','))).join('\n');
fs.writeFileSync('out/2026-09-14_案件一覧.csv','﻿'+l2+'\n');
console.log('csv written / 基準日', DATA_END);
