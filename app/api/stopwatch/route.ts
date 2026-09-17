import { cookies } from "next/headers";
import type { StopwatchResponse } from "../../stopwatch/model";

const CLIENT_ID_COOKIE = "machine-timer-client-id";

type Timer = {
  startedAt: number | null;
  elapsedMilliseconds: number;
  startedBy: string | null;
  reservedBy: string | null;
};

// Single-process demo storage. Restarting the server clears the timers.
const timers = new Map<number, Timer>();

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

function getOrCreateTimer(machineId: number): Timer {
  let timer = timers.get(machineId);
  if (!timer) {
    timer = { startedAt: null, elapsedMilliseconds: 0, startedBy: null, reservedBy: null };
    timers.set(machineId, timer);
  }
  return timer;
}

function elapsedMilliseconds(timer: Timer, now: number): number {
  return timer.elapsedMilliseconds +
    (timer.startedAt === null ? 0 : now - timer.startedAt);
}

function stateResponse(now: number, clientId: string): Response {
  const data: StopwatchResponse = {
    machines: Array.from(timers, ([id, timer]) => ({
      id,
      state: {
        isRunning: timer.startedAt !== null,
        seconds: Math.floor(elapsedMilliseconds(timer, now) / 1000),
        startedByMe: timer.startedBy !== null && timer.startedBy === clientId,
        isReserved: timer.reservedBy !== null,
        reservedByMe: timer.reservedBy !== null && timer.reservedBy === clientId,
      },
    })),
  };
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  const clientId = await getOrSetClientId();
  return stateResponse(Date.now(), clientId);
}

export async function POST(request: Request) {
  const clientId = await getOrSetClientId();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON形式で送信してください。" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json({ error: "リクエストが不正です。" }, { status: 400 });
  }

  const { action, machineId } = body as Record<string, unknown>;
  if (action !== "start" && action !== "stop" && action !== "reset" && action !== "reserve") {
    return Response.json({ error: "操作が不正です。" }, { status: 400 });
  }
  if (typeof machineId !== "number" || !Number.isSafeInteger(machineId) || machineId < 1) {
    return Response.json({ error: "マシンIDが不正です。" }, { status: 400 });
  }

  const timer = getOrCreateTimer(machineId);

  const now = Date.now();
  switch (action) {
    case "start":
      if (timer.startedAt === null) {
        timer.startedAt = now;
        timer.startedBy = clientId;
      }
      break;
    case "stop":
      timer.elapsedMilliseconds = elapsedMilliseconds(timer, now);
      timer.startedAt = null;
      break;
    case "reset":
      timer.startedAt = null;
      timer.elapsedMilliseconds = 0;
      timer.startedBy = null;
      timer.reservedBy = null;
      break;
    case "reserve":
      if (timer.startedAt === null) {
        return Response.json({ error: "使用中でない器具は予約できません。" }, { status: 400 });
      }
      if (timer.reservedBy !== null && timer.reservedBy !== clientId) {
        return Response.json({ error: "既に他の人が予約しています。" }, { status: 409 });
      }
      timer.reservedBy = clientId;
      break;
  }
  return stateResponse(now, clientId);
}
