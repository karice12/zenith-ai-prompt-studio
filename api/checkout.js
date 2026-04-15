import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
};

async function findOrCreateStripeCustomer(userId, email) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .single();

  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id;
  }

  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  });

  await supabase
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", userId);

  return customer.id;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { plan, email, userId } = req.body;

  if (!plan || !["monthly", "annual"].includes(plan)) {
    return res.status(400).json({ error: "Invalid plan. Use 'monthly' or 'annual'" });
  }

  if (!email || !userId) {
    return res.status(400).json({ error: "Missing required fields: email, userId" });
  }

  let customerId;
  try {
    customerId = await findOrCreateStripeCustomer(userId, email);
  } catch (err) {
    console.error("Failed to resolve Stripe customer:", err.message);
    return res.status(500).json({ error: "Could not create Stripe customer" });
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

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [lineItem],
      allow_promotion_codes: true,
      metadata: { userId, plan },
      subscription_data: {
        metadata: { userId, plan },
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/subscription?checkout=cancelled`,
    });
  } catch (err) {
    console.error("Failed to create Stripe session:", err.message);
    return res.status(500).json({ error: "Could not create checkout session" });
  }

  return res.status(200).json({ url: session.url, sessionId: session.id });
}
