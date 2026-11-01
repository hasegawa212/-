#!/usr/bin/env python3
# 立候補パック（営業部）を「本体（10ページ）＋最新の別紙」から毎回組み直す。何度実行しても同じページ数になる
import os, sys
import pypdf

d = os.path.join(os.path.dirname(__file__), "..", "..", "経営管理", "05_人事・労務", "評価・教育")
base = os.path.join(d, "立候補パック_営業部_本体.pdf")
extra = os.path.join(d, "立候補シート_別紙_席ごとのやること.pdf")
out = os.path.join(d, "立候補パック_営業部.pdf")

w = pypdf.PdfWriter()
n = 0
for f in (base, extra):
    pages = pypdf.PdfReader(f).pages
    n += len(pages)
    for p in pages:
        w.add_page(p)
with open(out, "wb") as fh:
    w.write(fh)
got = len(pypdf.PdfReader(out).pages)
assert got == n, (got, n)
print(f"wrote {out}（{got}ページ＝本体＋別紙）", file=sys.stderr)
