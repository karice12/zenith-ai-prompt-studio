import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const jsonHeaders = {
  "Content-Type": "application/json",
};

const PLANS = {
  monthly: {
    priceId: process.env.STRIPE_PRICE_MONTHLY ?? null,
    amount: 6990,
    currency: "brl",
    interval: "month",
    name: "Zenith AI — Plano Mensal",
  },
  annual: {
    priceId: process.env.STRIPE_PRICE_ANNUAL ?? null,
    amount: 71298,
    currency: "brl",
    interval: "year",
    name: "Zenith AI — Plano Anual",
  },
} as const;

type Plan = keyof typeof PLANS;

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: jsonHeaders });
}

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: "2024-06-20",
  });
}

// Uses anon key — works for auth.getUser(jwt) validation
function getSupabaseAuth() {
  return createClient(
    process.env.SUPABASE_URL as string,
    (process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY) as string,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Uses service role key — for privileged DB operations
function getSupabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function getAuthToken(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

function getAppUrl(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  return new URL(request.url).origin;
}

async function resolveUserIdFromToken(token: string): Promise<{ userId: string | null; error: string | null }> {
  try {
    const supabaseAuth = getSupabaseAuth();
    const { data, error } = await supabaseAuth.auth.getUser(token);
    if (!error && data.user) {
      return { userId: data.user.id, error: null };
    }
    console.error("[checkout] auth.getUser falhou:", error?.message);
    return { userId: null, error: "Sessão inválida. Faça login novamente." };
  } catch (err) {
    console.error("[checkout] Exceção em auth.getUser:", err);
    return { userId: null, error: "Não foi possível validar sua sessão." };
  }
}

async function findOrCreateStripeCustomer({
  stripe,
  userId,
  email,
}: {
  stripe: Stripe;
  userId: string;
  email: string;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[checkout] DB lookup falhou:", error.message);
    throw error;
  }

  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id as string;
  }

  if (!profile) {
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, email, subscription_status: "inactive" }, { onConflict: "id" });

    if (profileError) {
      console.error("[checkout] Criação de profile falhou:", profileError.message);
      throw profileError;
    }
  }

  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  });

  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({ email, stripe_customer_id: customer.id })
    .eq("id", userId);

  if (updateError) {
    console.error("[checkout] Falha ao persistir stripe_customer_id:", updateError.message);
    throw updateError;
  }

  return customer.id;
}

export const Route = createFileRoute("/api/checkout")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: { ...jsonHeaders, Allow: "POST, OPTIONS" },
        }),

      POST: async ({ request }) => {
        const supabaseUrl = process.env.SUPABASE_URL;
        const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
        const stripeKey = process.env.STRIPE_SECRET_KEY;

        if (!supabaseUrl || !anonKey || !stripeKey) {
          const missing = [
            !supabaseUrl && "SUPABASE_URL",
            !anonKey && "VITE_SUPABASE_ANON_KEY",
            !stripeKey && "STRIPE_SECRET_KEY",
          ].filter(Boolean);
          console.error("[checkout] Env ausente:", missing);
          return json({ error: "Configuração incompleta.", missing }, 500);
        }

        const token = getAuthToken(request);
        if (!token) return json({ error: "Token de autorização ausente" }, 401);

        let body: { plan?: Plan; email?: string; userId?: string };
        try {
          body = await request.json();
        } catch {
          return json({ error: "Corpo da requisição inválido" }, 400);
        }

        const { plan, email, userId } = body;

        if (!plan || !["monthly", "annual"].includes(plan)) {
          return json({ error: "Plano inválido" }, 400);
        }
        if (!email || !userId) {
          return json({ error: "Campos obrigatórios ausentes: email, userId" }, 400);
        }

        const { userId: tokenUserId, error: tokenError } = await resolveUserIdFromToken(token);

        if (tokenError || !tokenUserId) {
          return json({ error: tokenError ?? "Token inválido" }, 401);
        }

        if (tokenUserId !== userId) {
          return json({ error: "Token não corresponde ao usuário" }, 401);
        }

        const stripe = getStripe();

        let customerId: string;
        try {
          customerId = await findOrCreateStripeCustomer({ stripe, userId, email });
        } catch (err) {
          console.error("[checkout] Stripe customer falhou:", err);
          return json({ error: "Não foi possível criar o cliente Stripe" }, 500);
        }

        const selectedPlan = PLANS[plan];
        const lineItem = selectedPlan.priceId
          ? { price: selectedPlan.priceId, quantity: 1 }
          : {
              price_data: {
                currency: selectedPlan.currency,
                unit_amount: selectedPlan.amount,
                recurring: { interval: selectedPlan.interval },
                product_data: { name: selectedPlan.name },
              },
              quantity: 1,
            };

        try {
          const appUrl = getAppUrl(request);
          const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            customer: customerId,
            payment_method_types: ["card"],
            line_items: [lineItem],
            allow_promotion_codes: true,
            metadata: { userId, plan },
            subscription_data: { metadata: { userId, plan } },
            success_url: `${appUrl}/dashboard?checkout=success`,
            cancel_url: `${appUrl}/dashboard/subscription?checkout=cancelled`,
          });

          return json({ url: session.url, sessionId: session.id });
        } catch (err) {
          console.error("[checkout] Stripe session falhou:", err);
          return json({ error: "Não foi possível criar a sessão de pagamento" }, 500);
        }
      },
    },
  },
});
