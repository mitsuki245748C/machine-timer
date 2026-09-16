import { machines, type StopwatchResponse } from "../../stopwatch/model";

type Timer = {
  startedAt: number | null;
  elapsedMilliseconds: number;
};

// Single-process demo storage. Restarting the server clears the timers.
const timers = new Map<number, Timer>(
  machines.map(({ id }) => [id, { startedAt: null, elapsedMilliseconds: 0 }]),
);

function elapsedMilliseconds(timer: Timer, now: number): number {
  return timer.elapsedMilliseconds +
    (timer.startedAt === null ? 0 : now - timer.startedAt);
}

function stateResponse(now: number): Response {
  const data: StopwatchResponse = {
    machines: Array.from(timers, ([id, timer]) => ({
      id,
      state: {
        isRunning: timer.startedAt !== null,
        seconds: Math.floor(elapsedMilliseconds(timer, now) / 1000),
      },
    })),
  };
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  return stateResponse(Date.now());
}

export async function POST(request: Request) {
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
  if (action !== "start" && action !== "stop" && action !== "reset") {
    return Response.json({ error: "操作が不正です。" }, { status: 400 });
  }
  if (typeof machineId !== "number" || !Number.isSafeInteger(machineId) || machineId < 1) {
    return Response.json({ error: "マシンIDが不正です。" }, { status: 400 });
  }

  const timer = timers.get(machineId);
  if (!timer) {
    return Response.json({ error: "マシンが見つかりません。" }, { status: 404 });
  }

  const now = Date.now();
  switch (action) {
    case "start":
      if (timer.startedAt === null) timer.startedAt = now;
      break;
    case "stop":
      timer.elapsedMilliseconds = elapsedMilliseconds(timer, now);
      timer.startedAt = null;
      break;
    case "reset":
      timer.startedAt = null;
      timer.elapsedMilliseconds = 0;
      break;
  }
  return stateResponse(now);
}
