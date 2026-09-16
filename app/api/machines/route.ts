import {
  createSupabaseServerClient,
  getSupabaseEnv,
} from "@/lib/supabase/server";

type Machine = {
  id: number;
  name: string;
  status: string;
};

export const dynamic = "force-dynamic";

const GENERIC_ERROR_MESSAGE = "器具一覧の取得に失敗しました。";

export async function GET() {
  const env = getSupabaseEnv();

  if (env.error) {
    console.error(
      "[GET /api/machines] Supabase の環境変数が未設定です:",
      env.error.missingEnvNames.join(", "),
    );

    return Response.json({ error: GENERIC_ERROR_MESSAGE }, { status: 500 });
  }

  const supabase = createSupabaseServerClient(
    env.data.supabaseUrl,
    env.data.supabaseKey,
  );

  const { data, error } = await supabase
    .from("machines")
    .select("id, name, status")
    .order("id", { ascending: true })
    .overrideTypes<Machine[]>();

  if (error) {
    console.error("[GET /api/machines] 器具一覧の取得に失敗しました:", error);

    return Response.json({ error: GENERIC_ERROR_MESSAGE }, { status: 500 });
  }

  return Response.json({ machines: data ?? [] });
}
