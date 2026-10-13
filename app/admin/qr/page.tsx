import { headers } from "next/headers";
import QRCode from "qrcode";

import {
  createSupabaseServerClient,
  getSupabaseEnv,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Machine = {
  id: number;
  name: string;
};

// NEXT_PUBLIC_BASE_URL があればそれを優先し、なければ開いているページのURLから判定する
async function getBaseUrl(): Promise<string> {
  const envBaseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (envBaseUrl) return envBaseUrl.replace(/\/+$/, "");

  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  const proto = headersList.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

async function getMachines(): Promise<Machine[]> {
  const env = getSupabaseEnv();
  if (env.error) return [];

  const supabase = createSupabaseServerClient(
    env.data.supabaseUrl,
    env.data.supabaseKey,
  );
  const { data, error } = await supabase
    .from("machines")
    .select("id, name")
    .order("id", { ascending: true })
    .overrideTypes<Machine[]>();

  if (error) {
    console.error("[/admin/qr] 器具一覧の取得に失敗しました:", error);
    return [];
  }
  return data ?? [];
}

export default async function QrAdminPage() {
  const baseUrl = await getBaseUrl();
  const machines = await getMachines();

  const items = await Promise.all(
    machines.map(async (machine) => {
      const url = `${baseUrl}/m/${machine.id}`;
      const svg = await QRCode.toString(url, {
        type: "svg",
        margin: 2,
        errorCorrectionLevel: "M",
      });
      return { ...machine, url, svg };
    }),
  );

  return (
    <main className="mx-auto max-w-6xl p-4">
      <h1 className="mb-1 text-lg font-bold">器具QRコード</h1>
      <p className="mb-3 text-xs text-gray-500 print:hidden">
        ベースURL: {baseUrl}（印刷用は本番のドメインでこのページを開いてください）
      </p>
      {items.length === 0 && <p>器具が見つかりませんでした。</p>}
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex break-inside-avoid flex-col items-center gap-1 rounded border p-2"
          >
            <div
              className="w-full"
              // 自分で生成したSVG文字列のみを埋め込む
              dangerouslySetInnerHTML={{ __html: item.svg }}
            />
            <p className="text-sm font-bold">{item.name}</p>
            <p className="break-all text-center text-[10px] text-gray-500">
              {item.url}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
