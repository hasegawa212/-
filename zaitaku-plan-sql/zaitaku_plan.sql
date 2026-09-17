-- =====================================================================
-- 在宅勤務プラン  zaitaku_plan(date)
-- ルール：営業部は「毎週水曜が全員在宅」、それ以外の平日は出社。
--         （2026/7/24 管理部打ち合わせ「在宅勤務＝水曜継続」に基づく）
--
-- 使い方：
--   select * from zaitaku_plan('2026-09-07');   -- 月曜 → 全員 出社
--   select * from zaitaku_plan('2026-09-08');   -- 火曜 → 全員 出社
--   select * from zaitaku_plan('2026-09-09');   -- 水曜 → 全員 在宅
--   select * from zaitaku_plan();               -- 引数省略で当日
--   （2026年9月の水曜＝2・9・16・23・30。曜日は関数が自動判定します）
--
-- 適用：Supabase SQL Editor に貼って実行（冪等：再実行可）。
--      もしくは supabase/migrations に置いて `supabase db push`。
-- =====================================================================

-- 1) メンバー表（他テーブルと衝突しないよう zaitaku_ 接頭辞で名前空間を分離）
create table if not exists zaitaku_members (
  id          bigint generated always as identity primary key,
  name        text    not null unique,
  team        text    not null default '営業部',
  active      boolean not null default true,      -- 退職・休職などは false に
  created_at  timestamptz not null default now()
);

-- 2) シード（営業部6名／冪等）。氏名や増減はこの表を編集するだけ。
insert into zaitaku_members (name) values
  ('酒井 海音'),
  ('上田'),
  ('坂本 塁'),
  ('犬塚 篤博'),
  ('小林 駿'),
  ('菊池')
on conflict (name) do nothing;

-- 3) 曜日判定ヘルパ：ISO曜日(月=1〜日=7)から在宅かどうか。
--    在宅曜日を増やしたい場合はこの配列に追加（例：金も在宅なら array[3,5]）。
create or replace function is_zaitaku_day(p_date date)
returns boolean
language sql
immutable
as $$
  select extract(isodow from p_date)::int = any (array[3]);  -- 3 = 水曜
$$;

-- 4) 本体：指定日の在宅プランを1人1行で返す。
create or replace function zaitaku_plan(p_date date default current_date)
returns table (
  "日付"     date,
  "曜日"     text,
  "氏名"     text,
  "チーム"   text,
  "勤務形態" text
)
language sql
stable
as $$
  select
    p_date                                                              as "日付",
    (array['月','火','水','木','金','土','日'])[extract(isodow from p_date)::int] as "曜日",
    m.name                                                              as "氏名",
    m.team                                                              as "チーム",
    case when is_zaitaku_day(p_date) then '在宅' else '出社' end          as "勤務形態"
  from zaitaku_members m
  where m.active
  order by m.id;
$$;

-- 5) （任意）在宅者だけ / サマリを見たいとき：
--   select "氏名" from zaitaku_plan('2026-09-09') where "勤務形態" = '在宅';
--   select "勤務形態", count(*) from zaitaku_plan('2026-09-09') group by 1;

-- 6) （任意）期間の在宅日一覧を返す関数。
create or replace function zaitaku_days(p_from date, p_to date)
returns table ("日付" date, "曜日" text)
language sql
stable
as $$
  select d::date, (array['月','火','水','木','金','土','日'])[extract(isodow from d)::int]
  from generate_series(p_from, p_to, interval '1 day') as d
  where is_zaitaku_day(d::date)
  order by d;
$$;
--   select * from zaitaku_days('2026-09-01','2026-09-30');  -- 9月の在宅日(=毎週水曜)
