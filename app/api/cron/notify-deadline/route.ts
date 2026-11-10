import { timingSafeEqual } from "node:crypto";

import { nextNotice } from "@/lib/deadline";
import { notifyUsageDeadline } from "@/lib/notify-deadline";
import {
  createSupabaseServerClient,
  getSupabaseEnv,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// 予約が入っていて、まだ使用中の利用
type PendingReservation = {
  id: number;
  machine_id: number;
  deadline_at: string;
  last_notified_at: string | null;
  usages: { user_id: string | null };
};

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Supabase の pg_cron から毎分呼ばれ、期限の通知が必要な利用者にメールを送る
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "認証に失敗しました。" }, { status: 401 });
  }

  const env = getSupabaseEnv();
  if (env.error) {
    console.error(
      "[/api/cron/notify-deadline] Supabase の環境変数が未設定です:",
      env.error.missingEnvNames.join(", "),
    );
    return Response.json({ error: "設定が不足しています。" }, { status: 500 });
  }
  const supabase = createSupabaseServerClient(
    env.data.supabaseUrl,
    env.data.supabaseKey,
  );

  const { data, error } = await supabase
    .from("reservations")
    .select(
      "id, machine_id, deadline_at, last_notified_at, usages!inner(user_id)",
    )
    .not("deadline_at", "is", null)
    .is("usages.ended_at", null)
    .overrideTypes<PendingReservation[], { merge: false }>();
  if (error) {
    console.error("[/api/cron/notify-deadline] 予約の取得に失敗しました:", error);
    return Response.json({ error: "取得に失敗しました。" }, { status: 500 });
  }

  const now = new Date();
  let sent = 0;
  for (const reservation of data ?? []) {
    const userId = reservation.usages.user_id;
    const deadline = new Date(reservation.deadline_at);
    const notice = nextNotice(
      deadline,
      reservation.last_notified_at ? new Date(reservation.last_notified_at) : null,
      now,
    );
    if (!userId || !notice) continue;

    // 前回の通知時刻が変わっていなければ更新できる。cron が重なっても二重送信しない
    let claim = supabase
      .from("reservations")
      .update({ last_notified_at: now.toISOString() })
      .eq("id", reservation.id);
    claim = reservation.last_notified_at
      ? claim.eq("last_notified_at", reservation.last_notified_at)
      : claim.is("last_notified_at", null);
    const { data: claimed, error: claimError } = await claim
      .select("id")
      .overrideTypes<{ id: number }[]>();
    if (claimError || !claimed?.length) continue;

    await notifyUsageDeadline(supabase, notice, {
      userId,
      machineId: reservation.machine_id,
      deadline,
    });
    sent++;
  }

  return Response.json({ sent });
}
