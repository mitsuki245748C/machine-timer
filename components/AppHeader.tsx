"use client";

import { QrCodeIcon, TimerIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type Props = {
  // ログイン前の画面では管理者かどうかを問い合わせない
  showMenu?: boolean;
};

// 全画面共通の赤いヘッダー。左のアイコンでトップへ戻り、管理者には右に管理者メニューを出す
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
      {isAdmin && (
        <nav className="app-header-menu" aria-label="管理者メニュー">
          <Link href="/admin/users">
            <UsersIcon aria-hidden size={18} />
            ユーザー
          </Link>
          <Link href="/admin/qr">
            <QrCodeIcon aria-hidden size={18} />
            QR
          </Link>
        </nav>
      )}
    </header>
  );
}
