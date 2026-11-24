import { isBodyPart } from "@/lib/workouts";
import { workoutContext, workoutError, workoutRpcError } from "@/lib/supabase/workouts";

export const dynamic = "force-dynamic";

// カレンダーの「前の記録日」「次の記録日」用。
// dir=prev なら at より前で一番新しい記録、dir=next なら at 以降で一番古い記録の日時を返す。
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const at = new Date(params.get("at") ?? "");
  const dir = params.get("dir");
  const part = params.get("part");
  if (Number.isNaN(at.getTime())) return workoutError("日付が不正です。", 400);
  if (dir !== "prev" && dir !== "next") return workoutError("方向が不正です。", 400);
  if (part !== null && !isBodyPart(part)) return workoutError("部位が不正です。", 400);

  const context = await workoutContext();
  if (context.response) return context.response;
  const { supabase, userId } = context;

  const { data, error } = await supabase.rpc("record_adjacent", {
    p_user_id: userId,
    p_at: at.toISOString(),
    p_next: dir === "next",
    p_body_part: part,
  });
  if (error) return workoutRpcError(error);

  return Response.json({ performed_at: data ?? null }, {
    headers: { "Cache-Control": "no-store" },
  });
}
