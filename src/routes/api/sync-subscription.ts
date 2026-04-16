import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const jsonHeaders = { "Content-Type": "application/json" };

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: jsonHeaders });
}

function getAuthToken(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

function getSupabaseAuth() {
  return createClient(
    process.env.VITE_SUPABASE_URL as string,
    process.env.VITE_SUPABASE_ANON_KEY as string,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function getSupabaseAdmin() {
  return createClient(
    process.env.VITE_SUPABASE_URL as string,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: "2024-06-20",
  });
}

export const Route = createFileRoute("/api/sync-subscription")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const missing = [
          "VITE_SUPABASE_URL",
          "VITE_SUPABASE_ANON_KEY",
          "VITE_SUPABASE_SERVICE_ROLE_KEY",
          "STRIPE_SECRET_KEY",
        ].filter((k) => !process.env[k]);

        if (missing.length > 0) {
          console.error("[sync-subscription] Env ausente:", missing);
          return json({ error: "Configuração incompleta", missing }, 500);
        }

        const token = getAuthToken(request);
        if (!token) return json({ error: "Token ausente" }, 401);

        const supabaseAuth = getSupabaseAuth();
        const { data: authData, error: authError } = await supabaseAuth.auth.getUser(token);
        if (authError || !authData.user) {
          console.error("[sync-subscription] Token inválido:", authError?.message);
          return json({ error: "Sessão inválida" }, 401);
        }

        const userId = authData.user.id;
        const supabaseAdmin = getSupabaseAdmin();

        const { data: profile, error: profileError } = await supabaseAdmin
          .from("profiles")
          .select("stripe_customer_id, subscription_status")
          .eq("id", userId)
          .maybeSingle();

        if (profileError) {
          console.error("[sync-subscription] Erro ao buscar profile:", profileError.message);
          return json({ error: "Erro ao buscar perfil" }, 500);
        }

        if (!profile?.stripe_customer_id) {
          console.log("[sync-subscription] Nenhum stripe_customer_id encontrado para userId:", userId);
          return json({ status: profile?.subscription_status ?? "inactive" });
        }

        const stripe = getStripe();

        let activeSubscription: Stripe.Subscription | null = null;

        try {
          const subscriptions = await stripe.subscriptions.list({
            customer: profile.stripe_customer_id,
            status: "active",
            limit: 1,
            expand: ["data.items.data.price"],
          });

          if (subscriptions.data.length > 0) {
            activeSubscription = subscriptions.data[0];
          } else {
            const allSubs = await stripe.subscriptions.list({
              customer: profile.stripe_customer_id,
              limit: 5,
              expand: ["data.items.data.price"],
            });
            const recent = allSubs.data.find((s) => ["active", "trialing"].includes(s.status));
            activeSubscription = recent ?? null;
          }
        } catch (err) {
          console.error("[sync-subscription] Erro ao listar subscriptions Stripe:", err);
          return json({ error: "Erro ao consultar Stripe" }, 500);
        }

        if (!activeSubscription) {
          console.log("[sync-subscription] Nenhuma subscription ativa encontrada para customer:", profile.stripe_customer_id);
          return json({ status: profile.subscription_status });
        }

        const priceItem = activeSubscription.items?.data?.[0];
        const priceId = priceItem?.price?.id ?? null;
        const interval = priceItem?.price?.recurring?.interval ?? null;
        const plan = interval === "year" ? "annual" : interval === "month" ? "monthly" : null;
        const startAt = activeSubscription.current_period_start
          ? new Date(activeSubscription.current_period_start * 1000).toISOString()
          : null;
        const endAt = activeSubscription.current_period_end
          ? new Date(activeSubscription.current_period_end * 1000).toISOString()
          : null;

        console.log("[sync-subscription] Sincronizando perfil com Stripe", {
          userId,
          subscriptionId: activeSubscription.id,
          status: activeSubscription.status,
          plan,
        });

        const { error: updateError } = await supabaseAdmin
          .from("profiles")
          .update({
            subscription_status: "active",
            stripe_subscription_id: activeSubscription.id,
            stripe_price_id: priceId,
            stripe_plan: plan,
            subscription_start_at: startAt,
            subscription_end_at: endAt,
          })
          .eq("id", userId);

        if (updateError) {
          console.error("[sync-subscription] Erro ao atualizar perfil:", updateError.message);
          return json({ error: "Erro ao salvar status" }, 500);
        }

        console.log("[sync-subscription] Perfil sincronizado com sucesso para userId:", userId);
        return json({ status: "active", synced: true });
      },
    },
  },
});
