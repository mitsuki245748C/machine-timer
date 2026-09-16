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
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return {
      error: {
        missingEnvNames: [
          !supabaseUrl ? "NEXT_PUBLIC_SUPABASE_URL" : null,
          !supabaseKey
            ? "SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
            : null,
        ].filter((envName): envName is string => envName !== null),
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

export function createSupabaseServerClient( supabaseUrl: string, supabaseKey: string) {
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
  });
}
