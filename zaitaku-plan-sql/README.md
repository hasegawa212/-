# zaitaku-plan-sql — 在宅勤務プラン SQL 関数（Supabase / Postgres）

`select * from zaitaku_plan('2026-09-08')` で、指定日の営業部メンバーの
**在宅／出社**を返す Supabase/Postgres 関数一式です。

## ルール

- **営業部は毎週水曜が全員在宅**、それ以外の平日は出社。
  （2026/7/24 管理部打ち合わせ「在宅勤務＝水曜継続」に基づく／`admin-ops/` 参照）
- 判定は `is_zaitaku_day(date)`（ISO曜日 月=1〜日=7 の **3=水曜**）に集約。
  在宅曜日を増やす場合はこの配列を変えるだけ（例：水・金なら `array[3,5]`）。

## 中身（`zaitaku_plan.sql`）

| オブジェクト | 役割 |
|---|---|
| `zaitaku_members` テーブル | 対象メンバー（営業部6名をシード）。増減・退職は `active` で管理 |
| `is_zaitaku_day(date)` | その日が在宅日か（既定＝水曜のみ） |
| `zaitaku_plan(date default current_date)` | 指定日の在宅プランを **1人1行**（日付/曜日/氏名/チーム/勤務形態）で返す |
| `zaitaku_days(from, to)` | 期間内の在宅日（＝毎週水曜）一覧 |

## 使い方

```sql
select * from zaitaku_plan('2026-09-07');   -- 月曜 → 全員 出社
select * from zaitaku_plan('2026-09-09');   -- 水曜 → 全員 在宅
select * from zaitaku_plan();               -- 引数省略で当日

-- 在宅者だけ / サマリ
select "氏名" from zaitaku_plan('2026-09-09') where "勤務形態" = '在宅';
select "勤務形態", count(*) from zaitaku_plan('2026-09-09') group by 1;

-- 期間の在宅日
select * from zaitaku_days('2026-09-01','2026-09-30');
```

出力イメージ（水曜 2026-09-09 の場合）：

| 日付 | 曜日 | 氏名 | チーム | 勤務形態 |
|---|---|---|---|---|
| 2026-09-09 | 水 | 酒井 海音 | 営業部 | 在宅 |
| 2026-09-09 | 水 | 上田 | 営業部 | 在宅 |
| … | | | | |

> ※ 2026年9月の水曜は 2・9・16・23・30。曜日は関数が自動判定するので、日付を渡すだけでOKです（フラグメントの `2026-09-08` は実際は火曜＝出社）。

## 適用方法

- **Supabase SQL Editor**：`zaitaku_plan.sql` の中身を貼って実行（冪等なので再実行OK）。
- **CLI**：`supabase/migrations/` に置いて `supabase db push`。

## カスタマイズ

- **メンバー変更**：`zaitaku_members` を編集（`insert`／`update ... set active=false`）。関数側の変更は不要。
- **在宅曜日変更**：`is_zaitaku_day` の `array[3]` を変える。
- **個人ごとに在宅曜日を変えたい**場合：`zaitaku_members` に `zaitaku_dows int[]`（例 `{3}`）列を足し、`zaitaku_plan` の判定を `extract(isodow from p_date)::int = any(m.zaitaku_dows)` に変えると拡張できます（要望があれば対応します）。

## 注意

- このSQLは **Supabase/Postgres 前提**（ISO曜日・`generate_series`・配列添字は1始まり）。
- 別マシンの `telegram-ai-bot` プロジェクトの Supabase に入れる場合は、そのプロジェクトを本セッションに追加すれば直接 `apply_migration` も可能です（未追加のため、ここではSQLファイルとして用意しています）。
- 氏名は社内の人事情報です。取り扱いにご注意ください。
