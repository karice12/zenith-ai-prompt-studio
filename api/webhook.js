import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function resolvePlanFromInterval(interval) {
  if (interval === "year") return "annual";
  if (interval === "month") return "monthly";
  return null;
}

async function applySubscriptionToProfile(userId, subscription, customerId) {
  const priceItem = subscription.items?.data?.[0];
  const priceId = priceItem?.price?.id ?? null;
  const interval = priceItem?.price?.recurring?.interval ?? null;
  const plan = resolvePlanFromInterval(interval);
  const startAt = subscription.current_period_start
    ? new Date(subscription.current_period_start * 1000).toISOString()
    : null;
  const endAt = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;

  const { error } = await supabase
    .from("profiles")
    .update({
      subscription_status: "active",
      stripe_customer_id: customerId ?? subscription.customer,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      stripe_plan: plan,
      subscription_start_at: startAt,
      subscription_end_at: endAt,
    })
    .eq("id", userId);

  if (error) throw error;
}

async function cancelSubscriptionOnProfile(userId) {
  const { error } = await supabase
    .from("profiles")
    .update({
      subscription_status: "cancelled",
      stripe_subscription_id: null,
      stripe_price_id: null,
      stripe_plan: null,
      subscription_end_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) throw error;
}

async function setStatus(userId, status) {
  const { error } = await supabase
    .from("profiles")
    .update({ subscription_status: status })
    .eq("id", userId);

  if (error) throw error;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let rawBody;
  try {
    rawBody = await getRawBody(req);
  } catch (err) {
    console.error("Failed to read request body:", err.message);
    return res.status(400).json({ error: "Failed to read request body" });
  }

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).json({ error: `Invalid signature: ${err.message}` });
  }

  const obj = event.data.object;

  try {
    switch (event.type) {

      case "checkout.session.completed": {
        const userId = obj.metadata?.userId;
        if (!userId) break;

        if (obj.mode === "subscription" && obj.subscription) {
          const subscription = await stripe.subscriptions.retrieve(obj.subscription, {
            expand: ["items.data.price"],
          });
          await applySubscriptionToProfile(userId, subscription, obj.customer);
        }
        break;
      }

      case "customer.subscription.updated": {
        const userId = obj.metadata?.userId;
        if (!userId) break;

        const subscription = await stripe.subscriptions.retrieve(obj.id, {
          expand: ["items.data.price"],
        });

        const isActive = ["active", "trialing"].includes(subscription.status);
        if (isActive) {
          await applySubscriptionToProfile(userId, subscription, obj.customer);
        } else if (subscription.status === "past_due") {
          await setStatus(userId, "past_due");
        }
        break;
      }

      case "invoice.payment_succeeded": {
        if (!obj.subscription) break;

        const subscription = await stripe.subscriptions.retrieve(obj.subscription, {
          expand: ["items.data.price"],
        });
        const userId = subscription.metadata?.userId;
        if (!userId) break;

        await applySubscriptionToProfile(userId, subscription, obj.customer);
        break;
      }

      case "invoice.payment_failed": {
        if (!obj.subscription) break;

        const subscription = await stripe.subscriptions.retrieve(obj.subscription);
        const userId = subscription.metadata?.userId;
        if (!userId) break;

        await setStatus(userId, "past_due");
        break;
      }

      case "customer.subscription.deleted": {
        const userId = obj.metadata?.userId;
        if (!userId) break;

        await cancelSubscriptionOnProfile(userId);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error(`Error processing event ${event.type}:`, err.message);
    return res.status(500).json({ error: "Database write failed. Stripe will retry." });
  }

  return res.status(200).json({ received: true });
}
