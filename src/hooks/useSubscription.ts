import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

type SubscriptionStatus = "active" | "inactive" | "past_due" | "cancelled" | null;

interface UseSubscriptionResult {
  status: SubscriptionStatus;
  isActive: boolean;
  loading: boolean;
  refetch: () => Promise<SubscriptionStatus>;
}

export function useSubscription(): UseSubscriptionResult {
  const { user } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async (): Promise<SubscriptionStatus> => {
    if (!supabase || !user) {
      setStatus(null);
      setLoading(false);
      return null;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("subscription_status")
      .eq("id", user.id)
      .single();

    const nextStatus = error || !data ? null : (data.subscription_status as SubscriptionStatus);
    setStatus(nextStatus);
    setLoading(false);
    return nextStatus;
  }, [user]);

  useEffect(() => {
    if (!supabase || !user) {
      setStatus(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchStatus() {
      const nextStatus = await refetch();
      if (!cancelled) setStatus(nextStatus);
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
  }, [user, refetch]);

  return { status, isActive: status === "active", loading, refetch };
}
