import Link from "next/link";

import { AppHeader } from "@/components/AppHeader";
import { requireAdminPage } from "@/lib/supabase/admin";
import { UsersAdmin } from "./UsersAdmin";
import styles from "./users.module.css";

export const dynamic = "force-dynamic";

export default async function UsersAdminPage() {
  await requireAdminPage();

  return (
    <div className={styles.page} lang="ja">
      <AppHeader />
      <main className={styles.main}>
        <Link className={styles.back} href="/">‹ 器具一覧</Link>
        <h1>ユーザー管理</h1>
        <UsersAdmin />
      </main>
    </div>
  );
}
