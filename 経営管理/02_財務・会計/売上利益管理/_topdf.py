# 整形済みワークブックを同じ業務テーマのPDF（A4横）に変換する。
# LibreOfficeがこの環境で使えないため reportlab で描画する。
import sys, re, openpyxl
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Table, TableStyle,
                                Paragraph, Spacer, PageBreak)
from reportlab.lib.styles import ParagraphStyle

pdfmetrics.registerFont(TTFont("JP", "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf"))

NAVY  = colors.HexColor("#1F3A5F")
NAVYD = colors.HexColor("#16293F")
GOLD  = colors.HexColor("#C8A24B")
BAND  = colors.HexColor("#EEF3FA")
GRID  = colors.HexColor("#D7DEE8")
TXT   = colors.HexColor("#1A2433")
GREEN = colors.HexColor("#1E7B45")
AMBER = colors.HexColor("#B5740F")
EMOJI = re.compile("[\U0001F000-\U0001FAFF☀-➿️\U0001F1E6-\U0001F1FF]")

def clean(s):
    return EMOJI.sub("", str(s)).strip() if s is not None else ""

st_cell = ParagraphStyle("c", fontName="JP", fontSize=7.4, leading=9, textColor=TXT)
st_num  = ParagraphStyle("n", fontName="JP", fontSize=7.4, leading=9, textColor=TXT, alignment=2)
st_hdr  = ParagraphStyle("h", fontName="JP", fontSize=7.8, leading=9.5, textColor=colors.white, alignment=1)
st_c1   = ParagraphStyle("c1", fontName="JP", fontSize=7.4, leading=9, textColor=TXT, alignment=1)
st_title= ParagraphStyle("t", fontName="JP", fontSize=13, leading=16, textColor=colors.white)

NUMKEY = ["万","件数","率","比","順位","累計","合計","売上","利益","粗利","歩合","原価","値","価格","金額"]
def is_num(h): return any(k in str(h) for k in NUMKEY)
def is_pct(h): return ("率" in str(h)) or ("比" in str(h))
def cw(s): return sum(2 if ord(c)>0x2E7F else 1 for c in str(s))

def find_rows(ws):
    tr=hr=None
    for r in range(1,min(ws.max_row,14)+1):
        ne=[ws.cell(r,c).value for c in range(1,ws.max_column+1) if ws.cell(r,c).value not in (None,"")]
        if not ne: continue
        if tr is None and len(ne)==1: tr=r; continue
        if hr is None and len(ne)>=2: hr=r; break
    return tr,hr

def status_color(v):
    s=str(v)
    if any(k in s for k in ("確定","入金済","完了","計上")): return GREEN
    if any(k in s for k in ("進行中","未","予定")): return AMBER
    return None

RED = colors.HexColor("#C0392B")
TOTBG = colors.HexColor("#DCE5F4")
TOTAL_RE = re.compile(r"(合計|総計|小計|計$|期計|累計計|全体)")
def is_total(ws,r,ncol):
    for c in range(1,min(ncol,3)+1):
        v=ws.cell(r,c).value
        if v not in (None,"") and TOTAL_RE.search(str(v)): return True
    return False

def pstyle(base, color):
    return ParagraphStyle("x", parent=base, textColor=color)

def sheet_flow(ws, page_w):
    tr,hr=find_rows(ws)
    if hr is None: return []
    ncol=ws.max_column; nrow=ws.max_row
    headers=[ws.cell(hr,c).value for c in range(1,ncol+1)]
    # widths from content
    raw=[cw(clean(headers[c-1])) for c in range(1,ncol+1)]
    for c in range(1,ncol+1):
        m=raw[c-1]
        for r in range(hr+1,nrow+1):
            m=max(m, cw(ws.cell(r,c).value))
        long_text=any(k in str(headers[c-1]) for k in ("顧客","備考","説明","銀行","売主","金融","次回","内容","主要"))
        raw[c-1]=min(m, 46 if long_text else 16)
    tot=sum(raw) or 1
    widths=[max(page_w*x/tot, 10*mm) for x in raw]
    # scale to fit
    s=sum(widths)
    if s>page_w: widths=[w*page_w/s for w in widths]

    data=[]; total_rows=[]
    # header
    data.append([Paragraph(clean(h), st_hdr) for h in headers])
    for ri,r in enumerate(range(hr+1,nrow+1)):
        tot=is_total(ws,r,ncol)
        if tot: total_rows.append(ri+1)  # +1: ヘッダー行ぶん
        row=[]
        for c in range(1,ncol+1):
            v=ws.cell(r,c).value
            h=headers[c-1]
            emph = NAVYD if tot else None
            if isinstance(v,(int,float)) and is_pct(h):
                row.append(Paragraph(f"{v*100:.1f}%", pstyle(st_num, RED if v<0 else (emph or TXT))))
            elif isinstance(v,(int,float)) and is_num(h):
                row.append(Paragraph(f"{v:,.0f}", pstyle(st_num, RED if v<0 else (emph or TXT))))
            else:
                sc=status_color(v)
                if sc is not None:
                    row.append(Paragraph(str(v), ParagraphStyle("s",parent=st_cell,textColor=sc,alignment=1)))
                else:
                    stl = st_c1 if c==1 else st_cell
                    row.append(Paragraph("" if v in (None,) else str(v),
                               pstyle(stl, emph) if emph else stl))
        data.append(row)
    t=Table(data, colWidths=widths, repeatRows=1)
    ts=[("BACKGROUND",(0,0),(-1,0),NAVY),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
        ("TOPPADDING",(0,0),(-1,-1),2.5),("BOTTOMPADDING",(0,0),(-1,-1),2.5),
        ("LEFTPADDING",(0,0),(-1,-1),4),("RIGHTPADDING",(0,0),(-1,-1),4),
        ("LINEBELOW",(0,0),(-1,0),1.2,GOLD),
        ("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white,BAND]),
        ("GRID",(0,0),(-1,-1),0.4,GRID),
        ("LINEABOVE",(0,0),(-1,0),0,NAVY)]
    for tr_i in total_rows:
        ts.append(("BACKGROUND",(0,tr_i),(-1,tr_i),TOTBG))
        ts.append(("LINEABOVE",(0,tr_i),(-1,tr_i),1.0,NAVY))
    t.setStyle(TableStyle(ts))
    flow=[]
    if tr is not None:
        bar=Table([[Paragraph(clean(ws.cell(tr,1).value), st_title)]], colWidths=[page_w])
        bar.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),NAVYD),
            ("LEFTPADDING",(0,0),(-1,-1),8),("TOPPADDING",(0,0),(-1,-1),5),
            ("BOTTOMPADDING",(0,0),(-1,-1),5),("LINEBELOW",(0,0),(-1,-1),2,GOLD)]))
        flow.append(bar); flow.append(Spacer(1,4))
    flow.append(t)
    return flow

def build(xlsx, pdf):
    wb=openpyxl.load_workbook(xlsx)
    PW,PH=landscape(A4)
    m=10*mm; fw=PW-2*m
    doc=BaseDocTemplate(pdf, pagesize=landscape(A4),
                        leftMargin=m,rightMargin=m,topMargin=m,bottomMargin=m)
    frame=Frame(m,m,fw,PH-2*m,id="f",leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)
    def footer(c,d):
        c.setFont("JP",7); c.setFillColor(colors.HexColor("#8895A7"))
        c.drawRightString(PW-m, m-5, f"株式会社Martial Arts｜売上利益管理　-　{d.page}")
    doc.addPageTemplates([PageTemplate(id="p",frames=[frame],onPage=footer)])
    story=[]
    sheets=wb.worksheets
    for i,ws in enumerate(sheets):
        story+=sheet_flow(ws, fw)
        if i!=len(sheets)-1: story.append(PageBreak())
    doc.build(story)
    print("pdf:",pdf)

if __name__=="__main__":
    build(sys.argv[1], sys.argv[2])
