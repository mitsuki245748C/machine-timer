import { workoutContext, workoutRpcError } from "@/lib/supabase/workouts";

export const dynamic = "force-dynamic";

// 記録画面の「部位別」・検索用。記録のある 器具×種目 を部位つきで返す。
export async function GET() {
  const context = await workoutContext();
  if (context.response) return context.response;
  const { supabase, userId } = context;

  const { data, error } = await supabase.rpc("record_exercises", { p_user_id: userId });
  if (error) return workoutRpcError(error);

  return Response.json({ exercises: data ?? [] }, {
    headers: { "Cache-Control": "no-store" },
  });
}
