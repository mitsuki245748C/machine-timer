import { redirect } from "next/navigation";
import { getCurrentUserId, isAdmin } from "./auth";
import { createSupabaseServerClient, getSupabaseEnv } from "./server";

export function adminError(error: string, status: number) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

// 管理者用ページの先頭で呼ぶ。管理者以外はトップページに戻す
export async function requireAdminPage(): Promise<void> {
  const userId = await getCurrentUserId();
  const env = getSupabaseEnv();
  if (!userId || env.error) redirect("/");

  const supabase = createSupabaseServerClient(env.data.supabaseUrl, env.data.supabaseKey);
  if (!(await isAdmin(supabase, userId))) redirect("/");
}

// 管理者用 API の先頭で呼ぶ。管理者以外には response（エラー）を返す
export async function adminContext() {
  const env = getSupabaseEnv();
  if (env.error) return { response: adminError("データベースに接続できません。", 500) };
  const userId = await getCurrentUserId();
  if (!userId) return { response: adminError("ログインしてください。", 401) };
  const supabase = createSupabaseServerClient(env.data.supabaseUrl, env.data.supabaseKey);
  if (!(await isAdmin(supabase, userId))) {
    return { response: adminError("管理者のみ利用できます。", 403) };
  }
  return { userId, supabase };
}
