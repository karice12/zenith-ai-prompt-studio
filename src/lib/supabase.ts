import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("[Zenith AI] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não definidos. Verifique os Secrets do Replit.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "zenith-auth",
    detectSessionInUrl: true,
  },
});

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);
