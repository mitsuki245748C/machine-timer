import { sendMail } from "@/lib/mail";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseClient = ReturnType<typeof createSupabaseServerClient>;

type Reservation = {
  user_id: string | null;
  machine_id: number;
  machines: { name: string } | null;
};

// 利用が終わったとき、その利用を予約していた人に「器具が空きました」とメールで知らせる。
// 失敗しても終了処理には影響させない（ログだけ残す）
export async function notifyReservation(
  supabase: SupabaseClient,
  endedBy: string,
  usageId: number,
): Promise<void> {
  try {
    const { data: reservation, error: reservationError } = await supabase
      .from("reservations")
      .select("user_id, machine_id, machines(name)")
      .eq("usage_id", usageId)
      .maybeSingle<Reservation>();
    if (reservationError) {
      console.error("[notify] 予約の取得に失敗しました:", reservationError);
      return;
    }
    const reservedBy = reservation?.user_id ?? null;
    if (!reservation || reservedBy === null || reservedBy === endedBy) return;

    const { data, error } = await supabase.auth.admin.getUserById(reservedBy);
    const email = data.user?.email;
    if (error || !email) {
      console.error("[notify] 予約者のメールアドレスを取得できません:", error);
      return;
    }

    const name = reservation.machines?.name ?? "予約した器具";
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    await sendMail({
      to: email,
      subject: `「${name}」が空きました`,
      text: `予約していた「${name}」の利用が終了しました。\n${siteUrl}/m/${reservation.machine_id}\n`,
    });
  } catch (err) {
    console.error("[notify] 予約者への通知に失敗しました:", err);
  }
}
