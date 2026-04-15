import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

const PLANS = {
  monthly: {
    amount: 6990,
    currency: "brl",
    interval: "month",
    name: "Zenith AI — Plano Mensal",
  },
  annual: {
    amount: 71298,
    currency: "brl",
    interval: "year",
    name: "Zenith AI — Plano Anual",
  },
};

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

  const selectedPlan = PLANS[plan];

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: email,
    line_items: [
      {
        price_data: {
          currency: selectedPlan.currency,
          unit_amount: selectedPlan.amount,
          recurring: { interval: selectedPlan.interval },
          product_data: { name: selectedPlan.name },
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId,
      plan,
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/subscription?checkout=cancelled`,
  });

  return res.status(200).json({ url: session.url, sessionId: session.id });
}
