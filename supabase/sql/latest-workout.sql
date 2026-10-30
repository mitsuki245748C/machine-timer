-- 指定したマシン×種目の「直近1回分」の記録（セット＋日付）を返す。
-- db-auth-exercises.sql / history-workouts.sql / machine-id-on-workout-sets.sql の後に実行する。
-- 既存ファイルは変更しない。再実行可能。Secret key を使うサーバーだけが呼び出す。
begin;

-- 旧シグネチャ（machine_id なし）があれば削除してから作り直す
drop function if exists public.latest_workout(uuid, bigint);

create or replace function public.latest_workout(
  p_user_id uuid, p_machine_id bigint, p_exercise_id bigint
)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with latest as (
    select usage_id, max(performed_at) as performed_at
    from public.workout_sets
    where user_id = p_user_id
      and machine_id = p_machine_id
      and exercise_id = p_exercise_id
      and usage_id is not null
    group by usage_id
    order by max(performed_at) desc
    limit 1
  )
  select jsonb_build_object(
    'performed_at', l.performed_at,
    'sets', (
      select jsonb_agg(
        jsonb_build_object('weight_kg', ws.weight_kg, 'reps', ws.reps) order by ws.id
      )
      from public.workout_sets ws
      where ws.user_id = p_user_id
        and ws.machine_id = p_machine_id
        and ws.exercise_id = p_exercise_id
        and ws.usage_id = l.usage_id
    )
  )
  from latest l;
$$;

revoke all on function public.latest_workout(uuid, bigint, bigint) from public, anon, authenticated;
grant execute on function public.latest_workout(uuid, bigint, bigint) to service_role;

commit;