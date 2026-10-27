import { getCurrentUserId } from "@/lib/supabase/auth";
import { createSupabaseServerClient, getSupabaseEnv } from "@/lib/supabase/server";

export function workoutError(error: string, status: number) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function workoutContext() {
  const env = getSupabaseEnv();
  if (env.error) return { response: workoutError("データベースに接続できません。", 500) };
  const userId = await getCurrentUserId();
  if (!userId) return { response: workoutError("ログインしてください。", 401) };
  return {
    userId,
    supabase: createSupabaseServerClient(env.data.supabaseUrl, env.data.supabaseKey),
  };
}

export function workoutRpcError(error: { code?: string; message: string }) {
  if (error.code === "22023") return workoutError(error.message, 400);
  if (error.code === "42501") return workoutError("この利用の記録は保存できません。", 403);
  if (error.code === "P0002") return workoutError("器具または利用が見つかりません。", 404);
  if (error.code === "55000") return workoutError("この利用はすでに終了しています。器具一覧から確認してください。", 409);
  console.error("[workouts] データベース処理に失敗しました:", error);
  return workoutError("処理に失敗しました。時間をおいて再試行してください。", 500);
}
