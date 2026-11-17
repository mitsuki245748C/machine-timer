-- 指定したマシン×種目の「全トレーニング履歴」を、1回（usage_id）ごとにまとめて返す。
-- 新しい順。latest-workout.sql の全件版。
-- machine-id-on-workout-sets.sql の後に実行する。再実行可能。
-- Secret key を使うサーバーだけが呼び出す。
begin;

create or replace function public.workout_history(
  p_user_id uuid, p_machine_id bigint, p_exercise_id bigint
)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  -- 1回のトレーニング（usage_id）ごとに、セットをまとめる
  with sessions as (
    select
      ws.usage_id,
      max(ws.performed_at) as performed_at,
      jsonb_agg(
        jsonb_build_object('weight_kg', ws.weight_kg, 'reps', ws.reps) order by ws.id
      ) as sets
    from public.workout_sets ws
    where ws.user_id = p_user_id
      and ws.machine_id = p_machine_id
      and ws.exercise_id = p_exercise_id
      and ws.usage_id is not null
    group by ws.usage_id
  )
  -- 新しい順に並べて、配列で返す。記録が無ければ空配列。
  select coalesce(
    jsonb_agg(
      jsonb_build_object('performed_at', s.performed_at, 'sets', s.sets)
      order by s.performed_at desc
    ),
    '[]'::jsonb
  )
  from sessions s;
$$;

revoke all on function public.workout_history(uuid, bigint, bigint) from public, anon, authenticated;
grant execute on function public.workout_history(uuid, bigint, bigint) to service_role;

commit;