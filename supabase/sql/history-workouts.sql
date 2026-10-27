-- db-auth-exercises.sql / machine-exercises-seed.sql の適用後に実行する。
-- 既存データの削除・テーブル変更は行わない。再実行可能。
-- Secret key を使うサーバーだけが呼び出す。ユーザーIDは認証済みセッションから渡す。
begin;

create or replace function public.history_exercises(p_user_id uuid, p_machine_id bigint)
returns table (id bigint, name text)
language sql stable security invoker set search_path = ''
as $$
  select e.id, e.name
  from public.exercises e
  left join public.user_exercises ue
    on ue.exercise_id = e.id and ue.user_id = p_user_id and ue.machine_id = p_machine_id
  where e.archived_at is null
    and (e.owner_user_id is null or e.owner_user_id = p_user_id)
    and (ue.id is null or ue.hidden_at is null)
    and (
      ue.id is not null
      or (e.owner_user_id is null and exists (
        select 1 from public.machine_exercises me
        where me.machine_id = p_machine_id and me.exercise_id = e.id
      ))
    )
  order by coalesce(ue.sort_order, 0), e.id;
$$;

create or replace function public.add_my_machine_exercise(
  p_user_id uuid, p_machine_id bigint, p_name text
)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_exercise public.exercises%rowtype;
  v_name text := btrim(p_name);
begin
  if p_user_id is null then
    raise exception 'ログインしてください。' using errcode = '42501';
  end if;
  if v_name is null or char_length(v_name) < 1 or char_length(v_name) > 100 then
    raise exception '種目名は1〜100文字で入力してください。' using errcode = '22023';
  end if;
  if not exists (select 1 from public.machines where id = p_machine_id) then
    raise exception '器具が見つかりません。' using errcode = 'P0002';
  end if;

  -- 共通種目と同名ならその種目を自分の器具リストに追加する。
  -- 他者の私有種目は検索対象にしない。同じ名前でも別々に所有できる。
  select * into v_exercise from public.exercises
    where owner_user_id is null and name = v_name;
  if not found then
    insert into public.exercises (name, owner_user_id)
      values (v_name, p_user_id)
      on conflict (owner_user_id, name) do update set name = excluded.name
      returning * into v_exercise;
  end if;
  if v_exercise.archived_at is not null then
    raise exception 'この種目名は使用できません。別の名前で追加してください。' using errcode = '22023';
  end if;

  insert into public.user_exercises (user_id, machine_id, exercise_id)
    values (p_user_id, p_machine_id, v_exercise.id)
    on conflict (user_id, machine_id, exercise_id) do update set hidden_at = null;
  return jsonb_build_object('id', v_exercise.id, 'name', v_exercise.name);
end;
$$;

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

  -- 同じ利用への二重送信を直列化。別ユーザー・別器具の利用は保存できない。
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
    -- 応答が失われた後の同一内容の再送は成功として扱い、追加しない。
    if v_same_exercise and v_saved = p_sets then return; end if;
    raise exception 'この利用はすでに終了しています。' using errcode = '55000';
  end if;
  if not exists (
    select 1 from public.history_exercises(p_user_id, p_machine_id) where id = p_exercise_id
  ) then
    raise exception 'この器具で選択できる種目を指定してください。' using errcode = '22023';
  end if;

  insert into public.workout_sets (user_id, exercise_id, usage_id, weight_kg, reps)
    select p_user_id, p_exercise_id, p_usage_id,
      (s.value->>'weight_kg')::numeric, (s.value->>'reps')::int
    from jsonb_array_elements(p_sets) with ordinality as s(value, position)
    order by s.position;
  update public.usages set ended_at = now() where id = p_usage_id;
end;
$$;

revoke all on function public.history_exercises(uuid, bigint) from public, anon, authenticated;
revoke all on function public.add_my_machine_exercise(uuid, bigint, text) from public, anon, authenticated;
revoke all on function public.save_and_finish_workout(uuid, bigint, bigint, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.history_exercises(uuid, bigint) to service_role;
grant execute on function public.add_my_machine_exercise(uuid, bigint, text) to service_role;
grant execute on function public.save_and_finish_workout(uuid, bigint, bigint, bigint, jsonb) to service_role;

commit;
