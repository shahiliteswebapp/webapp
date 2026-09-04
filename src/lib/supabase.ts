import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/*
 * Server-side Supabase client. Uses the project's secret key
 * (sb_secret_… / legacy service_role) — bypasses RLS; the app does its own
 * auth. Used only from route handlers / server actions / RSC.
 */

function secretKey(): string | undefined {
  return (
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    undefined
  );
}

export function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && secretKey());
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      secretKey() as string,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return client;
}
