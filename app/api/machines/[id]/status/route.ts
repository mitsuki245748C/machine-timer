import {
  createSupabaseServerClient,
  getSupabaseEnv,
} from "@/lib/supabase/server";

const MACHINE_STATUSES = ["空き", "使用中"] as const;

type MachineStatus = (typeof MACHINE_STATUSES)[number];

type Machine = {
  id: number;
  name: string;
  status: MachineStatus;
};

function isMachineStatus(status: unknown): status is MachineStatus {
  return (
    typeof status === "string" &&
    MACHINE_STATUSES.includes(status as MachineStatus)
  );
}

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const machineId = Number(id);

  if (!Number.isInteger(machineId) || machineId <= 0) {
    return Response.json(
      { error: "Machine id must be a positive integer." },
      { status: 400 },
    );
  }

  const body = (await request.json()) as { status?: unknown };

  if (!isMachineStatus(body.status)) {
    return Response.json(
      {
        error: "Machine status is invalid.",
        allowedStatuses: MACHINE_STATUSES,
      },
      { status: 400 },
    );
  }

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
    .update({ status: body.status })
    .eq("id", machineId)
    .select("id, name, status")
    .single()
    .overrideTypes<Machine>();

  if (error) {
    return Response.json(
      {
        error: "Failed to update machine status.",
        details: error.message,
      },
      { status: 500 },
    );
  }

  return Response.json({ machine: data });
}
