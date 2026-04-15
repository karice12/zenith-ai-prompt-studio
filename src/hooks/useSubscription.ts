import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

type SubscriptionStatus = "active" | "inactive" | "past_due" | "cancelled" | null;

interface UseSubscriptionResult {
  status: SubscriptionStatus;
  isActive: boolean;
  loading: boolean;
}

export function useSubscription(): UseSubscriptionResult {
  const { user } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !user) {
      setStatus(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchStatus() {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("subscription_status")
        .eq("id", user!.id)
        .single();

      if (!cancelled) {
        setStatus(error || !data ? null : (data.subscription_status as SubscriptionStatus));
        setLoading(false);
      }
    }

    fetchStatus();

    const channel = supabase
      .channel(`profile-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => {
          if (!cancelled) {
            setStatus((payload.new as { subscription_status: SubscriptionStatus }).subscription_status);
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { status, isActive: status === "active", loading };
}
