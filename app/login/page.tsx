"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { AppHeader } from "@/components/AppHeader";

export default function LoginPage() {
  async function handleGoogleLogin() {
    const supabase = createSupabaseBrowserClient();

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // ログイン後に戻ってくる先（③-2で作るコールバック）
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <div className="home">
      <AppHeader showMenu={false} />
      <main className="machine-panel" aria-label="ログイン">
        <p className="login-message">
          Googleアカウントでログインしてください
        </p>
        <button className="login-button" onClick={() => void handleGoogleLogin()}>
          ログイン
        </button>
      </main>
    </div>
  );
}