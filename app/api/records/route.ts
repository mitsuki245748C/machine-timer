import { cookies } from "next/headers";

// 1セット分のデータ
type SetData = {
  weight: string;
  reps: string;
};

// Cookie名を作る（マシンごとに分ける）
function cookieName(machineId: number): string {
  return `machine-timer-record-${machineId}`;
}

// 保存
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

  const { machineId, sets } = body as Record<string, unknown>;

  if (typeof machineId !== "number" || !Number.isSafeInteger(machineId) || machineId < 1) {
    return Response.json({ error: "マシンIDが不正です。" }, { status: 400 });
  }
  if (!Array.isArray(sets)) {
    return Response.json({ error: "記録の形式が不正です。" }, { status: 400 });
  }

  const cookieStore = await cookies();
  cookieStore.set(cookieName(machineId), encodeURIComponent(JSON.stringify(sets)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return Response.json({ ok: true });
}

// 読み出し：GET /api/records?machineId=1
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const machineId = Number(searchParams.get("machineId"));

  if (!Number.isSafeInteger(machineId) || machineId < 1) {
    return Response.json({ error: "マシンIDが不正です。" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const raw = cookieStore.get(cookieName(machineId))?.value;

  let sets: SetData[] = [];
  if (raw) {
    try {
      sets = JSON.parse(decodeURIComponent(raw));
    } catch {
      sets = [];
    }
  }

  return Response.json({ sets });
}