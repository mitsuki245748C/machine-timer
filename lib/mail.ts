import nodemailer from "nodemailer";

type Mail = {
  to: string;
  subject: string;
  text: string;
};

// Gmail の SMTP でメールを送る。送信元は環境変数のアカウント（アプリパスワードで認証）。
// 送信手段を変えるときは、このファイルだけ差し替える。
export async function sendMail({ to, subject, text }: Mail): Promise<void> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    console.error(
      "[mail] GMAIL_USER / GMAIL_APP_PASSWORD が未設定のため、メールを送信しません。",
    );
    return;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  await transporter.sendMail({ from: user, to, subject, text });
  console.log(`[mail] 送信しました: ${to} 件名「${subject}」`);
}
