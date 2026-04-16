import { useCallback, useEffect, useRef, useState } from "react";
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
  const fetchCountRef = useRef(0);

  const refetch = useCallback(async (): Promise<SubscriptionStatus> => {
    if (!supabase || !user) {
      setStatus(null);
      setLoading(false);
      return null;
    }

    setLoading(true);
    fetchCountRef.current += 1;
    const fetchId = fetchCountRef.current;

    const { data, error } = await supabase
      .from("profiles")
      .select("subscription_status, updated_at")
      .eq("id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[useSubscription] Erro ao buscar status:", error.message);
    }

    const nextStatus = error || !data ? null : (data.subscription_status as SubscriptionStatus);

    if (fetchCountRef.current === fetchId) {
      setStatus(nextStatus);
      setLoading(false);
    }

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
      .channel(`profile-sub-${user.id}-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => {
          if (!cancelled) {
            const newStatus = (payload.new as { subscription_status: SubscriptionStatus }).subscription_status;
            console.log("[useSubscription] Realtime update recebido:", newStatus);
            setStatus(newStatus);
          }
        }
      )
      .subscribe((channelStatus) => {
        console.log("[useSubscription] Canal realtime:", channelStatus);
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user, refetch]);

  return { status, isActive: status === "active", loading, refetch };
}
