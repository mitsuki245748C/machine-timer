-- workout_sets に machine_id を追加し、同一マシン×同一種目で記録を区別できるようにする。
-- db-auth-exercises.sql / history-workouts.sql の後に実行する。再実行可能。
begin;

-- 1. machine_id カラムを追加（器具なし種目に備えて NULL 許可。usages と揃える）
alter table public.workout_sets
  add column if not exists machine_id bigint references public.machines (id);

-- 2. 既存の記録の machine_id を、ひも付く利用（usage）から埋める
update public.workout_sets ws
  set machine_id = u.machine_id
  from public.usages u
  where ws.usage_id = u.id and ws.machine_id is null;

-- 3. マシン×種目で前回記録を引くための索引
create index if not exists workout_sets_user_machine_exercise_idx
  on public.workout_sets (user_id, machine_id, exercise_id, performed_at desc);

-- 4. 保存関数の insert に machine_id を含める（引数・検証ロジックは変えない）
create or replace function public.save_and_finish_workout(
  p_user_id uuid, p_machine_id bigint, p_usage_id bigint,
  p_exercise_id bigint, p_sets jsonb
)
returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_usage public.usages%rowtype;
  v_set jsonb;
  v_saved jsonb;
  v_same_exercise boolean;
begin
  if p_sets is null or jsonb_typeof(p_sets) <> 'array' then
    raise exception 'セットの形式が不正です。' using errcode = '22023';
  end if;
  if jsonb_array_length(p_sets) not between 1 and 100 then
    raise exception 'セットは1〜100件で入力してください。' using errcode = '22023';
  end if;
  for v_set in select value from jsonb_array_elements(p_sets) loop
    if jsonb_typeof(v_set->'weight_kg') is distinct from 'number'
      or jsonb_typeof(v_set->'reps') is distinct from 'number' then
      raise exception '重量と回数を数値で入力してください。' using errcode = '22023';
    end if;
    if (v_set->>'weight_kg')::numeric not between 0 and 999.99
      or (v_set->>'weight_kg')::numeric <> round((v_set->>'weight_kg')::numeric, 2)
      or (v_set->>'reps')::numeric not between 1 and 2147483647
      or (v_set->>'reps')::numeric <> trunc((v_set->>'reps')::numeric) then
      raise exception '重量または回数の範囲が不正です。' using errcode = '22023';
    end if;
  end loop;

  select * into v_usage from public.usages where id = p_usage_id for update;
  if not found then
    raise exception '利用が見つかりません。' using errcode = 'P0002';
  end if;
  if p_user_id is null or v_usage.user_id is distinct from p_user_id
    or v_usage.machine_id is distinct from p_machine_id then
    raise exception 'この利用の記録は保存できません。' using errcode = '42501';
  end if;
  if v_usage.ended_at is not null then
    select jsonb_agg(jsonb_build_object('weight_kg', weight_kg, 'reps', reps) order by id),
      bool_and(exercise_id = p_exercise_id)
      into v_saved, v_same_exercise
      from public.workout_sets where usage_id = p_usage_id and user_id = p_user_id;
    if v_same_exercise and v_saved = p_sets then return; end if;
    raise exception 'この利用はすでに終了しています。' using errcode = '55000';
  end if;
  if not exists (
    select 1 from public.history_exercises(p_user_id, p_machine_id) where id = p_exercise_id
  ) then
    raise exception 'この器具で選択できる種目を指定してください。' using errcode = '22023';
  end if;

  insert into public.workout_sets (user_id, exercise_id, usage_id, machine_id, weight_kg, reps)
    select p_user_id, p_exercise_id, p_usage_id, p_machine_id,
      (s.value->>'weight_kg')::numeric, (s.value->>'reps')::int
    from jsonb_array_elements(p_sets) with ordinality as s(value, position)
    order by s.position;
  update public.usages set ended_at = now() where id = p_usage_id;
end;
$$;

commit;