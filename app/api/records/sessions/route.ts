import { workoutContext, workoutError, workoutRpcError } from "@/lib/supabase/workouts";

export const dynamic = "force-dynamic";

function parseDate(value: string | null): string | null | undefined {
  if (value === null || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

// 記録画面の「日付別」「カレンダー」用。
// from 以上 before 未満のトレーニングを新しい順に最大 limit 件返す。
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const from = parseDate(params.get("from"));
  const before = parseDate(params.get("before"));
  const limit = Number(params.get("limit") ?? 30);
  if (from === undefined || before === undefined) return workoutError("日付が不正です。", 400);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
    return workoutError("件数は1〜500で指定してください。", 400);
  }

  const context = await workoutContext();
  if (context.response) return context.response;
  const { supabase, userId } = context;

  const { data, error } = await supabase.rpc("record_sessions", {
    p_user_id: userId,
    p_from: from,
    p_before: before,
    p_limit: limit,
  });
  if (error) return workoutRpcError(error);

  return Response.json({ sessions: data ?? [] }, {
    headers: { "Cache-Control": "no-store" },
  });
}
