import { createBrowserClient } from "@supabase/ssr";

// ブラウザ側で使う Supabase クライアント
// ログイン状態（セッション）を持ち、ログイン操作やユーザー情報の取得に使う。
// 既存の server.ts（Secret keyでサーバーが使う用）とは別系統。
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}