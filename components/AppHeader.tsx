"use client";

import { ClipboardListIcon, LogOutIcon, MenuIcon, QrCodeIcon, UsersIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { ThemeSwitcher } from "./ThemeSwitcher";

type Props = {
  // ログイン前の画面ではメニューを表示せず、管理者かどうかも問い合わせない
  showMenu?: boolean;
};

// 共通ヘッダー。記録へのリンクだけ外に出し、ユーザー・QR・ログアウト・配色はハンバーガーメニューにまとめる。配色はログイン前でも変更できる。
export function AppHeader({ showMenu = true }: Props) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // メニューの外を押したり Esc を押したりしたら閉じる
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

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
        Perfect Muscle
      </Link>
      <div className="app-header-actions">
        {showMenu && (
          <Link href="/records" className="app-header-records">
            <ClipboardListIcon aria-hidden size={18} />
            記録
          </Link>
        )}
        <div className="app-header-hamburger" ref={menuRef}>
          <button
            type="button"
            className="app-header-toggle"
            aria-label="メニュー"
            aria-expanded={menuOpen}
            aria-controls="app-header-panel"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <XIcon aria-hidden size={20} /> : <MenuIcon aria-hidden size={20} />}
          </button>
          {menuOpen && (
            <div id="app-header-panel" className="app-header-panel">
              <nav className="app-header-menu" aria-label="メニュー">
                {showMenu && isAdmin && (
                  <>
                    <Link href="/admin/users" onClick={() => setMenuOpen(false)}>
                      <UsersIcon aria-hidden size={18} />
                      ユーザー
                    </Link>
                    <Link href="/admin/qr" onClick={() => setMenuOpen(false)}>
                      <QrCodeIcon aria-hidden size={18} />
                      QR
                    </Link>
                  </>
                )}
                <ThemeSwitcher />
                {showMenu && (
                  <>
                    <button type="button" onClick={() => void handleLogout()} disabled={isLoggingOut}>
                      <LogOutIcon aria-hidden size={18} />
                      {isLoggingOut ? "ログアウト中…" : "ログアウト"}
                    </button>
                    {logoutError && <p className="app-header-error" role="alert">{logoutError}</p>}
                  </>
                )}
              </nav>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
