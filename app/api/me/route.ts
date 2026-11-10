import { getCurrentUserId, isAdmin } from "@/lib/supabase/auth";
import { createSupabaseServerClient, getSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// ログイン中のユーザーの情報（ヘッダーで管理者メニューを出すかどうかに使う）
export async function GET() {
  const env = getSupabaseEnv();
  if (env.error) {
    return Response.json({ error: "データベースに接続できません。" }, { status: 500 });
  }
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "ログインしてください。" }, { status: 401 });

  const supabase = createSupabaseServerClient(env.data.supabaseUrl, env.data.supabaseKey);
  return Response.json(
    { isAdmin: await isAdmin(supabase, userId) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
