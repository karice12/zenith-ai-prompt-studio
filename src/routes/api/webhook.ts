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
  const url = process.env.SUPABASE_URL as string;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  if (!url || !key) {
    throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
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
  eventType,
}: {
  userId: string;
  subscription: Stripe.Subscription;
  customerId?: string | Stripe.Customer | Stripe.DeletedCustomer | null;
  eventType: string;
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
        : (subscription.customer as Stripe.Customer | null)?.id ?? null;
  const startAt = subscription.current_period_start
    ? new Date(subscription.current_period_start * 1000).toISOString()
    : null;
  const endAt = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;

  console.log(`[webhook][${eventType}] Atualizando perfil para userId=${userId}`, {
    subscription_status: "active",
    stripe_customer_id: customer,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    stripe_plan: plan,
    subscription_start_at: startAt,
    subscription_end_at: endAt,
  });

  const { data, error } = await supabase
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
    .eq("id", userId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(`[webhook][${eventType}] Erro ao atualizar status premium:`, error);
    throw error;
  }

  if (!data) {
    throw new Error(`Profile not found for user ${userId}`);
  }

  console.log(`DB Update Success: User ${userId} is now active`);
  console.log(`[webhook][${eventType}] Perfil atualizado com sucesso para userId=${userId}`);
}

async function cancelSubscriptionOnProfile(userId: string, eventType: string) {
  const supabase = getSupabase();
  console.log(`[webhook][${eventType}] Cancelando assinatura para userId=${userId}`);

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

  if (error) {
    console.error(`[webhook][${eventType}] Erro ao cancelar status premium:`, error);
    throw error;
  }

  console.log(`[webhook][${eventType}] Assinatura cancelada para userId=${userId}`);
}

async function setStatus(userId: string, status: "active" | "inactive" | "past_due" | "cancelled", eventType: string) {
  const supabase = getSupabase();
  console.log(`[webhook][${eventType}] Definindo status=${status} para userId=${userId}`);

  const { error } = await supabase
    .from("profiles")
    .update({ subscription_status: status })
    .eq("id", userId);

  if (error) {
    console.error(`[webhook][${eventType}] Erro ao atualizar status premium:`, error);
    throw error;
  }
}

export async function handleStripeWebhook(request: Request) {
  const missingEnv = getMissingEnv();
  if (missingEnv.length > 0) {
    console.error("[webhook] Variáveis de ambiente ausentes:", missingEnv);
    return json({ error: "Webhook configuration incomplete", missingEnv }, 500);
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    console.error("[webhook] stripe-signature header ausente");
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
    console.error("[webhook] Falha na verificação da assinatura:", error);
    return json({ error: "Invalid signature" }, 400);
  }

  console.log(`[webhook] Evento recebido: ${event.type} (id=${event.id})`);

  const stripe = getStripe();
  const obj = event.data.object;

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = obj as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        console.log(`[webhook][checkout.session.completed] userId=${userId}, subscription=${session.subscription}`);
        if (!userId || !session.subscription) {
          console.warn("[webhook][checkout.session.completed] userId ou subscription ausente no metadata");
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string,
          { expand: ["items.data.price"] }
        );
        await applySubscriptionToProfile({
          userId,
          subscription,
          customerId: session.customer,
          eventType: event.type,
        });
        break;
      }

      case "customer.subscription.updated": {
        const subscriptionEvent = obj as Stripe.Subscription;
        const userId = subscriptionEvent.metadata?.userId;
        console.log(`[webhook][customer.subscription.updated] userId=${userId}, status=${subscriptionEvent.status}`);
        if (!userId) {
          console.warn("[webhook][customer.subscription.updated] userId ausente no metadata");
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionEvent.id, {
          expand: ["items.data.price"],
        });

        if (["active", "trialing"].includes(subscription.status)) {
          await applySubscriptionToProfile({
            userId,
            subscription,
            customerId: subscription.customer,
            eventType: event.type,
          });
        } else if (subscription.status === "past_due") {
          await setStatus(userId, "past_due", event.type);
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
        console.log(`[webhook][invoice.payment_succeeded] userId=${userId}`);
        if (!userId) {
          console.warn("[webhook][invoice.payment_succeeded] userId ausente no metadata da subscription");
          break;
        }

        await applySubscriptionToProfile({
          userId,
          subscription,
          customerId: invoice.customer,
          eventType: event.type,
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = obj as Stripe.Invoice;
        if (!invoice.subscription) break;

        const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
        const userId = subscription.metadata?.userId;
        console.log(`[webhook][invoice.payment_failed] userId=${userId}`);
        if (!userId) break;

        await setStatus(userId, "past_due", event.type);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = obj as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        console.log(`[webhook][customer.subscription.deleted] userId=${userId}`);
        if (!userId) break;

        await cancelSubscriptionOnProfile(userId, event.type);
        break;
      }

      default:
        console.log(`[webhook] Evento ignorado: ${event.type}`);
        break;
    }
  } catch (error) {
    console.error(`[webhook] Erro ao processar evento ${event.type}:`, error);
    return json({ error: "Database write failed. Stripe will retry." }, 500);
  }

  return json({ received: true });
}

export const Route = createFileRoute("/api/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => handleStripeWebhook(request),
    },
  },
});
