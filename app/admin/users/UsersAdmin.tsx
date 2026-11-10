"use client";

import { useEffect, useState } from "react";
import type { AdminUser, AdminUsersResponse, Role } from "./model";
import styles from "./users.module.css";

async function responseData<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? "処理に失敗しました。");
  return body as T;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("ja-JP");
}

export function UsersAdmin() {
  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/users", { cache: "no-store", signal: controller.signal })
      .then((response) => responseData<AdminUsersResponse>(response))
      .then((next) => {
        setData(next);
        setError("");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "ユーザー一覧を取得できませんでした。");
      });
    return () => controller.abort();
  }, [reload]);

  async function changeRole(user: AdminUser, role: Role) {
    const label = user.name ?? user.email ?? "このユーザー";
    const message =
      role === "admin" ? `${label}を管理者にしますか？` : `${label}を一般ユーザーに戻しますか？`;
    if (!window.confirm(message)) return;

    setUpdatingId(user.id);
    setError("");
    try {
      await responseData(
        await fetch("/api/admin/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, role }),
        }),
      );
      setReload((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "役割を変更できませんでした。");
    } finally {
      setUpdatingId(null);
    }
  }

  if (!data) {
    return error ? (
      <p role="alert" className={styles.error}>{error}</p>
    ) : (
      <p role="status" className={styles.muted}>読み込んでいます…</p>
    );
  }

  return (
    <>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <ul className={styles.list}>
        {data.users.map((user) => {
          const isMe = user.id === data.currentUserId;
          const isAdmin = user.role === "admin";
          const nextRole: Role = isAdmin ? "user" : "admin";
          return (
            <li key={user.id} className={`${styles.user} ${isAdmin ? styles.admin : ""}`}>
              <div className={styles.header}>
                <span className={styles.name}>{user.name ?? "名前なし"}</span>
                <span className={styles.badge}>{isAdmin ? "管理者" : "一般"}</span>
              </div>
              <p className={styles.detail}>{user.email ?? "メールアドレスなし"}</p>
              <p className={styles.detail}>登録日 {formatDate(user.created_at)}</p>
              {isMe ? (
                <p className={styles.me}>自分の役割は変更できません</p>
              ) : (
                <button
                  type="button"
                  className={isAdmin ? styles.demote : styles.promote}
                  onClick={() => void changeRole(user, nextRole)}
                  disabled={updatingId !== null}
                >
                  {updatingId === user.id
                    ? "更新中…"
                    : isAdmin
                      ? "一般に戻す"
                      : "管理者にする"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
