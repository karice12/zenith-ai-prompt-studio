import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const jsonHeaders = {
  "Content-Type": "application/json",
};

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: jsonHeaders,
  });
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

function getMissingEnv() {
  return [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
  ].filter((key) => !process.env[key]);
}

function resolvePlanFromInterval(interval: string | null | undefined) {
  if (interval === "year") return "annual";
  if (interval === "month") return "monthly";
  return null;
}

async function applySubscriptionToProfile({
  userId,
  subscription,
  customerId,
}: {
  userId: string;
  subscription: Stripe.Subscription;
  customerId?: string | Stripe.Customer | Stripe.DeletedCustomer | null;
}) {
  const supabase = getSupabase();
  const priceItem = subscription.items?.data?.[0];
  const priceId = priceItem?.price?.id ?? null;
  const interval = priceItem?.price?.recurring?.interval ?? null;
  const plan = resolvePlanFromInterval(interval);
  const customer =
    typeof customerId === "string"
      ? customerId
      : typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer?.id;
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
      stripe_customer_id: customer ?? null,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      stripe_plan: plan,
      subscription_start_at: startAt,
      subscription_end_at: endAt,
    })
    .eq("id", userId);

  if (error) throw error;
}

async function cancelSubscriptionOnProfile(userId: string) {
  const supabase = getSupabase();
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

async function setStatus(userId: string, status: "active" | "inactive" | "past_due" | "cancelled") {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("profiles")
    .update({ subscription_status: status })
    .eq("id", userId);

  if (error) throw error;
}

export const Route = createFileRoute("/api/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const missingEnv = getMissingEnv();
        if (missingEnv.length > 0) {
          console.error("Missing webhook environment variables:", missingEnv);
          return json({ error: "Webhook configuration incomplete", missingEnv }, 500);
        }

        const signature = request.headers.get("stripe-signature");
        if (!signature) {
          return json({ error: "Missing Stripe signature" }, 400);
        }

        let event: Stripe.Event;
        try {
          const rawBody = Buffer.from(await request.arrayBuffer());
          event = getStripe().webhooks.constructEvent(
            rawBody,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET as string
          );
        } catch (error) {
          console.error("Webhook signature verification failed:", error);
          return json({ error: "Invalid signature" }, 400);
        }

        const stripe = getStripe();
        const obj = event.data.object;

        try {
          switch (event.type) {
            case "checkout.session.completed": {
              const session = obj as Stripe.Checkout.Session;
              const userId = session.metadata?.userId;
              if (!userId || !session.subscription) break;

              const subscription = await stripe.subscriptions.retrieve(
                session.subscription as string,
                { expand: ["items.data.price"] }
              );
              await applySubscriptionToProfile({
                userId,
                subscription,
                customerId: session.customer,
              });
              break;
            }

            case "customer.subscription.updated": {
              const subscriptionEvent = obj as Stripe.Subscription;
              const userId = subscriptionEvent.metadata?.userId;
              if (!userId) break;

              const subscription = await stripe.subscriptions.retrieve(subscriptionEvent.id, {
                expand: ["items.data.price"],
              });

              if (["active", "trialing"].includes(subscription.status)) {
                await applySubscriptionToProfile({
                  userId,
                  subscription,
                  customerId: subscription.customer,
                });
              } else if (subscription.status === "past_due") {
                await setStatus(userId, "past_due");
              }
              break;
            }

            case "invoice.payment_succeeded": {
              const invoice = obj as Stripe.Invoice;
              if (!invoice.subscription) break;

              const subscription = await stripe.subscriptions.retrieve(
                invoice.subscription as string,
                { expand: ["items.data.price"] }
              );
              const userId = subscription.metadata?.userId;
              if (!userId) break;

              await applySubscriptionToProfile({
                userId,
                subscription,
                customerId: invoice.customer,
              });
              break;
            }

            case "invoice.payment_failed": {
              const invoice = obj as Stripe.Invoice;
              if (!invoice.subscription) break;

              const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
              const userId = subscription.metadata?.userId;
              if (!userId) break;

              await setStatus(userId, "past_due");
              break;
            }

            case "customer.subscription.deleted": {
              const subscription = obj as Stripe.Subscription;
              const userId = subscription.metadata?.userId;
              if (!userId) break;

              await cancelSubscriptionOnProfile(userId);
              break;
            }

            default:
              break;
          }
        } catch (error) {
          console.error(`Error processing event ${event.type}:`, error);
          return json({ error: "Database write failed. Stripe will retry." }, 500);
        }

        return json({ received: true });
      },
    },
  },
});