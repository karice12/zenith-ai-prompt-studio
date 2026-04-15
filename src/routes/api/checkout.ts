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

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], "base64url").toString("utf-8");
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

async function resolveUserIdFromToken(
  token: string,
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<{ userId: string | null; error: string | null }> {
  const { data, error } = await supabase.auth.getUser(token);

  if (!error && data.user) {
    return { userId: data.user.id, error: null };
  }

  console.warn("[checkout] supabase.auth.getUser falhou, tentando parse local do JWT:", error?.message);

  const payload = decodeJwtPayload(token);
  if (!payload) return { userId: null, error: "Token inválido" };

  const sub = typeof payload.sub === "string" ? payload.sub : null;
  const exp = typeof payload.exp === "number" ? payload.exp : null;

  if (exp && Date.now() / 1000 > exp) {
    return { userId: null, error: "Token expirado. Faça login novamente." };
  }

  if (!sub) return { userId: null, error: "Token sem identificador de usuário" };

  console.warn("[checkout] Usando userId do JWT local (sub=" + sub + ") — validação Supabase indisponível");
  return { userId: sub, error: null };
}

async function findOrCreateStripeCustomer({
  supabase,
  stripe,
  userId,
  email,
}: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  stripe: Stripe;
  userId: string;
  email: string;
}) {
  try {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();

    if (!profileError && profile?.stripe_customer_id) {
      console.log("[checkout] Usando stripe_customer_id existente:", profile.stripe_customer_id);
      return profile.stripe_customer_id as string;
    }

    if (profileError) {
      console.warn("[checkout] Falha ao buscar perfil (continuando sem cache):", profileError.message);
    }
  } catch (err) {
    console.warn("[checkout] Exceção ao buscar perfil (continuando sem cache):", err);
  }

  const stripeKeyMasked = process.env.STRIPE_SECRET_KEY
    ? `${process.env.STRIPE_SECRET_KEY.slice(0, 7)}...${process.env.STRIPE_SECRET_KEY.slice(-4)}`
    : "AUSENTE";
  console.log("[checkout] Criando Stripe customer — email:", email, "userId:", userId, "stripe_key:", stripeKeyMasked);

  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  });

  console.log("[checkout] Stripe customer criado:", customer.id, "para userId:", userId);

  try {
    const { error: updateError } = await supabase
      .from("profiles")
      .upsert({ id: userId, stripe_customer_id: customer.id }, { onConflict: "id" });

    if (updateError) {
      console.warn("[checkout] Falha ao salvar stripe_customer_id (não bloqueante):", updateError.message);
    }
  } catch (err) {
    console.warn("[checkout] Exceção ao salvar stripe_customer_id (não bloqueante):", err);
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
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const stripeKey = process.env.STRIPE_SECRET_KEY;

        const maskedKey = serviceKey ? `${serviceKey.slice(0, 12)}...${serviceKey.slice(-6)}` : "AUSENTE";
        console.log("[checkout] Env check — SUPABASE_URL:", !!supabaseUrl, "SERVICE_KEY:", maskedKey, "STRIPE_KEY:", !!stripeKey);

        if (!supabaseUrl || !serviceKey || !stripeKey) {
          const missing = [
            !supabaseUrl && "SUPABASE_URL",
            !serviceKey && "SUPABASE_SERVICE_ROLE_KEY",
            !stripeKey && "STRIPE_SECRET_KEY",
          ].filter(Boolean);
          console.error("[checkout] Variáveis de ambiente ausentes:", missing);
          return json({ error: "Configuração de pagamento incompleta.", missing }, 500);
        }

        const token = getAuthToken(request);
        if (!token) {
          return json({ error: "Token de autorização ausente" }, 401);
        }

        let body: { plan?: Plan; email?: string; userId?: string };
        try {
          body = await request.json();
        } catch {
          return json({ error: "Corpo da requisição inválido" }, 400);
        }

        const { plan, email, userId } = body;

        if (!plan || !["monthly", "annual"].includes(plan)) {
          return json({ error: "Plano inválido. Use 'monthly' ou 'annual'" }, 400);
        }
        if (!email || !userId) {
          return json({ error: "Campos obrigatórios ausentes: email, userId" }, 400);
        }

        const supabase = getSupabaseAdmin();
        const { userId: tokenUserId, error: tokenError } = await resolveUserIdFromToken(token, supabase);

        if (tokenError || !tokenUserId) {
          console.error("[checkout] Falha na validação do token:", tokenError);
          return json({ error: tokenError ?? "Token inválido" }, 401);
        }

        if (tokenUserId !== userId) {
          console.error("[checkout] userId do token não corresponde ao body:", { tokenUserId, userId });
          return json({ error: "Token não corresponde ao usuário informado" }, 401);
        }

        const stripe = getStripe();

        let customerId: string;
        try {
          customerId = await findOrCreateStripeCustomer({ supabase, stripe, userId, email });
        } catch (err) {
          console.error("[checkout] Falha ao resolver Stripe customer:", err);
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

          console.log("[checkout] Sessão Stripe criada para userId:", userId, "plan:", plan);
          return json({ url: session.url, sessionId: session.id });
        } catch (err) {
          console.error("[checkout] Falha ao criar sessão Stripe:", err);
          return json({ error: "Não foi possível criar a sessão de pagamento" }, 500);
        }
      },
    },
  },
});
