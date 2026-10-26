import { getCurrentUserId } from "@/lib/supabase/auth";
import {
  createSupabaseServerClient,
  getSupabaseEnv,
} from "@/lib/supabase/server";
import type { StopwatchResponse } from "../../stopwatch/model";

export const dynamic = "force-dynamic";

// Postgres のエラーコード
const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";

type SupabaseClient = ReturnType<typeof createSupabaseServerClient>;

// ended_at が空の usages が「使用中のタイマー」
type ActiveUsage = {
  id: number;
  machine_id: number;
  user_id: string | null;
  started_at: string;
  reservations: { user_id: string | null }[];
};

function getSupabase(): SupabaseClient | null {
  const env = getSupabaseEnv();
  if (env.error) {
    console.error(
      "[/api/stopwatch] Supabase の環境変数が未設定です:",
      env.error.missingEnvNames.join(", "),
    );
    return null;
  }
  return createSupabaseServerClient(env.data.supabaseUrl, env.data.supabaseKey);
}

function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

async function fetchActiveUsages(supabase: SupabaseClient) {
  return supabase
    .from("usages")
    .select("id, machine_id, user_id, started_at, reservations(user_id)")
    .is("ended_at", null)
    .overrideTypes<ActiveUsage[]>();
}

async function stateResponse(
  supabase: SupabaseClient,
  userId: string,
): Promise<Response> {
  const { data: usages, error } = await fetchActiveUsages(supabase);
  if (error) {
    console.error("[/api/stopwatch] 状態の取得に失敗しました:", error);
    return errorResponse("状態の取得に失敗しました。", 500);
  }

  const now = Date.now();
  const data: StopwatchResponse = {
    machines: (usages ?? []).map((usage) => {
      const reservedBy = usage.reservations[0]?.user_id ?? null;
      const elapsed = now - Date.parse(usage.started_at);
      return {
        id: usage.machine_id,
        state: {
          isRunning: true,
          seconds: Math.max(0, Math.floor(elapsed / 1000)),
          startedByMe: usage.user_id === userId,
          isReserved: reservedBy !== null,
          reservedByMe: reservedBy === userId,
        },
      };
    }),
  };
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}

async function start(
  supabase: SupabaseClient,
  userId: string,
  machineId: number,
): Promise<Response | null> {
  const { error } = await supabase.from("usages").insert({
    machine_id: machineId,
    user_id: userId,
    started_at: new Date().toISOString(),
  });
  // 既に使用中なら一意制約で弾かれる。そのまま現在の状態を返す
  if (error && error.code !== UNIQUE_VIOLATION) {
    if (error.code === FOREIGN_KEY_VIOLATION) {
      return errorResponse("器具が見つかりません。", 404);
    }
    console.error("[/api/stopwatch] 開始に失敗しました:", error);
    return errorResponse("開始に失敗しました。", 500);
  }
  return null;
}

async function end(
  supabase: SupabaseClient,
  machineId: number,
): Promise<Response | null> {
  const { error } = await supabase
    .from("usages")
    .update({ ended_at: new Date().toISOString() })
    .eq("machine_id", machineId)
    .is("ended_at", null);
  if (error) {
    console.error("[/api/stopwatch] 終了に失敗しました:", error);
    return errorResponse("終了に失敗しました。", 500);
  }
  return null;
}

async function reserve(
  supabase: SupabaseClient,
  userId: string,
  machineId: number,
): Promise<Response | null> {
  const { data: usages, error: usageError } = await fetchActiveUsages(supabase);
  if (usageError) {
    console.error("[/api/stopwatch] 状態の取得に失敗しました:", usageError);
    return errorResponse("予約に失敗しました。", 500);
  }

  const usage = usages?.find(({ machine_id }) => machine_id === machineId);
  if (!usage) {
    return errorResponse("使用中でない器具は予約できません。", 400);
  }
  if (usage.user_id === userId) {
    return errorResponse("自分が使用中の器具は予約できません。", 400);
  }

  const reservedBy = usage.reservations[0]?.user_id ?? null;
  if (reservedBy !== null) {
    return reservedBy === userId
      ? null
      : errorResponse("既に他の人が予約しています。", 409);
  }

  const { error } = await supabase.from("reservations").insert({
    machine_id: machineId,
    user_id: userId,
    usage_id: usage.id,
  });
  // 同時に予約された場合は一意制約で弾かれる
  if (error?.code === UNIQUE_VIOLATION) {
    return errorResponse("既に他の人が予約しています。", 409);
  }
  if (error) {
    console.error("[/api/stopwatch] 予約に失敗しました:", error);
    return errorResponse("予約に失敗しました。", 500);
  }
  return null;
}

export async function GET() {
  const supabase = getSupabase();
  if (!supabase) return errorResponse("状態の取得に失敗しました。", 500);

  const userId = await getCurrentUserId();
  if (!userId) return errorResponse("ログインしてください。", 401);
  return stateResponse(supabase, userId);
}

export async function POST(request: Request) {
  const supabase = getSupabase();
  if (!supabase) return errorResponse("操作に失敗しました。", 500);

  const userId = await getCurrentUserId();
  if (!userId) return errorResponse("ログインしてください。", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("JSON形式で送信してください。", 400);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return errorResponse("リクエストが不正です。", 400);
  }

  const { action, machineId } = body as Record<string, unknown>;
  if (action !== "start" && action !== "reset" && action !== "reserve") {
    return errorResponse("操作が不正です。", 400);
  }
  if (typeof machineId !== "number" || !Number.isSafeInteger(machineId) || machineId < 1) {
    return errorResponse("マシンIDが不正です。", 400);
  }

  let failure: Response | null;
  switch (action) {
    case "start":
      failure = await start(supabase, userId, machineId);
      break;
    case "reset":
      failure = await end(supabase, machineId);
      break;
    case "reserve":
      failure = await reserve(supabase, userId, machineId);
      break;
  }
  if (failure) return failure;

  return stateResponse(supabase, userId);
}
