import { cookies } from "next/headers";
import {
  createSupabaseServerClient,
  getSupabaseEnv,
} from "@/lib/supabase/server";
import type { StopwatchResponse } from "../../stopwatch/model";

export const dynamic = "force-dynamic";

const CLIENT_ID_COOKIE = "machine-timer-client-id";

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

async function getOrSetClientId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(CLIENT_ID_COOKIE)?.value;
  if (existing) return existing;

  const id = crypto.randomUUID();
  cookieStore.set(CLIENT_ID_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return id;
}

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
  clientId: string,
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
          startedByMe: usage.user_id === clientId,
          isReserved: reservedBy !== null,
          reservedByMe: reservedBy === clientId,
        },
      };
    }),
  };
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}

// usages.user_id は users.id を参照しているため、先に利用者を登録しておく
async function ensureUser(supabase: SupabaseClient, clientId: string) {
  return supabase
    .from("users")
    .upsert({ id: clientId }, { onConflict: "id", ignoreDuplicates: true });
}

async function start(
  supabase: SupabaseClient,
  clientId: string,
  machineId: number,
): Promise<Response | null> {
  const { error: userError } = await ensureUser(supabase, clientId);
  if (userError) {
    console.error("[/api/stopwatch] 利用者の登録に失敗しました:", userError);
    return errorResponse("開始に失敗しました。", 500);
  }

  const { error } = await supabase.from("usages").insert({
    machine_id: machineId,
    user_id: clientId,
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
  clientId: string,
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
  if (usage.user_id === clientId) {
    return errorResponse("自分が使用中の器具は予約できません。", 400);
  }

  const reservedBy = usage.reservations[0]?.user_id ?? null;
  if (reservedBy !== null) {
    return reservedBy === clientId
      ? null
      : errorResponse("既に他の人が予約しています。", 409);
  }

  const { error: userError } = await ensureUser(supabase, clientId);
  if (userError) {
    console.error("[/api/stopwatch] 利用者の登録に失敗しました:", userError);
    return errorResponse("予約に失敗しました。", 500);
  }

  const { error } = await supabase.from("reservations").insert({
    machine_id: machineId,
    user_id: clientId,
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

  const clientId = await getOrSetClientId();
  return stateResponse(supabase, clientId);
}

export async function POST(request: Request) {
  const supabase = getSupabase();
  if (!supabase) return errorResponse("操作に失敗しました。", 500);

  const clientId = await getOrSetClientId();

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
      failure = await start(supabase, clientId, machineId);
      break;
    case "reset":
      failure = await end(supabase, machineId);
      break;
    case "reserve":
      failure = await reserve(supabase, clientId, machineId);
      break;
  }
  if (failure) return failure;

  return stateResponse(supabase, clientId);
}
