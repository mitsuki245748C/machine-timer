-- 予約が入った器具の利用者に、終了時刻を知らせるための変更
-- SQL Editor から実行する。実行前に下の YOUR_SITE_URL と YOUR_CRON_SECRET を
-- 実際の値（Vercel 等の環境変数 CRON_SECRET と同じ値）に書き換える。
-- 値を書き換えたファイルはコミットしないこと。

-- 利用を終了してほしい時刻と、最後に利用者へ通知した時刻
alter table public.reservations
  add column if not exists deadline_at timestamptz,
  add column if not exists last_notified_at timestamptz;

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 毎分、通知が必要な予約がないか確認する API を呼ぶ
select cron.schedule(
  'notify-deadline',
  '* * * * *',
  $$
  select net.http_post(
    url := 'YOUR_SITE_URL/api/cron/notify-deadline',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET')
  );
  $$
);
