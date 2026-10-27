export const metadata = {
  title: "プライバシーポリシー | Perfect Muscle",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="home">
      <header className="banner">Perfect Muscle</header>
      <main
        style={{
          flex: 1,
          maxWidth: "720px",
          margin: "0 auto",
          padding: "3rem 1.5rem",
          color: "#e4e4e7",
          lineHeight: 1.8,
        }}
      >
        <h1 style={{ color: "#ffffff", fontSize: "2rem", marginBottom: "0.5rem" }}>
          プライバシーポリシー
        </h1>
        <p style={{ color: "#a1a1aa", fontSize: "0.9rem", marginBottom: "2rem" }}>
          最終更新日：2026年10月27日
        </p>

        <section style={{ marginBottom: "1.75rem" }}>
          <p>
            Perfect Muscle（以下「本アプリ」）は、ユーザーの個人情報の取り扱いについて、
            以下のとおりプライバシーポリシーを定めます。
          </p>
        </section>

        <section style={{ marginBottom: "1.75rem" }}>
          <h2 style={{ color: "#ffffff", fontSize: "1.25rem", marginBottom: "0.5rem" }}>
            1. 取得する情報
          </h2>
          <p>本アプリは、サービスの提供のために以下の情報を取得します。</p>
          <ul style={{ paddingLeft: "1.25rem" }}>
            <li>
              Googleアカウントによるログイン時に提供される情報（メールアドレス、氏名、
              プロフィール画像など）
            </li>
            <li>トレーニング記録（種目、重量、回数、使用時間などの入力情報）</li>
          </ul>
        </section>

        <section style={{ marginBottom: "1.75rem" }}>
          <h2 style={{ color: "#ffffff", fontSize: "1.25rem", marginBottom: "0.5rem" }}>
            2. 情報の利用目的
          </h2>
          <p>取得した情報は、以下の目的で利用します。</p>
          <ul style={{ paddingLeft: "1.25rem" }}>
            <li>ユーザーの認証およびアカウントの管理</li>
            <li>トレーニング記録の保存・表示</li>
            <li>本アプリの機能提供および改善</li>
          </ul>
        </section>

        <section style={{ marginBottom: "1.75rem" }}>
          <h2 style={{ color: "#ffffff", fontSize: "1.25rem", marginBottom: "0.5rem" }}>
            3. 情報の第三者提供
          </h2>
          <p>
            本アプリは、法令に基づく場合を除き、ユーザーの同意なく個人情報を第三者に
            提供することはありません。
          </p>
        </section>

        <section style={{ marginBottom: "1.75rem" }}>
          <h2 style={{ color: "#ffffff", fontSize: "1.25rem", marginBottom: "0.5rem" }}>
            4. 情報の管理
          </h2>
          <p>
            取得した情報は、認証基盤およびデータベースサービス（Supabase）上で
            適切に管理します。本アプリは、情報の漏洩・滅失・毀損の防止に努めます。
          </p>
        </section>

        <section style={{ marginBottom: "1.75rem" }}>
          <h2 style={{ color: "#ffffff", fontSize: "1.25rem", marginBottom: "0.5rem" }}>
            5. 情報の削除
          </h2>
          <p>
            ユーザーは、自身のアカウントおよび記録の削除を希望する場合、
            下記の連絡先までお問い合わせください。

            e245735@ie.u-ryukyu.ac.jp
          </p>
        </section>

        <section style={{ marginBottom: "1.75rem" }}>
          <h2 style={{ color: "#ffffff", fontSize: "1.25rem", marginBottom: "0.5rem" }}>
            6. お問い合わせ
          </h2>
          <p>
            本ポリシーに関するお問い合わせは、本アプリの運営者までご連絡ください。
          </p>
        </section>

        <section style={{ marginBottom: "1.75rem" }}>
          <h2 style={{ color: "#ffffff", fontSize: "1.25rem", marginBottom: "0.5rem" }}>
            7. 本ポリシーの変更
          </h2>
          <p>
            本アプリは、必要に応じて本プライバシーポリシーを変更することがあります。
            変更後のポリシーは、本ページに掲載された時点で効力を生じるものとします。
          </p>
        </section>
      </main>
    </div>
  );
}