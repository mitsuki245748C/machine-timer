"use client";

import { ClipboardListIcon, QrCodeIcon, TimerIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ThemeSwitcher } from "./ThemeSwitcher";

type Props = {
  // ログイン前の画面では管理者かどうかを問い合わせない
  showMenu?: boolean;
};

// 全画面共通のヘッダー。左のアイコンでトップへ戻り、右に記録画面へのリンク・配色の切り替え・（管理者には）管理者メニューを出す
export function AppHeader({ showMenu = true }: Props) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!showMenu) return;
    const controller = new AbortController();
    fetch("/api/me", { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => setIsAdmin(body?.isAdmin === true))
      .catch(() => {
        // 取得できなければメニューを出さないだけ
      });
    return () => controller.abort();
  }, [showMenu]);

  return (
    <header className="app-header">
      <Link href="/" className="app-header-home" aria-label="器具一覧へ">
        <TimerIcon aria-hidden size={24} />
      </Link>
      <div className="app-header-actions">
        {showMenu && (
          <nav className="app-header-menu" aria-label="メニュー">
            <Link href="/records">
              <ClipboardListIcon aria-hidden size={18} />
              記録
            </Link>
            {isAdmin && <>
              <Link href="/admin/users">
                <UsersIcon aria-hidden size={18} />
                ユーザー
              </Link>
              <Link href="/admin/qr">
                <QrCodeIcon aria-hidden size={18} />
                QR
              </Link>
            </>}
          </nav>
        )}
        <ThemeSwitcher />
      </div>
    </header>
  );
}