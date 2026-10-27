import { isPositiveId } from "@/lib/workouts";
import { workoutContext, workoutError, workoutRpcError } from "@/lib/supabase/workouts";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || !isPositiveId(body.machineId) || typeof body.name !== "string") {
    return workoutError("器具と種目名を確認してください。", 400);
  }
  const name = body.name.trim();
  if (!name || name.length > 100) return workoutError("種目名は1〜100文字で入力してください。", 400);
  const context = await workoutContext();
  if (context.response) return context.response;
  const { data, error } = await context.supabase.rpc("add_my_machine_exercise", {
    p_user_id: context.userId,
    p_machine_id: body.machineId,
    p_name: name,
  });
  if (error) return workoutRpcError(error);
  return Response.json({ exercise: data }, { headers: { "Cache-Control": "no-store" } });
}
