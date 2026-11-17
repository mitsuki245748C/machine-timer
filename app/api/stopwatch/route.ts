import { after } from "next/server";

import { computeDeadline } from "@/lib/deadline";
import { notifyUsageDeadline } from "@/lib/notify-deadline";
import { notifyReservation } from "@/lib/notify-reservation";
import { getCurrentUserId, isAdmin } from "@/lib/supabase/auth";
import {
  createSupabaseServerClient,
  getSupabaseEnv,
} from "@/lib/supabase/server";
import {
  RESERVATION_HOLD_SECONDS,
  type StopwatchResponse,
} from "../../stopwatch/model";

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

// 予約が付いた利用が終わった直後の器具。until まではその予約者だけが開始できる
type Hold = {
  usageId: number;
  userId: string;
  until: number;
};

type EndedUsage = {
  id: number;
  machine_id: number;
  ended_at: string;
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

// 直近に終わった利用のうち、器具ごとに最後の1件を見て、予約が付いていれば予約者の順番とする。
// 予約者やほかの人がその後に使い始めていれば、その利用のほうが新しいので順番は終わっている
async function fetchHolds(supabase: SupabaseClient, now: number) {
  const since = new Date(now - RESERVATION_HOLD_SECONDS * 1000).toISOString();
  const { data, error } = await supabase
    .from("usages")
    .select("id, machine_id, ended_at, reservations(user_id)")
    .gt("ended_at", since)
    .order("ended_at", { ascending: false })
    .overrideTypes<EndedUsage[]>();
  if (error) return { holds: null, error };

  const holds = new Map<number, Hold>();
  const seen = new Set<number>();
  for (const usage of data ?? []) {
    if (seen.has(usage.machine_id)) continue;
    seen.add(usage.machine_id);
    const reservedBy = usage.reservations[0]?.user_id ?? null;
    if (reservedBy) {
      holds.set(usage.machine_id, {
        usageId: usage.id,
        userId: reservedBy,
        until: Date.parse(usage.ended_at) + RESERVATION_HOLD_SECONDS * 1000,
      });
    }
  }
  return { holds, error: null };
}

function secondsLeft(hold: Hold, now: number): number {
  return Math.max(1, Math.ceil((hold.until - now) / 1000));
}

async function stateResponse(
  supabase: SupabaseClient,
  userId: string,
  admin: boolean,
): Promise<Response> {
  const now = Date.now();
  const [{ data: usages, error }, { holds, error: holdError }] = await Promise.all([
    fetchActiveUsages(supabase),
    fetchHolds(supabase, now),
  ]);
  if (error || holdError || !holds) {
    console.error("[/api/stopwatch] 状態の取得に失敗しました:", error ?? holdError);
    return errorResponse("状態の取得に失敗しました。", 500);
  }

  const activeMachineIds = new Set((usages ?? []).map(({ machine_id }) => machine_id));
  // 使用中の器具は順番待ちではないので除く
  const idleHolds = [...holds].filter(([machineId]) => !activeMachineIds.has(machineId));
  const myReservation =
    (usages ?? []).find((usage) => usage.reservations[0]?.user_id === userId)?.machine_id ??
    idleHolds.find(([, hold]) => hold.userId === userId)?.[0] ??
    null;

  const data: StopwatchResponse = {
    isAdmin: admin,
    myReservationMachineId: myReservation,
    machines: [
      ...(usages ?? []).map((usage) => {
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
            hold: null,
          },
        };
      }),
      ...idleHolds.map(([machineId, hold]) => ({
        id: machineId,
        state: {
          isRunning: false,
          seconds: 0,
          startedByMe: false,
          isReserved: true,
          reservedByMe: hold.userId === userId,
          hold: { forMe: hold.userId === userId, secondsLeft: secondsLeft(hold, now) },
        },
      })),
    ],
  };
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}

async function start(
  supabase: SupabaseClient,
  userId: string,
  machineId: number,
): Promise<Response | null> {
  const now = Date.now();
  const { holds, error: holdError } = await fetchHolds(supabase, now);
  if (holdError || !holds) {
    console.error("[/api/stopwatch] 予約の確認に失敗しました:", holdError);
    return errorResponse("開始に失敗しました。", 500);
  }
  const hold = holds.get(machineId);
  if (hold && hold.userId !== userId) {
    const left = secondsLeft(hold, now);
    return errorResponse(
      `予約した人の順番です。あと${Math.floor(left / 60)}分${left % 60}秒で使えるようになります。`,
      409,
    );
  }

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

// 自分の利用は誰でも、他人の利用は管理者だけが終了できる（管理者の強制終了）
async function end(
  supabase: SupabaseClient,
  userId: string,
  admin: boolean,
  machineId: number,
): Promise<Response | null> {
  let query = supabase
    .from("usages")
    .update({ ended_at: new Date().toISOString() })
    .eq("machine_id", machineId)
    .is("ended_at", null);

  if (!admin) {
    const { data: usage, error: usageError } = await supabase
      .from("usages")
      .select("user_id")
      .eq("machine_id", machineId)
      .is("ended_at", null)
      .maybeSingle<{ user_id: string | null }>();
    if (usageError) {
      console.error("[/api/stopwatch] 状態の取得に失敗しました:", usageError);
      return errorResponse("終了に失敗しました。", 500);
    }
    if (usage && usage.user_id !== userId) {
      return errorResponse("他の人の利用は終了できません。", 403);
    }
    query = query.eq("user_id", userId);
  }

  const { data: ended, error } = await query
    .select("id")
    .overrideTypes<{ id: number }[]>();
  if (error) {
    console.error("[/api/stopwatch] 終了に失敗しました:", error);
    return errorResponse("終了に失敗しました。", 500);
  }

  // 実際に終了した利用があるときだけ、レスポンスを返した後で予約者に知らせる
  for (const { id } of ended ?? []) {
    after(() => notifyReservation(supabase, userId, id));
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
      : errorResponse("ほかの人がすでに予約しているため、予約できませんでした。", 409);
  }

  // 予約は1人1つまで（使用中の器具の予約と、順番が来ている器具を合わせて数える）
  const { holds, error: holdError } = await fetchHolds(supabase, Date.now());
  if (holdError || !holds) {
    console.error("[/api/stopwatch] 予約の確認に失敗しました:", holdError);
    return errorResponse("予約に失敗しました。", 500);
  }
  const activeMachineIds = new Set((usages ?? []).map(({ machine_id }) => machine_id));
  const hasOtherReservation =
    (usages ?? []).some((other) => other.reservations[0]?.user_id === userId) ||
    [...holds].some(
      ([otherMachineId, hold]) => hold.userId === userId && !activeMachineIds.has(otherMachineId),
    );
  if (hasOtherReservation) {
    return errorResponse(
      "予約は1人1つまでです。ほかの器具の予約をキャンセルしてから予約してください。",
      409,
    );
  }

  // 予約時の通知も「通知済み」として記録し、cron が同じ内容を重ねて送らないようにする
  const now = new Date();
  const deadline = computeDeadline(new Date(usage.started_at), now);
  const { error } = await supabase.from("reservations").insert({
    machine_id: machineId,
    user_id: userId,
    usage_id: usage.id,
    deadline_at: deadline.toISOString(),
    last_notified_at: now.toISOString(),
  });
  // 同時に予約された場合は一意制約で弾かれる
  if (error?.code === UNIQUE_VIOLATION) {
    return errorResponse("ほかの人がすでに予約しているため、予約できませんでした。", 409);
  }
  if (error) {
    console.error("[/api/stopwatch] 予約に失敗しました:", error);
    return errorResponse("予約に失敗しました。", 500);
  }

  // 使用中の人に、予約が入ったことをレスポンスを返した後で知らせる
  const usedBy = usage.user_id;
  if (usedBy) {
    after(() =>
      notifyUsageDeadline(supabase, "reserved", {
        userId: usedBy,
        machineId,
        deadline,
      }),
    );
  }
  return null;
}

async function cancelReservation(
  supabase: SupabaseClient,
  userId: string,
  machineId: number,
): Promise<Response | null> {
  const { data: usages, error: usageError } = await fetchActiveUsages(supabase);
  if (usageError) {
    console.error("[/api/stopwatch] 状態の取得に失敗しました:", usageError);
    return errorResponse("予約のキャンセルに失敗しました。", 500);
  }

  const usage = usages?.find(({ machine_id }) => machine_id === machineId);
  let usageId = usage?.id;
  let reservedBy = usage?.reservations[0]?.user_id ?? null;

  // 空いていて自分の順番の器具も、キャンセルすればすぐにほかの人が使える
  if (!usage) {
    const { holds, error: holdError } = await fetchHolds(supabase, Date.now());
    if (holdError || !holds) {
      console.error("[/api/stopwatch] 予約の確認に失敗しました:", holdError);
      return errorResponse("予約のキャンセルに失敗しました。", 500);
    }
    const hold = holds.get(machineId);
    usageId = hold?.usageId;
    reservedBy = hold?.userId ?? null;
  }

  if (usageId === undefined || reservedBy === null) return null;
  if (reservedBy !== userId) {
    return errorResponse("他の人の予約はキャンセルできません。", 403);
  }

  const { error } = await supabase
    .from("reservations")
    .delete()
    .eq("usage_id", usageId)
    .eq("user_id", userId);
  if (error) {
    console.error("[/api/stopwatch] 予約のキャンセルに失敗しました:", error);
    return errorResponse("予約のキャンセルに失敗しました。", 500);
  }
  return null;
}

export async function GET() {
  const supabase = getSupabase();
  if (!supabase) return errorResponse("状態の取得に失敗しました。", 500);

  const userId = await getCurrentUserId();
  if (!userId) return errorResponse("ログインしてください。", 401);
  return stateResponse(supabase, userId, await isAdmin(supabase, userId));
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
  if (action !== "start" && action !== "reset" && action !== "reserve" && action !== "cancel") {
    return errorResponse("操作が不正です。", 400);
  }
  if (typeof machineId !== "number" || !Number.isSafeInteger(machineId) || machineId < 1) {
    return errorResponse("マシンIDが不正です。", 400);
  }

  const admin = await isAdmin(supabase, userId);

  let failure: Response | null;
  switch (action) {
    case "start":
      failure = await start(supabase, userId, machineId);
      break;
    case "reset":
      failure = await end(supabase, userId, admin, machineId);
      break;
    case "reserve":
      failure = await reserve(supabase, userId, machineId);
      break;
    case "cancel":
      failure = await cancelReservation(supabase, userId, machineId);
      break;
  }
  if (failure) return failure;

  return stateResponse(supabase, userId, admin);
}
