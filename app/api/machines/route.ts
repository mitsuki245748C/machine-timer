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

export async function GET() {
  const env = getSupabaseEnv();

  if (env.error) {
    return Response.json(
      {
        error: "Supabase environment variables are missing.",
        missingEnvNames: env.error.missingEnvNames,
      },
      { status: 500 },
    );
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
    return Response.json(
      {
        error: "Failed to fetch machines.",
        details: error.message,
      },
      { status: 500 },
    );
  }

  return Response.json({ machines: data });
}
