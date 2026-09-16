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

const SUPABASE_KEY_ENV_NAMES = [
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
] as const;

export function getSupabaseEnv(): SupabaseEnv {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = [
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_ANON_KEY,
  ].find((value): value is string => Boolean(value?.trim()));

  if (!supabaseUrl || !supabaseKey) {
    const missingEnvNames: string[] = [];
    if (!supabaseUrl) {
      missingEnvNames.push("NEXT_PUBLIC_SUPABASE_URL");
    }
    if (!supabaseKey) {
      missingEnvNames.push(SUPABASE_KEY_ENV_NAMES.join(" or "));
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
