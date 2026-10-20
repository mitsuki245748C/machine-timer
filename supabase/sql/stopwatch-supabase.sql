-- タイマー・予約をサーバーのメモリから Supabase に移すための変更
-- 開発用 → 確認 → main にマージする前に本番用、の順で SQL Editor から実行する

-- 同じ器具で使用中（ended_at が空）の利用は1つまで
create unique index if not exists usages_one_active_per_machine
  on public.usages (machine_id) where ended_at is null;

-- 予約を「どの利用に対する予約か」に紐づける
alter table public.reservations
  add column if not exists usage_id bigint references public.usages (id);

-- 1つの利用に予約は1つまで
create unique index if not exists reservations_one_per_usage
  on public.reservations (usage_id);
