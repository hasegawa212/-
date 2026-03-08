import { useState } from "react";

const DOW_JP = ["日", "月", "火", "水", "木", "金", "土"];
const getDoW = (year, month, day) => new Date(year, month - 1, day).getDay();

const MONTHS = [
  { label: "2月", year: 2026, month: 2, days: 28 },
  { label: "3月", year: 2026, month: 3, days: 31 },
];

const CATEGORIES = {
  customer: { label: "お客様対応", color: "#4f8ef7", bg: "#4f8ef720" },
  finance: { label: "金融機関", color: "#f0a020", bg: "#f0a02020" },
  settlement: { label: "仕入れ・決済", color: "#4cce90", bg: "#4cce9020" },
  utility: { label: "ライフライン", color: "#c084fc", bg: "#c084fc20" },
};

const MILESTONE_META = {
  "契約・本申込": { cat: "customer", icon: "📝" },
  "買付": { cat: "customer", icon: "🏠" },
  "内見": { cat: "customer", icon: "👁" },
  "金消": { cat: "finance", icon: "💴" },
  "金消・決済": { cat: "finance", icon: "💴" },
  "決済": { cat: "settlement", icon: "✅" },
  "事前審査開始": { cat: "finance", icon: "📋" },
  "本申込": { cat: "finance", icon: "📋" },
  "電気開通予約": { cat: "utility", icon: "⚡" },
  "水道手続き": { cat: "utility", icon: "💧" },
  "電気・水道開通": { cat: "utility", icon: "🔌" },
  "郵便・覚書": { cat: "settlement", icon: "📬" },
  "郵便・覚書済": { cat: "settlement", icon: "📬" },
};

const INIT_CUSTOMERS = [
  { name: "米川様", bank: "水戸信金", tantou: "", douko: "", milestones: [{ label: "事前審査開始", month: 2, day: 10 },{ label: "内見", month: 2, day: 15 },{ label: "郵便・覚書", month: 2, day: 20 },{ label: "買付", month: 2, day: 25 },{ label: "契約・本申込", month: 3, day: 5 },{ label: "電気開通予約", month: 3, day: 12 },{ label: "水道手続き", month: 3, day: 14 },{ label: "金消", month: 3, day: 20 }] },
  { name: "大和田様", bank: "水戸信金", tantou: "", douko: "", milestones: [{ label: "郵便・覚書済", month: 2, day: 8 },{ label: "電気・水道開通", month: 2, day: 18 },{ label: "金消・決済", month: 3, day: 3 }] },
  { name: "太田様", bank: "水戸信・東邦・常陽", tantou: "", douko: "", milestones: [{ label: "事前審査開始", month: 2, day: 5 },{ label: "郵便・覚書", month: 2, day: 12 },{ label: "買付", month: 2, day: 18 },{ label: "本申込", month: 2, day: 22 },{ label: "契約・本申込", month: 3, day: 3 },{ label: "電気開通予約", month: 3, day: 8 },{ label: "水道手続き", month: 3, day: 10 },{ label: "金消", month: 3, day: 25 }] },
  { name: "近江様", bank: "水戸信金", tantou: "", douko: "", milestones: [{ label: "内見", month: 2, day: 12 },{ label: "郵便・覚書", month: 2, day: 17 },{ label: "買付", month: 2, day: 22 },{ label: "契約・本申込", month: 3, day: 7 },{ label: "電気開通予約", month: 3, day: 15 },{ label: "水道手続き", month: 3, day: 17 },{ label: "金消", month: 3, day: 22 }] },
];

const dayIndex = (month, day) => (month === 2 ? day - 1 : 28 + day - 1);
const TOTAL_DAYS = 59;
const TODAY = { month: 3, day: 8 };
const TODAY_IDX = dayIndex(TODAY.month, TODAY.day);
const allDays = [];
for (let d = 1; d <= 28; d++) allDays.push({ month: 2, day: d, year: 2026 });
for (let d = 1; d <= 31; d++) allDays.push({ month: 3, day: d, year: 2026 });

export default function App() {
  const [customers, setCustomers] = useState(INIT_CUSTOMERS);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState("gantt");

  const updateField = (idx, field, val) => {
    setCustomers(prev => prev.map((c, i) => i === idx ? { ...c, [field]: val } : c));
  };

  return (
    <div style={{ fontFamily:"'Noto Sans JP','Hiragino Sans',sans-serif", background:"#0b0e1a", minHeight:"100vh", color:"#e8eaf0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { height:6px; width:6px; }
        ::-webkit-scrollbar-track { background:#1a1f30; }
        ::-webkit-scrollbar-thumb { background:#3a4060; border-radius:3px; }
        .ms-tag { position:absolute; top:50%; transform:translateY(-50%); cursor:pointer; transition:all 0.15s; z-index:10; }
        .ms-tag:hover { transform:translateY(-50%) scale(1.18); z-index:20; filter:brightness(1.35); }
        .day-col:hover { background:rgba(255,255,255,0.05)!important; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .fade-up { animation:fadeUp 0.3s ease forwards; }
        .btn-v { padding:7px 18px; border:none; cursor:pointer; font-size:13px; font-weight:500; transition:all 0.15s; background:transparent; color:#8090b0; }
        .btn-v.active { background:#f0a020; color:#0b0e1a; font-weight:700; }
        .inline-input {
          background: transparent; border: none;
          border-bottom: 1px dashed #2a3560;
          color: #a0b0d0; font-size: 10px; font-family: inherit;
          width: 100%; outline: none; padding: 1px 2px;
          transition: border-color 0.15s, color 0.15s, background 0.15s;
        }
        .inline-input::placeholder { color: #252e50; }
        .inline-input:focus { border-bottom-color: #f0a020; color: #e8eaf0; background: #0d1326; border-radius: 3px 3px 0 0; }
        .inline-input:hover:not(:focus) { border-bottom-color: #3a4a70; }
      `}</style>

      <div style={{ background:"linear-gradient(135deg,#0f1220,#1a2040)", borderBottom:"1px solid #2a3050", padding:"18px 28px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:38, height:38, borderRadius:10, background:"linear-gradient(135deg,#f0a020,#e05010)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>📅</div>
          <div>
            <div style={{ fontSize:17, fontWeight:700, letterSpacing:"0.04em" }}>お客様スケジュール管理</div>
            <div style={{ fontSize:11, color:"#5060a0", marginTop:2 }}>2026年 2月〜3月 ／ 4名</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <div style={{ background:"#ff475718", border:"1px solid #ff4757", color:"#ff4757", padding:"4px 12px", borderRadius:20, fontSize:12, fontWeight:600 }}>📍 今日 3/8（日）</div>
          <div style={{ display:"flex", background:"#1a2040", border:"1px solid #2a3050", borderRadius:8, overflow:"hidden" }}>
            <button className={`btn-v${view==="gantt"?" active":""}`} onClick={()=>setView("gantt")}>ガント</button>
            <button className={`btn-v${view==="card"?" active":""}`} onClick={()=>setView("card")}>カード</button>
          </div>
        </div>
      </div>

      {view==="gantt"
        ? <GanttView customers={customers} updateField={updateField} setSelected={setSelected} />
        : <CardView customers={customers} setSelected={setSelected} />
      }

      <div style={{ padding:"14px 28px", display:"flex", gap:20, flexWrap:"wrap", alignItems:"center", borderTop:"1px solid #1a2040", background:"#0d1020" }}>
        <span style={{ fontSize:11, color:"#4060a0", fontWeight:700, letterSpacing:"0.08em" }}>凡例</span>
        {Object.entries(CATEGORIES).map(([k,v])=>(
          <div key={k} style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:10, height:10, borderRadius:3, background:v.color }}/>
            <span style={{ fontSize:11, color:"#7080a0" }}>{v.label}</span>
          </div>
        ))}
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ width:2, height:14, background:"#ff4757", borderRadius:1 }}/>
          <span style={{ fontSize:11, color:"#7080a0" }}>今日</span>
        </div>
      </div>

      {selected !== null && (
        <div onClick={()=>setSelected(null)} style={{ position:"fixed", inset:0, background:"#00000072", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200 }}>
          <div onClick={e=>e.stopPropagation()} className="fade-up" style={{ background:"linear-gradient(135deg,#171d35,#1e2645)", border:"1px solid #3a4060", borderRadius:18, padding:"28px 32px", minWidth:340, maxWidth:430, boxShadow:"0 28px 70px #0009" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:18 }}>
              <div>
                <div style={{ fontSize:20, fontWeight:700 }}>{customers[selected].name}</div>
                <div style={{ fontSize:12, color:"#6070a0", marginTop:4 }}>🏦 {customers[selected].bank}</div>
                <div style={{ display:"flex", gap:16, marginTop:8 }}>
                  <div style={{ fontSize:11 }}><span style={{ color:"#3a4a6a", marginRight:4 }}>担当者</span><span style={{ color:customers[selected].tantou?"#c0d0f0":"#2a3550" }}>{customers[selected].tantou||"未入力"}</span></div>
                  <div style={{ fontSize:11 }}><span style={{ color:"#3a4a6a", marginRight:4 }}>同行者</span><span style={{ color:customers[selected].douko?"#c0d0f0":"#2a3550" }}>{customers[selected].douko||"未入力"}</span></div>
                </div>
              </div>
              <button onClick={()=>setSelected(null)} style={{ background:"transparent", border:"none", color:"#6070a0", cursor:"pointer", fontSize:22 }}>✕</button>
            </div>
            <div style={{ borderTop:"1px solid #2a3050", paddingTop:16 }}>
              <div style={{ fontSize:11, color:"#5060a0", marginBottom:12, fontWeight:700, letterSpacing:"0.08em" }}>マイルストーン一覧</div>
              <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                {customers[selected].milestones.map((m,i)=>{
                  const info=MILESTONE_META[m.label]||{cat:"customer",icon:"●"};
                  const cat=CATEGORIES[info.cat];
                  const isDone=dayIndex(m.month,m.day)<TODAY_IDX;
                  return(
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:10, background:cat.bg, border:`1px solid ${cat.color}30`, borderRadius:9, padding:"8px 12px", opacity:isDone?0.55:1 }}>
                      <span style={{ fontSize:15 }}>{info.icon}</span>
                      <div style={{ flex:1 }}><div style={{ fontSize:13, fontWeight:600, color:cat.color }}>{m.label}</div></div>
                      <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                        {isDone&&<span style={{ fontSize:10, color:"#4cce90" }}>✓</span>}
                        <div style={{ fontSize:12, color:"#c0d0f0", fontWeight:700, background:"#0b0e1a40", padding:"2px 8px", borderRadius:6 }}>{m.month}月{m.day}日</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GanttView({ customers, updateField, setSelected }) {
  const COL_W=34, ROW_H=90, LABEL_W=210;
  return (
    <div style={{ overflowX:"auto" }}>
      <div style={{ minWidth:LABEL_W+TOTAL_DAYS*COL_W+32 }}>
        <div style={{ position:"sticky", top:77, zIndex:50, background:"#0b0e1a", borderBottom:"1px solid #2a3050" }}>
          <div style={{ display:"flex" }}>
            <div style={{ width:LABEL_W, flexShrink:0, borderRight:"1px solid #2a3050" }}/>
            {MONTHS.map(m=>(
              <div key={m.label} style={{ width:m.days*COL_W, flexShrink:0, padding:"7px 0", textAlign:"center", fontSize:13, fontWeight:700, color:"#f0a020", background:"#0f1220", borderRight:"2px solid #2a3050", letterSpacing:"0.08em" }}>
                {m.year}年 {m.label}
              </div>
            ))}
          </div>
          <div style={{ display:"flex" }}>
            <div style={{ width:LABEL_W, flexShrink:0, borderRight:"1px solid #2a3050" }}/>
            {allDays.map((d,i)=>{
              const dow=getDoW(d.year,d.month,d.day);
              const isToday=d.month===TODAY.month&&d.day===TODAY.day;
              const isWknd=dow===0||dow===6;
              const isLast=(d.month===2&&d.day===28)||(d.month===3&&d.day===31);
              return(
                <div key={i} style={{ width:COL_W, flexShrink:0, textAlign:"center", padding:"4px 0", borderRight:isLast?"2px solid #3a4060":"1px solid #1a2440", background:isToday?"#ff475720":isWknd?"#ffffff06":"transparent" }}>
                  <div style={{ fontSize:10, color:isToday?"#ff4757":dow===0?"#ff6b6b80":dow===6?"#6baeff80":"#3a4060", fontWeight:isToday?800:400 }}>{d.day}</div>
                  <div style={{ fontSize:9, color:isToday?"#ff4757":dow===0?"#ff6b6b50":dow===6?"#6baeff50":"#1e2640" }}>{DOW_JP[dow]}</div>
                </div>
              );
            })}
          </div>
        </div>
        {customers.map((c,ci)=>(
          <div key={ci} style={{ display:"flex", borderBottom:"1px solid #141828", height:ROW_H, position:"relative" }}>
            <div style={{ width:LABEL_W, flexShrink:0, borderRight:"1px solid #2a3050", display:"flex", flexDirection:"column", justifyContent:"center", padding:"8px 14px", gap:4, background:"#0d1020", position:"sticky", left:0, zIndex:20 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div style={{ fontSize:14, fontWeight:700 }}>{c.name}</div>
                <div onClick={()=>setSelected(ci)} style={{ fontSize:9, color:"#f0a02060", cursor:"pointer", textDecoration:"underline", textUnderlineOffset:2 }}>詳細 →</div>
              </div>
              <div style={{ fontSize:9, color:"#304060" }}>🏦 {c.bank}</div>
              <div style={{ display:"flex", gap:8, marginTop:2 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:8, color:"#2e3a5a", marginBottom:2, letterSpacing:"0.06em", fontWeight:600 }}>担当者</div>
                  <input className="inline-input" value={c.tantou} onChange={e=>updateField(ci,"tantou",e.target.value)} placeholder="名前を入力" onClick={e=>e.stopPropagation()} />
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:8, color:"#2e3a5a", marginBottom:2, letterSpacing:"0.06em", fontWeight:600 }}>同行者</div>
                  <input className="inline-input" value={c.douko} onChange={e=>updateField(ci,"douko",e.target.value)} placeholder="名前を入力" onClick={e=>e.stopPropagation()} />
                </div>
              </div>
            </div>
            <div style={{ display:"flex", flex:1, position:"relative" }}>
              {allDays.map((d,i)=>{
                const dow=getDoW(d.year,d.month,d.day);
                const isToday=d.month===TODAY.month&&d.day===TODAY.day;
                const isLast=(d.month===2&&d.day===28);
                return <div key={i} className="day-col" style={{ width:COL_W, flexShrink:0, height:"100%", borderRight:isLast?"2px solid #1e2840":"1px solid #131828", background:isToday?"#ff47571a":(dow===0||dow===6)?"#ffffff05":"transparent" }}/>;
              })}
              <div style={{ position:"absolute", top:0, bottom:0, left:(TODAY_IDX+0.5)*COL_W, width:2, background:"#ff4757", zIndex:5, pointerEvents:"none" }}/>
              {c.milestones.map((m,mi)=>{
                const idx=dayIndex(m.month,m.day);
                const info=MILESTONE_META[m.label]||{cat:"customer",icon:"●"};
                const cat=CATEGORIES[info.cat];
                const isDone=idx<TODAY_IDX;
                return(
                  <div key={mi} className="ms-tag" onClick={()=>setSelected(ci)} title={`${m.label}：${m.month}月${m.day}日`}
                    style={{ left:idx*COL_W+COL_W/2-13, width:26, height:26, display:"flex", alignItems:"center", justifyContent:"center", background:isDone?"#1a2040":cat.bg, border:`1.5px solid ${isDone?"#2a3050":cat.color}`, borderRadius:7, fontSize:13, boxShadow:isDone?"none":`0 2px 10px ${cat.color}40`, opacity:isDone?0.4:1 }}>
                    {info.icon}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div style={{ height:24 }}/>
      </div>
    </div>
  );
}

function CardView({ customers, setSelected }) {
  return (
    <div style={{ padding:"24px 28px", display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:18 }}>
      {customers.map((c,i)=>{
        const done=c.milestones.filter(m=>dayIndex(m.month,m.day)<TODAY_IDX);
        const upcoming=[...c.milestones].filter(m=>dayIndex(m.month,m.day)>=TODAY_IDX).sort((a,b)=>dayIndex(a.month,a.day)-dayIndex(b.month,b.day));
        const pct=Math.round((done.length/c.milestones.length)*100);
        return(
          <div key={i} className="fade-up" onClick={()=>setSelected(i)}
            style={{ background:"linear-gradient(135deg,#141830,#1a2042)", border:"1px solid #2a3050", borderRadius:16, overflow:"hidden", cursor:"pointer", transition:"transform 0.15s,border-color 0.15s", animationDelay:`${i*0.08}s`, opacity:0 }}
            onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.borderColor="#3a4570"}}
            onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.borderColor="#2a3050"}}>
            <div style={{ padding:"18px 20px 14px", background:"linear-gradient(135deg,#1c2240,#222a50)", borderBottom:"1px solid #2a3050" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ fontSize:18, fontWeight:700 }}>{c.name}</div>
                <div style={{ background:"#f0a02015", border:"1px solid #f0a02040", color:"#f0a020", fontSize:11, padding:"3px 10px", borderRadius:20 }}>{pct}%</div>
              </div>
              <div style={{ fontSize:11, color:"#4060a0", marginTop:3 }}>🏦 {c.bank}</div>
              <div style={{ display:"flex", gap:14, marginTop:7 }}>
                <div style={{ fontSize:10 }}><span style={{ color:"#2e3a5a", marginRight:3 }}>担当</span><span style={{ color:c.tantou?"#a0b4d0":"#222a44" }}>{c.tantou||"—"}</span></div>
                <div style={{ fontSize:10 }}><span style={{ color:"#2e3a5a", marginRight:3 }}>同行</span><span style={{ color:c.douko?"#a0b4d0":"#222a44" }}>{c.douko||"—"}</span></div>
              </div>
              <div style={{ marginTop:10, height:4, background:"#1a2040", borderRadius:2 }}>
                <div style={{ height:"100%", borderRadius:2, width:`${pct}%`, background:"linear-gradient(90deg,#4f8ef7,#f0a020)" }}/>
              </div>
              <div style={{ fontSize:10, color:"#4060a0", marginTop:5 }}>{done.length} / {c.milestones.length} 完了</div>
            </div>
            <div style={{ padding:"14px 20px" }}>
              {upcoming.slice(0,4).map((m,mi)=>{
                const info=MILESTONE_META[m.label]||{cat:"customer",icon:"●"};
                const cat=CATEGORIES[info.cat];
                const diff=dayIndex(m.month,m.day)-TODAY_IDX;
                return(
                  <div key={mi} style={{ display:"flex", alignItems:"center", gap:9, padding:"8px 0", borderBottom:mi<Math.min(upcoming.length,4)-1?"1px solid #1a2440":"none" }}>
                    <div style={{ width:28, height:28, borderRadius:7, background:cat.bg, border:`1px solid ${cat.color}40`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, flexShrink:0 }}>{info.icon}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:cat.color }}>{m.label}</div>
                      <div style={{ fontSize:11, color:"#4060a0" }}>{m.month}月{m.day}日</div>
                    </div>
                    <div style={{ fontSize:11, fontWeight:700, color:diff<=3?"#ff4757":diff<=7?"#f0a020":"#4f8ef7", background:diff<=3?"#ff475718":diff<=7?"#f0a02018":"#4f8ef718", padding:"2px 8px", borderRadius:10 }}>
                      {diff===0?"今日":diff===1?"明日":`あと${diff}日`}
                    </div>
                  </div>
                );
              })}
              {upcoming.length===0&&<div style={{ textAlign:"center", color:"#4cce90", padding:"10px 0", fontSize:13 }}>✅ 全ステップ完了</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
