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
      <p style={{ color: "var(--text-subtle)" }}>
       Googleアカウントでログインしなさい
      </p>
        <button
          onClick={() => void handleGoogleLogin()}
          style={{
            padding: "12px 20px",
            fontSize: "1rem",
            fontWeight: 600,
            cursor: "pointer",
            borderRadius: "6px",
            border: "1px solid var(--login-border)",
            backgroundColor: "var(--login-bg)",
            color: "var(--login-text)",
          }}
        >
          ログイン
        </button>
      </main>
    </div>
  );
}