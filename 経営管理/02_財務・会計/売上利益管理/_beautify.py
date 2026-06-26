# 売上利益ブックを業務用デザインに一括整形するスタイラー
# 既存データは変更せず、見た目（配色・行縞・桁区切り・列幅・固定）だけを整える。
import sys, openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

NAVY   = "1F3A5F"
NAVY_D = "16293F"
ACCENT = "C8A24B"
BAND   = "EEF3FA"
WHITE  = "FFFFFF"
GRID   = "D7DEE8"
TXT    = "1A2433"
GREEN  = "1E7B45"
AMBER  = "B5740F"

thin = Side(style="thin", color=GRID)
BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)

def cjk_w(s):
    s = "" if s is None else str(s)
    return sum(2 if ord(c) > 0x2E7F else 1 for c in s)

def is_num_col(h):
    h = str(h or "")
    keys = ["万", "件数", "率", "比", "順位", "価格", "金額", "累計", "合計", "売上", "利益", "粗利", "歩合", "原価", "値"]
    return any(k in h for k in keys)

def is_pct_col(h):
    h = str(h or "")
    return ("率" in h) or ("比" in h)

def find_rows(ws):
    title_r = None; hdr_r = None
    for r in range(1, min(ws.max_row, 14) + 1):
        vals = [ws.cell(r, c).value for c in range(1, ws.max_column + 1)]
        ne = [v for v in vals if v not in (None, "")]
        if not ne:
            continue
        if title_r is None and len(ne) == 1:
            title_r = r; continue
        if hdr_r is None and len(ne) >= 2:
            hdr_r = r; break
    return title_r, hdr_r

def beautify_sheet(ws):
    title_r, hdr_r = find_rows(ws)
    if hdr_r is None:
        return
    ncol = ws.max_column
    nrow = ws.max_row
    ws.sheet_view.showGridLines = False

    if title_r is not None:
        tc = ws.cell(title_r, 1)
        tc.font = Font(name="Yu Gothic", size=15, bold=True, color=NAVY_D)
        tc.alignment = Alignment(horizontal="left", vertical="center")
        ws.row_dimensions[title_r].height = 30
        try:
            ws.merge_cells(start_row=title_r, start_column=1, end_row=title_r, end_column=ncol)
        except Exception:
            pass
        for c in range(1, ncol + 1):
            ws.cell(title_r, c).border = Border(bottom=Side(style="medium", color=ACCENT))

    headers = {}
    for c in range(1, ncol + 1):
        cell = ws.cell(hdr_r, c)
        headers[c] = cell.value
        cell.fill = PatternFill("solid", fgColor=NAVY)
        cell.font = Font(name="Yu Gothic", size=11, bold=True, color=WHITE)
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = BORDER
    ws.row_dimensions[hdr_r].height = 30

    for r in range(hdr_r + 1, nrow + 1):
        band = (r - hdr_r) % 2 == 0
        for c in range(1, ncol + 1):
            cell = ws.cell(r, c)
            h = headers.get(c)
            cell.border = BORDER
            if band:
                cell.fill = PatternFill("solid", fgColor=BAND)
            num = is_num_col(h) and isinstance(cell.value, (int, float))
            cell.alignment = Alignment(
                horizontal="right" if num else ("center" if c == 1 else "left"),
                vertical="center", wrap_text=False,
            )
            color = TXT
            v = str(cell.value or "")
            if any(k in v for k in ("確定", "入金済", "完了", "計上")):
                color = GREEN
            elif any(k in v for k in ("進行中", "未", "予定")):
                color = AMBER
            cell.font = Font(name="Yu Gothic", size=10, color=color, bold=(c == 1 and h == "順位"))
            if num and is_pct_col(h):
                cell.number_format = "0.0%"
            elif num:
                cell.number_format = "#,##0"

    for c in range(1, ncol + 1):
        w = cjk_w(headers.get(c))
        for r in range(hdr_r + 1, min(nrow, hdr_r + 400) + 1):
            w = max(w, cjk_w(ws.cell(r, c).value))
        long_text = any(k in str(headers.get(c) or "") for k in ("顧客", "備考", "説明", "銀行", "売主", "金融", "次回", "内容", "主要"))
        cap = 46 if long_text else 22
        ws.column_dimensions[get_column_letter(c)].width = min(max(w * 0.62 + 3, 7), cap)
        if long_text:
            for r in range(hdr_r + 1, nrow + 1):
                ws.cell(r, c).alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)

    ws.freeze_panes = ws.cell(hdr_r + 1, 1).coordinate

def main(path):
    wb = openpyxl.load_workbook(path)
    palette = ["1F3A5F", "2E6B4F", "7A4E1E", "5B3A6B", "1E5A6B", "6B1E3A"]
    for i, ws in enumerate(wb.worksheets):
        beautify_sheet(ws)
        ws.sheet_properties.tabColor = palette[i % len(palette)]
    wb.save(path)
    print("styled:", path, "->", wb.sheetnames)

if __name__ == "__main__":
    for p in sys.argv[1:]:
        main(p)
