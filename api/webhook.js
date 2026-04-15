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

async function updateSubscriptionStatus(userId, status) {
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

  const rawBody = await getRawBody(req);
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
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  const session = event.data.object;

  switch (event.type) {
    case "checkout.session.completed": {
      const userId = session.metadata?.userId;
      if (userId) {
        await updateSubscriptionStatus(userId, "active");
      }
      break;
    }

    case "invoice.payment_succeeded": {
      const sub = await stripe.subscriptions.retrieve(session.subscription);
      const userId = sub.metadata?.userId;
      if (userId) {
        await updateSubscriptionStatus(userId, "active");
      }
      break;
    }

    case "invoice.payment_failed": {
      const sub = await stripe.subscriptions.retrieve(session.subscription);
      const userId = sub.metadata?.userId;
      if (userId) {
        await updateSubscriptionStatus(userId, "past_due");
      }
      break;
    }

    case "customer.subscription.deleted": {
      const userId = session.metadata?.userId;
      if (userId) {
        await updateSubscriptionStatus(userId, "cancelled");
      }
      break;
    }

    default:
      break;
  }

  return res.status(200).json({ received: true });
}
