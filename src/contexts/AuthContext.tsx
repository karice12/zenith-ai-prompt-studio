import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, supabaseConfigError } from "@/lib/supabase";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const clearInvalidSession = async () => {
    if (!supabase) return;
    await supabase.auth.signOut({ scope: "local" });
    setSession(null);
    setUser(null);
  };

  const getEmailRedirectTo = () => {
    if (typeof window !== "undefined") return window.location.origin;
    return undefined;
  };

  useEffect(() => {
    if (!supabase) {
      setSession(null);
      setUser(null);
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error || !session) {
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      const expiresAt = session.expires_at ? session.expires_at * 1000 : null;
      const currentSession =
        expiresAt && expiresAt <= Date.now()
          ? (await supabase.auth.refreshSession()).data.session
          : session;

      if (!currentSession) {
        await clearInvalidSession();
        setLoading(false);
        return;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser(
        currentSession.access_token
      );
      if (userError || !userData.user) {
        await clearInvalidSession();
        setLoading(false);
        return;
      }

      setSession(currentSession);
      setUser(userData.user);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!supabase) return { error: supabaseConfigError };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string, name: string) => {
    if (!supabase) return { error: supabaseConfigError };
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: getEmailRedirectTo(),
      },
    });

    if (error) return { error: error.message };

    if (data.user) {
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(
          { id: data.user.id, email: data.user.email, subscription_status: "inactive" },
          { onConflict: "id" }
        );

      if (profileError) {
        console.error("Profile creation error:", profileError.message);
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut({ scope: "local" });
  };

  const getToken = async (): Promise<string | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
      await clearInvalidSession();
      return null;
    }

    const expiresAt = data.session.expires_at ? data.session.expires_at * 1000 : null;
    const session =
      expiresAt && expiresAt <= Date.now()
        ? (await supabase.auth.refreshSession()).data.session
        : data.session;

    if (!session) {
      await clearInvalidSession();
      return null;
    }

    const { error: userError } = await supabase.auth.getUser(session.access_token);
    if (userError) {
      await clearInvalidSession();
      return null;
    }
    return session.access_token;
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signIn, signUp, signOut, getToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
