"""テレアポ管理シート 統計分析スクリプト

PII（氏名・電話・住所・メール・備考フリーテキスト）は一切出力しません。
件数・分布・効率指標・滞留分析のみを集計し、Markdown レポートを生成します。

実行: python3 経営管理/09_資料・アーカイブ/分析/telapo_stats.py
出力: 経営管理/09_資料・アーカイブ/分析/レポート_YYYY-MM-DD.md
"""

from __future__ import annotations

import csv
import datetime as dt
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "テレアポ管理シート.csv"
OUT_DIR = Path(__file__).resolve().parent
TODAY = dt.date.today()


def parse_date(s: str) -> dt.date | None:
    s = (s or "").strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%m/%d", "%m月%d日"):
        try:
            d = dt.datetime.strptime(s, fmt).date()
            if fmt in ("%m/%d", "%m月%d日"):
                d = d.replace(year=TODAY.year)
            return d
        except ValueError:
            continue
    return None


def main() -> None:
    with SOURCE.open(encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    total = len(rows)

    # 優先度
    priority = Counter(r["優先度"].strip() or "(未設定)" for r in rows)

    # 架電ステータス
    status = Counter(r["架電ステータス"].strip() or "(未架電)" for r in rows)

    # 年収帯
    income = Counter(r["年収"].strip() or "(未回答)" for r in rows)

    # 勤続年数
    tenure = Counter(r["勤続年数"].strip() or "(未回答)" for r in rows)

    # 貯蓄額
    savings = Counter(r["貯蓄額"].strip() or "(未回答)" for r in rows)

    # 不動産所有
    real_estate = Counter(r["不動産所有"].strip() or "(未回答)" for r in rows)

    # 投資経験
    investment = Counter(r["投資経験"].strip() or "(未回答)" for r in rows)

    # 面談希望
    meeting_wish = Counter(r["面談希望"].strip() or "(未回答)" for r in rows)

    # 担当者（個人名ではなく社員コードの匿名化）
    staff_raw = [r["担当者"].strip() for r in rows if r["担当者"].strip()]
    staff_unique = sorted(set(staff_raw))
    staff_map = {name: f"STAFF-{chr(65 + i)}" for i, name in enumerate(staff_unique)}
    staff_counter = Counter(staff_map[n] for n in staff_raw)

    # ファネル
    has_call_1 = sum(1 for r in rows if r["架電日1"].strip() or r["架電結果1"].strip())
    has_call_2 = sum(1 for r in rows if r["架電日2"].strip() or r["架電結果2"].strip())
    has_call_3 = sum(1 for r in rows if r["架電日3"].strip() or r["架電結果3"].strip())
    has_apo = sum(1 for r in rows if r["アポ日時"].strip())

    # ステータスから推定したコンタクト実施件数（架電日列が未入力でもステータス更新があるケース）
    contacted_by_status = sum(
        1
        for r in rows
        if r["架電ステータス"].strip()
        and r["架電ステータス"].strip() not in {"(未架電)", "次回架電予定"}
    )
    scheduled_next = sum(1 for r in rows if r["架電ステータス"].strip() == "次回架電予定")

    # 架電結果（成果）
    result_1 = Counter(r["架電結果1"].strip() for r in rows if r["架電結果1"].strip())
    result_2 = Counter(r["架電結果2"].strip() for r in rows if r["架電結果2"].strip())
    result_3 = Counter(r["架電結果3"].strip() for r in rows if r["架電結果3"].strip())

    # 問合せからの経過日数（滞留分析）
    age_buckets = Counter()
    untouched_stale = 0
    for r in rows:
        d = parse_date(r["問合せ日"])
        if not d:
            age_buckets["(日付不明)"] += 1
            continue
        days = (TODAY - d).days
        if days < 7:
            age_buckets["0-6 日"] += 1
        elif days < 14:
            age_buckets["7-13 日"] += 1
        elif days < 30:
            age_buckets["14-29 日"] += 1
        elif days < 60:
            age_buckets["30-59 日"] += 1
        else:
            age_buckets["60 日 〜"] += 1
        # 14 日以上 & 1 度も架電していない = アラート
        if days >= 14 and not r["架電日1"].strip():
            untouched_stale += 1

    # ハイインテント（A 優先度 + 面談希望「はい、面談を希望します。」+ 年収 700+）
    high_intent = 0
    for r in rows:
        if (
            r["優先度"].strip() == "A"
            and "希望" in r["面談希望"]
            and any(k in r["年収"] for k in ["700", "800", "1,000", "1,200"])
        ):
            high_intent += 1

    # ====== レポート生成 ======
    lines = []
    lines.append(f"# テレアポ管理シート 統計分析レポート")
    lines.append("")
    lines.append(f"> 集計日: {TODAY.isoformat()}")
    lines.append(f"> 対象レコード数: **{total}** 件")
    lines.append(f"> ソース: `テレアポ管理シート.csv`")
    lines.append("")
    lines.append("**機微情報の取り扱い**: 本レポートは PII（氏名・電話・住所・メール・備考）を一切含みません。")
    lines.append("担当者名は STAFF-A 形式に匿名化済み。")
    lines.append("")

    def section(title: str, counter: Counter, *, sort_by_count: bool = True) -> None:
        if not counter:
            return
        lines.append(f"## {title}")
        lines.append("")
        lines.append("| 区分 | 件数 | 割合 |")
        lines.append("| --- | ---: | ---: |")
        items = counter.most_common() if sort_by_count else sorted(counter.items())
        for k, v in items:
            pct = v / total * 100
            lines.append(f"| {k} | {v} | {pct:.1f}% |")
        lines.append("")

    # サマリ KPI
    lines.append("## サマリ KPI")
    lines.append("")
    lines.append("| 指標 | 値 |")
    lines.append("| --- | ---: |")
    lines.append(f"| 総レコード数 | {total} |")
    lines.append(f"| 架電日列が入力済み (1 回目) | {has_call_1} ({has_call_1/total*100:.1f}%) |")
    lines.append(f"| ステータスから推定したコンタクト実施 | {contacted_by_status} ({contacted_by_status/total*100:.1f}%) |")
    lines.append(f"| 次回架電予定 | {scheduled_next} ({scheduled_next/total*100:.1f}%) |")
    lines.append(f"| アポ取得済み | {has_apo} ({has_apo/total*100:.1f}%) |")
    lines.append(f"| 架電 → アポ転換率（推定ベース） | {(has_apo/contacted_by_status*100) if contacted_by_status else 0:.1f}% |")
    lines.append(f"| ハイインテント候補 (A + 面談希望 + 年収 700+) | {high_intent} |")
    lines.append(f"| **⚠ 滞留アラート (14 日以上未架電)** | **{untouched_stale}** |")
    lines.append("")

    # ファネル可視化
    lines.append("## ファネル")
    lines.append("")
    lines.append("```")
    funnel = [("問合せ受領", total), ("1 回目架電", has_call_1), ("2 回目架電", has_call_2), ("3 回目架電", has_call_3), ("アポ取得", has_apo)]
    max_n = total or 1
    bar_width = 40
    for label, n in funnel:
        bar = "█" * int(n / max_n * bar_width) if max_n else ""
        lines.append(f"{label:<10} | {bar:<40} | {n:>3} ({n/max_n*100:5.1f}%)")
    lines.append("```")
    lines.append("")

    section("優先度の分布", priority)
    section("架電ステータス", status)
    section("年収帯", income)
    section("勤続年数", tenure)
    section("貯蓄額", savings)
    section("不動産所有", real_estate)
    section("投資経験", investment)
    section("面談希望", meeting_wish)
    section("担当者別の保有件数（匿名化）", staff_counter)
    section("問合せからの経過日数", age_buckets, sort_by_count=False)

    if result_1:
        section("1 回目架電の結果", result_1)
    if result_2:
        section("2 回目架電の結果", result_2)
    if result_3:
        section("3 回目架電の結果", result_3)

    lines.append("## 改善提案")
    lines.append("")
    if untouched_stale > 0:
        lines.append(f"- **滞留対応**: 14 日以上未架電が {untouched_stale} 件。優先度 A から順に当日中に着手するか、棚卸して失注クローズ。")
    if has_call_1 and has_apo / has_call_1 < 0.3:
        lines.append(f"- **アポ転換率改善**: 架電→アポ転換 {has_apo/has_call_1*100:.1f}%。スクリプト見直し・架電時間帯の AB テスト推奨。")
    if has_call_1 < total * 0.5:
        lines.append(f"- **初動の遅さ**: 全体の半数以下しか架電できていない。リード受領から 24h 以内の初動ルール化を検討。")
    no_response_count = sum(1 for r in rows if r["架電ステータス"].strip() == "" and r["問合せ日"].strip())
    if no_response_count > 5:
        lines.append(f"- **未着手の見える化**: 「架電ステータス」未設定 {no_response_count} 件。日報フォーム導線にステータス更新を組み込む。")
    no_assignee = sum(1 for r in rows if not r["担当者"].strip())
    if no_assignee > total * 0.5:
        lines.append(f"- **担当者未割当**: {no_assignee} 件で担当者欄が空。リード受領時の自動割当ルール（ラウンドロビン or 優先度ベース）を整備。")
    # 高ポテンシャル層の指摘
    a_priority = priority.get("A", 0)
    high_income = sum(income.get(k, 0) for k in ["700万円~899万円", "900万円~1,199万円", "1,200万円以上"])
    if a_priority and high_income:
        lines.append(f"- **高ポテンシャル層への重点配分**: 優先度 A が {a_priority} 件、年収 700+ 万円が {high_income} 件。STAFF 配分時にこの層を経験者へ寄せる。")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append(f"_自動生成: `経営管理/09_資料・アーカイブ/分析/telapo_stats.py`_")
    lines.append("")

    # 担当者マッピング表（git にコミットしないため別ファイルへ）
    out_report = OUT_DIR / f"レポート_{TODAY.isoformat()}.md"
    out_report.write_text("\n".join(lines), encoding="utf-8")

    out_mapping = OUT_DIR / f".staff_mapping_{TODAY.isoformat()}.local.txt"
    out_mapping.write_text(
        "# 担当者匿名化マッピング（ローカル参照用・.gitignore 対象）\n"
        + "\n".join(f"{anon} = {name}" for name, anon in staff_map.items()),
        encoding="utf-8",
    )

    print(f"✓ レポート生成: {out_report.relative_to(ROOT)}")
    print(f"✓ 匿名化マッピング (gitignore): {out_mapping.relative_to(ROOT)}")
    print(f"  集計件数: {total}, 滞留アラート: {untouched_stale}, ハイインテント: {high_intent}")


if __name__ == "__main__":
    main()
