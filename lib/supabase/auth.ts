import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { createSupabaseServerClient } from "./server";

// ログインセッション（Cookie）から、今ログインしているユーザーのIDを取得する。
// 未ログインなら null。DBの読み書きは server.ts の Secret key のクライアントで行う。
export async function getCurrentUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// users.role が admin なら管理者。読み取りに失敗したときは管理者ではない扱いにする
export async function isAdmin(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .maybeSingle<{ role: string }>();
  if (error) {
    console.error("[isAdmin] 役割の取得に失敗しました:", error);
    return false;
  }
  return data?.role === "admin";
}
