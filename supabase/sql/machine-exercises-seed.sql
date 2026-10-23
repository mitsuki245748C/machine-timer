-- 器具ごとの初期の種目（machine_exercises）を登録する
-- db-auth-exercises.sql を実行した後に、SQL Editor から実行する
-- machines.name が下の器具名と一致する器具にだけ登録される

-- 種目名の「ベンチプレス」と区別するため、器具名を「ベンチ台」にする
update public.machines set name = 'ベンチ台' where name = 'ベンチプレス';

insert into public.machine_exercises (machine_id, exercise_id)
  select m.id, e.id
  from (values
    ('スミスマシン', 'ベンチプレス'),
    ('スミスマシン', 'インクラインベンチプレス'),
    ('スミスマシン', 'スクワット'),
    ('スミスマシン', 'ショルダープレス'),

    ('ベンチ台', 'ベンチプレス'),
    ('ベンチ台', 'インクラインベンチプレス'),
    ('ベンチ台', 'ダンベルプレス'),
    ('ベンチ台', 'ダンベルフライ'),
    ('ベンチ台', 'ショルダープレス'),

    ('ラットプルダウン', 'ラットプルダウン'),

    ('レッグプレス', 'レッグプレス'),

    ('ケーブルマシン', 'ラットプルダウン'),
    ('ケーブルマシン', 'シーテッドロー'),
    ('ケーブルマシン', 'サイドレイズ')
  ) as v (machine_name, exercise_name)
  join public.machines m on m.name = v.machine_name
  join public.exercises e on e.name = v.exercise_name and e.owner_user_id is null
  on conflict do nothing;

-- 登録結果の確認
select m.name as machine, e.name as exercise
from public.machine_exercises me
join public.machines m on m.id = me.machine_id
join public.exercises e on e.id = me.exercise_id
order by m.id, e.id;
