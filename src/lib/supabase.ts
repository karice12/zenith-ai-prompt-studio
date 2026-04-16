import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);
export const supabaseConfigError =
  "VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY precisam estar configurados no ambiente.";

if (!isSupabaseConfigured) {
  console.warn(`[Zenith AI] ${supabaseConfigError}`);
}

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: "zenith-auth",
        detectSessionInUrl: true,
      },
    })
  : null;
