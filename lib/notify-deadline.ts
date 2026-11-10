import type { Notice } from "@/lib/deadline";
import { sendMail } from "@/lib/mail";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseClient = ReturnType<typeof createSupabaseServerClient>;

export type UsageNotice = Notice | "reserved";

type Target = {
  userId: string;
  machineId: number;
  deadline: Date;
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildMessage(notice: UsageNotice, name: string, deadline: Date) {
  const time = formatTime(deadline);
  switch (notice) {
    case "reserved":
      return {
        subject: `「${name}」に予約が入りました`,
        text: `使用中の「${name}」に予約が入りました。${time} までに利用を終了してください。`,
      };
    case "before":
      return {
        subject: `「${name}」の終了5分前です`,
        text: `「${name}」の終了時刻（${time}）まであと5分です。`,
      };
    case "deadline":
      return {
        subject: `「${name}」の終了時刻です`,
        text: `「${name}」の終了時刻（${time}）になりました。次の人が待っています。利用を終了してください。`,
      };
    case "overdue":
      return {
        subject: `「${name}」の終了時刻を過ぎています`,
        text: `「${name}」の終了時刻（${time}）を過ぎています。次の人が待っています。利用を終了してください。`,
      };
  }
}

// 使用中の人に、予約が入ったことや終了時刻を知らせる。
// 失敗しても呼び出し元の処理には影響させない（ログだけ残す）
export async function notifyUsageDeadline(
  supabase: SupabaseClient,
  notice: UsageNotice,
  { userId, machineId, deadline }: Target,
): Promise<void> {
  try {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    const email = data.user?.email;
    if (error || !email) {
      console.error("[notify] 利用者のメールアドレスを取得できません:", error);
      return;
    }

    const { data: machine } = await supabase
      .from("machines")
      .select("name")
      .eq("id", machineId)
      .maybeSingle<{ name: string }>();
    const name = machine?.name ?? "使用中の器具";

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    const { subject, text } = buildMessage(notice, name, deadline);
    await sendMail({
      to: email,
      subject,
      text: `${text}\n${siteUrl}/m/${machineId}\n`,
    });
  } catch (err) {
    console.error("[notify] 利用者への通知に失敗しました:", err);
  }
}
