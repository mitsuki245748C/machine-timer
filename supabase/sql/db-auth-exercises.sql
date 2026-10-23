-- ログイン（Supabase Auth）と public.users をつなぎ、種目・記録用のテーブルを追加する
-- 開発用 → 確認 → main にマージする前に本番用、の順で SQL Editor から実行する
-- 注意: 1. で Cookie のIDで作られた利用・予約・ユーザーを削除する

begin;

-- 1. ログインユーザー以外（Cookie のランダムID）で作られた行を削除する
-- 消す利用（usages）を参照している予約も、先に消しておく
delete from public.reservations
  where (user_id is not null and user_id not in (select id from auth.users))
    or usage_id in (
      select id from public.usages
      where user_id is not null and user_id not in (select id from auth.users)
    );
delete from public.usages
  where user_id is not null
    and user_id not in (select id from auth.users);
delete from public.users
  where id not in (select id from auth.users);

-- 2. public.users を auth.users に紐づける
-- id は auth.users のものを使うので、自動で振られないようにする
alter table public.users alter column id drop default;
alter table public.users
  add constraint users_id_fkey
  foreign key (id) references auth.users (id) on delete cascade;

-- created_at が time（時刻のみ）型になっているので作り直す
alter table public.users drop column if exists created_at;
alter table public.users
  add column created_at timestamptz not null default now();

-- reservations: user_id に勝手に別のIDが入らないようにし、外部キーと作成日時の既定値を付ける
alter table public.reservations alter column user_id drop default;
alter table public.reservations alter column created_at set default now();
alter table public.reservations
  add constraint reservations_user_id_fkey
  foreign key (user_id) references public.users (id) on delete cascade;
alter table public.reservations
  add constraint reservations_machine_id_fkey
  foreign key (machine_id) references public.machines (id);

-- すでにログイン済みのユーザーを登録しておく
insert into public.users (id)
  select id from auth.users
  on conflict (id) do nothing;

-- ログインしたら（auth.users に行が増えたら）public.users にも行を作る
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id) values (new.id)
    on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. 種目
-- owner_user_id が null なら初期種目、値があればその人が追加した種目
create table if not exists public.exercises (
  id bigint generated always as identity primary key,
  name text not null check (btrim(name) <> ''),
  owner_user_id uuid references public.users (id) on delete cascade,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

-- 同じ持ち主で同じ名前は1つまで（初期種目どうしも null を同じ持ち主として扱う）
create unique index if not exists exercises_owner_name_key
  on public.exercises (owner_user_id, name) nulls not distinct;

-- 初期種目と同じ名前の自作種目は作れない
create or replace function public.reject_preset_exercise_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_user_id is not null and exists (
    select 1 from public.exercises
    where owner_user_id is null and name = new.name
  ) then
    raise exception '初期種目と同じ名前の種目は登録できません: %', new.name
      using errcode = 'unique_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists exercises_reject_preset_name on public.exercises;
create trigger exercises_reject_preset_name
  before insert or update of name, owner_user_id on public.exercises
  for each row execute function public.reject_preset_exercise_name();

-- 4. 器具ごとの初期の種目
create table if not exists public.machine_exercises (
  machine_id bigint not null references public.machines (id) on delete cascade,
  exercise_id bigint not null references public.exercises (id) on delete cascade,
  primary key (machine_id, exercise_id)
);

-- 5. ユーザーごと・器具ごとの種目リスト（machine_id が null なら器具を使わない種目）
create table if not exists public.user_exercises (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  machine_id bigint references public.machines (id) on delete cascade,
  exercise_id bigint not null references public.exercises (id) on delete cascade,
  sort_order int not null default 0,
  hidden_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists user_exercises_user_machine_exercise_key
  on public.user_exercises (user_id, machine_id, exercise_id) nulls not distinct;

-- 6. トレーニング記録（1セット1行。usage_id は器具を使ったときだけ）
create table if not exists public.workout_sets (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  exercise_id bigint not null references public.exercises (id),
  usage_id bigint references public.usages (id) on delete set null,
  performed_at timestamptz not null default now(),
  weight_kg numeric(5, 2) check (weight_kg >= 0),
  reps int not null check (reps >= 1),
  created_at timestamptz not null default now()
);

create index if not exists workout_sets_user_performed_at_idx
  on public.workout_sets (user_id, performed_at desc);

-- 7. RLS を有効にする
-- サーバーの API は Secret key で接続するので影響しない。
-- ポリシーを作らないので、公開キー（ブラウザ）からは読み書きできなくなる。
alter table public.users enable row level security;
alter table public.machines enable row level security;
alter table public.usages enable row level security;
alter table public.reservations enable row level security;
alter table public.exercises enable row level security;
alter table public.machine_exercises enable row level security;
alter table public.user_exercises enable row level security;
alter table public.workout_sets enable row level security;

-- 8. 初期種目
insert into public.exercises (name) values
  ('ベンチプレス'),
  ('インクラインベンチプレス'),
  ('ダンベルプレス'),
  ('ダンベルフライ'),
  ('チェストプレス'),
  ('ペックフライ'),
  ('スクワット'),
  ('レッグプレス'),
  ('レッグエクステンション'),
  ('レッグカール'),
  ('デッドリフト'),
  ('ラットプルダウン'),
  ('シーテッドロー'),
  ('ベントオーバーロー'),
  ('ショルダープレス'),
  ('サイドレイズ'),
  ('アームカール'),
  ('トライセプスエクステンション'),
  ('腕立て伏せ'),
  ('懸垂'),
  ('腹筋')
on conflict do nothing;

-- 器具ごとの初期の種目
-- machines.name は環境ごとに違うので、実際の器具名に合わせて書き換えてから実行する
-- insert into public.machine_exercises (machine_id, exercise_id)
--   select m.id, e.id
--   from (values
--     ('ベンチ台', 'ベンチプレス'),
--     ('ベンチ台', 'インクラインベンチプレス'),
--     ('スミスマシン', 'スクワット')
--   ) as v (machine_name, exercise_name)
--   join public.machines m on m.name = v.machine_name
--   join public.exercises e on e.name = v.exercise_name and e.owner_user_id is null
--   on conflict do nothing;

commit;
