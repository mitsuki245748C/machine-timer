"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

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
      <header className="banner">Machine Timer</header>
      <main className="machine-panel" aria-label="ログイン">
      <p style={{ color: "#a1a1aa" }}>
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
            border: "1px solid #3f3f46",
            backgroundColor: "#27272a",
            color: "#ffffff",
          }}
        >
          ログイン
        </button>
      </main>
    </div>
  );
}