import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const PLACEHOLDER_URL = "https://placeholder.supabase.co";
const PLACEHOLDER_KEY = "placeholder-anon-key";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("[Zenith AI] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set. Auth features will not work until these secrets are configured.");
}

export const supabase = createClient(
  supabaseUrl || PLACEHOLDER_URL,
  supabaseAnonKey || PLACEHOLDER_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: "zenith-auth",
    },
  }
);

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);
