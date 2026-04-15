import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const jsonHeaders = {
  "Content-Type": "application/json",
};

const requiredEnv = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
] as const;

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
  return Response.json(data, {
    status,
    headers: jsonHeaders,
  });
}

function getMissingEnv() {
  return requiredEnv.filter((key) => !process.env[key]);
}

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: "2024-06-20",
  });
}

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
}

function getAuthToken(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.replace("Bearer ", "");
}

function getAppUrl(request: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  return new URL(request.url).origin;
}

async function findOrCreateStripeCustomer({
  supabase,
  stripe,
  userId,
  email,
}: {
  supabase: ReturnType<typeof getSupabase>;
  stripe: Stripe;
  userId: string;
  email: string;
}) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError && profileError.code !== "PGRST205") {
    throw profileError;
  }

  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id;
  }

  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  });

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", userId);

  if (updateError) {
    console.error("Failed to persist Stripe customer on profile:", updateError);
  }

  return customer.id;
}

export const Route = createFileRoute("/api/checkout")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            ...jsonHeaders,
            Allow: "POST, OPTIONS",
          },
        }),
      POST: async ({ request }) => {
        const missingEnv = getMissingEnv();
        if (missingEnv.length > 0) {
          console.error("Missing checkout environment variables:", missingEnv);
          return json(
            {
              error: "Configuração de pagamento incompleta.",
              missingEnv,
            },
            500
          );
        }

        const token = getAuthToken(request);
        if (!token) {
          return json({ error: "Missing authorization token" }, 401);
        }

        let body: {
          plan?: Plan;
          email?: string;
          userId?: string;
        };

        try {
          body = await request.json();
        } catch (error) {
          console.error("Invalid checkout request body:", error);
          return json({ error: "Invalid JSON body" }, 400);
        }

        const { plan, email, userId } = body;

        if (!plan || !["monthly", "annual"].includes(plan)) {
          return json({ error: "Invalid plan. Use 'monthly' or 'annual'" }, 400);
        }

        if (!email || !userId) {
          return json({ error: "Missing required fields: email, userId" }, 400);
        }

        const supabase = getSupabase();
        const stripe = getStripe();

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser(token);

        if (authError || !user || user.id !== userId) {
          console.error("Checkout auth failed:", authError);
          return json({ error: "Invalid authorization token" }, 401);
        }

        let customerId: string;
        try {
          customerId = await findOrCreateStripeCustomer({
            supabase,
            stripe,
            userId,
            email,
          });
        } catch (error) {
          console.error("Failed to resolve Stripe customer:", error);
          return json({ error: "Could not create Stripe customer" }, 500);
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
            subscription_data: {
              metadata: { userId, plan },
            },
            success_url: `${appUrl}/dashboard?checkout=success`,
            cancel_url: `${appUrl}/dashboard/subscription?checkout=cancelled`,
          });

          return json({ url: session.url, sessionId: session.id });
        } catch (error) {
          console.error("Failed to create Stripe session:", error);
          return json({ error: "Could not create checkout session" }, 500);
        }
      },
    },
  },
});