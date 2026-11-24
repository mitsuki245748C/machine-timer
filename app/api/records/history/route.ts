import { isPositiveId } from "@/lib/workouts";
import { workoutContext, workoutError, workoutRpcError } from "@/lib/supabase/workouts";

export const dynamic = "force-dynamic";

// 指定したマシン×種目の「全トレーニング履歴」を返す（新しい順）。
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const machineId = Number(params.get("machineId"));
  const exerciseId = Number(params.get("exerciseId"));
  if (!isPositiveId(machineId)) return workoutError("マシンIDが不正です。", 400);
  if (!isPositiveId(exerciseId)) return workoutError("種目IDが不正です。", 400);

  const context = await workoutContext();
  if (context.response) return context.response;
  const { supabase, userId } = context;

  const { data, error } = await supabase.rpc("workout_history", {
    p_user_id: userId,
    p_machine_id: machineId,
    p_exercise_id: exerciseId,
  });
  if (error) return workoutRpcError(error);

  // data は [{ performed_at, sets }, ...] または []
  return Response.json({ history: data ?? [] }, {
    headers: { "Cache-Control": "no-store" },
  });
}