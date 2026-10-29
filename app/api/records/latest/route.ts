import { isPositiveId } from "@/lib/workouts";
import { workoutContext, workoutError, workoutRpcError } from "@/lib/supabase/workouts";

export const dynamic = "force-dynamic";

// 指定した種目の「前回（直近1回分）の記録」を返す。
// 記録が無ければ latest は null。
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const machineId = Number(params.get("machineId"));
  const exerciseId = Number(params.get("exerciseId"));
  if (!isPositiveId(machineId)) return workoutError("マシンIDが不正です。", 400);
  if (!isPositiveId(exerciseId)) return workoutError("種目IDが不正です。", 400);

  const context = await workoutContext();
  if (context.response) return context.response;
  const { supabase, userId } = context;

  const { data, error } = await supabase.rpc("latest_workout", {
    p_user_id: userId,
    p_machine_id: machineId,
    p_exercise_id: exerciseId,
  });
  if (error) return workoutRpcError(error);

  // data は { performed_at, sets } または null
  return Response.json({ latest: data ?? null }, {
    headers: { "Cache-Control": "no-store" },
  });
}