import { isPositiveId, parseSets } from "@/lib/workouts";
import { workoutContext, workoutError, workoutRpcError } from "@/lib/supabase/workouts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const machineId = Number(new URL(request.url).searchParams.get("machineId"));
  if (!isPositiveId(machineId)) return workoutError("マシンIDが不正です。", 400);
  const context = await workoutContext();
  if (context.response) return context.response;
  const { supabase, userId } = context;

  const [machine, usage, exercises] = await Promise.all([
    supabase.from("machines").select("id, name").eq("id", machineId).maybeSingle(),
    supabase.from("usages").select("id").eq("machine_id", machineId)
      .eq("user_id", userId).is("ended_at", null).maybeSingle(),
    supabase.rpc("history_exercises", { p_user_id: userId, p_machine_id: machineId }),
  ]);
  const error = machine.error ?? usage.error ?? exercises.error;
  if (error) return workoutRpcError(error);
  if (!machine.data) return workoutError("器具が見つかりません。", 404);
  return Response.json({
    machine: machine.data,
    usageId: usage.data?.id ?? null,
    exercises: exercises.data ?? [],
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return workoutError("リクエストが不正です。", 400);
  }
  const { machineId, usageId, exerciseId } = body;
  if (![machineId, usageId, exerciseId].every(isPositiveId)) {
    return workoutError("器具・利用・種目を確認してください。", 400);
  }
  const sets = parseSets(body.sets);
  if (!sets) return workoutError("重量は0〜999.99kg（小数2桁まで）、回数は1以上の整数で入力してください。セットは100件まで保存できます。", 400);
  const context = await workoutContext();
  if (context.response) return context.response;
  const { error } = await context.supabase.rpc("save_and_finish_workout", {
    p_user_id: context.userId,
    p_machine_id: machineId,
    p_usage_id: usageId,
    p_exercise_id: exerciseId,
    p_sets: sets,
  });
  if (error) return workoutRpcError(error);
  return Response.json({ ok: true });
}
