import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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
