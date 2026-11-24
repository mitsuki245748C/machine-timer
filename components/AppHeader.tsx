"use client";

import { ClipboardListIcon, LogOutIcon, QrCodeIcon, TimerIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { ThemeSwitcher } from "./ThemeSwitcher";

type Props = {
  // ログイン前の画面ではメニューを表示せず、管理者かどうかも問い合わせない
  showMenu?: boolean;
};

// 共通ヘッダー。配色はログイン前でも変更できる。
export function AppHeader({ showMenu = true }: Props) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  useEffect(() => {
    if (!showMenu) return;
    const controller = new AbortController();
    fetch("/api/me", { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => setIsAdmin(body?.isAdmin === true))
      .catch(() => {
        // 取得できなければ管理者向けのリンクを出さないだけ
      });
    return () => controller.abort();
  }, [showMenu]);

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setLogoutError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) {
        // 通信に失敗しても、このブラウザのセッションは消去済みの場合がある。
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || data.session) throw error;
      }
      window.location.replace("/login");
    } catch {
      setLogoutError("ログアウトできませんでした。もう一度お試しください。");
      setIsLoggingOut(false);
    }
  }

  return (
    <header className="app-header">
      <Link href="/" className="app-header-home" aria-label="器具一覧へ">
        <TimerIcon aria-hidden size={24} />
      </Link>
      <div className="app-header-actions">
        {showMenu && (
          <nav className="app-header-menu" aria-label="ユーザーメニュー">
            <Link href="/records">
              <ClipboardListIcon aria-hidden size={18} />
              記録
            </Link>
            {isAdmin && (
              <>
                <Link href="/admin/users">
                  <UsersIcon aria-hidden size={18} />
                  ユーザー
                </Link>
                <Link href="/admin/qr">
                  <QrCodeIcon aria-hidden size={18} />
                  QR
                </Link>
              </>
            )}
            <button type="button" onClick={() => void handleLogout()} disabled={isLoggingOut}>
              <LogOutIcon aria-hidden size={18} />
              {isLoggingOut ? "ログアウト中…" : "ログアウト"}
            </button>
            {logoutError && <p className="app-header-error" role="alert">{logoutError}</p>}
          </nav>
        )}
        <ThemeSwitcher />
      </div>
    </header>
  );
}
