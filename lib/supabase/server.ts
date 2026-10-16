import { createClient } from "@supabase/supabase-js";

type SupabaseEnv =
  | {
      data: {
        supabaseUrl: string;
        supabaseKey: string;
      };
      error?: never;
    }
  | {
      data?: never;
      error: {
        missingEnvNames: string[];
      };
    };

export function getSupabaseEnv(): SupabaseEnv {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY?.trim();

  if (!supabaseUrl || !supabaseKey) {
    const missingEnvNames: string[] = [];
    if (!supabaseUrl) {
      missingEnvNames.push("NEXT_PUBLIC_SUPABASE_URL");
    }
    if (!supabaseKey) {
      missingEnvNames.push("SUPABASE_SECRET_KEY");
    }
    return {
      error: {
        missingEnvNames,
      },
    };
  }

  return {
    data: {
      supabaseUrl,
      supabaseKey,
    },
  };
}

export function createSupabaseServerClient(
  supabaseUrl: string,
  supabaseKey: string,
) {
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
  });
}
