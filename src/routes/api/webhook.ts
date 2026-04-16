import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const jsonHeaders = {
  "Content-Type": "application/json",
};

function hasValue(value: string | undefined) {
  return Boolean(value && value.trim().length > 0);
}

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
  console.log("[webhook][supabase] Criando client com service_role_key", {
    hasSupabaseUrl: hasValue(url),
    supabaseHost: url ? new URL(url).host : null,
    hasServiceRoleKey: hasValue(key),
    serviceRoleKeyLength: key?.length ?? 0,
  });
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

  console.log(`[webhook][${eventType}] Dados da assinatura normalizados`, {
    userId,
    subscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    customer,
    priceId,
    interval,
    plan,
    startAt,
    endAt,
  });

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

  console.log(`[webhook][${eventType}] Resultado do update no Supabase`, {
    updatedProfileId: data?.id ?? null,
    hasError: Boolean(error),
    errorCode: error?.code ?? null,
    errorMessage: error?.message ?? null,
    errorDetails: error?.details ?? null,
    errorHint: error?.hint ?? null,
  });

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

  console.log(`[webhook][${eventType}] Resultado do cancelamento no Supabase`, {
    hasError: Boolean(error),
    errorCode: error?.code ?? null,
    errorMessage: error?.message ?? null,
    errorDetails: error?.details ?? null,
    errorHint: error?.hint ?? null,
  });

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

  console.log(`[webhook][${eventType}] Resultado do update de status no Supabase`, {
    userId,
    status,
    hasError: Boolean(error),
    errorCode: error?.code ?? null,
    errorMessage: error?.message ?? null,
    errorDetails: error?.details ?? null,
    errorHint: error?.hint ?? null,
  });

  if (error) {
    console.error(`[webhook][${eventType}] Erro ao atualizar status premium:`, error);
    throw error;
  }
}

export async function handleStripeWebhook(request: Request) {
  console.log("[webhook] Requisição recebida", {
    method: request.method,
    url: request.url,
    contentType: request.headers.get("content-type"),
    userAgent: request.headers.get("user-agent"),
    stripeSignaturePresent: Boolean(request.headers.get("stripe-signature")),
    stripeSignatureLength: request.headers.get("stripe-signature")?.length ?? 0,
    hasSupabaseUrl: hasValue(process.env.SUPABASE_URL),
    hasServiceRoleKey: hasValue(process.env.SUPABASE_SERVICE_ROLE_KEY),
    hasStripeSecretKey: hasValue(process.env.STRIPE_SECRET_KEY),
    hasStripeWebhookSecret: hasValue(process.env.STRIPE_WEBHOOK_SECRET),
    runtime: {
      vercel: hasValue(process.env.VERCEL),
      vercelUrl: process.env.VERCEL_URL ?? null,
      nodeEnv: process.env.NODE_ENV ?? null,
    },
  });

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
  let rawBody: Buffer;
  try {
    rawBody = Buffer.from(await request.arrayBuffer());
    console.log("[webhook] Body bruto recebido para validação Stripe", {
      rawBodyBytes: rawBody.length,
      signaturePreview: `${signature.slice(0, 12)}...`,
      webhookSecretLength: process.env.STRIPE_WEBHOOK_SECRET?.length ?? 0,
    });
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
    console.log("[webhook] Assinatura Stripe validada com sucesso", {
      eventId: event.id,
      eventType: event.type,
      created: event.created,
      livemode: event.livemode,
    });
  } catch (error) {
    console.error("[webhook] Falha na verificação da assinatura:", {
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage: error instanceof Error ? error.message : String(error),
      signatureLength: signature.length,
      webhookSecretLength: process.env.STRIPE_WEBHOOK_SECRET?.length ?? 0,
    });
    return json({ error: "Invalid signature" }, 400);
  }

  console.log(`[webhook] Evento recebido: ${event.type} (id=${event.id})`, {
    apiVersion: event.api_version,
    account: event.account ?? null,
    pendingWebhooks: event.pending_webhooks,
    requestId: event.request?.id ?? null,
    objectType: event.data.object.object,
  });

  const stripe = getStripe();
  const obj = event.data.object;

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = obj as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        console.log("[webhook][checkout.session.completed] Session recebida", {
          sessionId: session.id,
          paymentStatus: session.payment_status,
          status: session.status,
          mode: session.mode,
          customer: session.customer,
          subscription: session.subscription,
          metadata: session.metadata,
          clientReferenceId: session.client_reference_id,
        });
        console.log(`[webhook][checkout.session.completed] userId=${userId}, subscription=${session.subscription}`);
        if (!userId || !session.subscription) {
          console.warn("[webhook][checkout.session.completed] userId ou subscription ausente no metadata", {
            hasUserId: Boolean(userId),
            hasSubscription: Boolean(session.subscription),
            metadata: session.metadata,
          });
          break;
        }

        console.log("[webhook][checkout.session.completed] Buscando subscription no Stripe", {
          subscriptionId: session.subscription,
        });
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string,
          { expand: ["items.data.price"] }
        );
        console.log("[webhook][checkout.session.completed] Subscription recuperada", {
          subscriptionId: subscription.id,
          status: subscription.status,
          customer: subscription.customer,
          metadata: subscription.metadata,
          itemCount: subscription.items?.data?.length ?? 0,
          firstPriceId: subscription.items?.data?.[0]?.price?.id ?? null,
          firstInterval: subscription.items?.data?.[0]?.price?.recurring?.interval ?? null,
        });
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
        console.log(`[webhook][customer.subscription.updated] userId=${userId}, status=${subscriptionEvent.status}`, {
          subscriptionId: subscriptionEvent.id,
          customer: subscriptionEvent.customer,
          metadata: subscriptionEvent.metadata,
        });
        if (!userId) {
          console.warn("[webhook][customer.subscription.updated] userId ausente no metadata", {
            metadata: subscriptionEvent.metadata,
          });
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
        console.log("[webhook][invoice.payment_succeeded] Invoice recebida", {
          invoiceId: invoice.id,
          customer: invoice.customer,
          subscription: invoice.subscription,
          status: invoice.status,
        });
        if (!invoice.subscription) {
          console.warn("[webhook][invoice.payment_succeeded] Invoice sem subscription");
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(
          invoice.subscription as string,
          { expand: ["items.data.price"] }
        );
        const userId = subscription.metadata?.userId;
        console.log(`[webhook][invoice.payment_succeeded] userId=${userId}`, {
          subscriptionId: subscription.id,
          metadata: subscription.metadata,
        });
        if (!userId) {
          console.warn("[webhook][invoice.payment_succeeded] userId ausente no metadata da subscription", {
            metadata: subscription.metadata,
          });
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
        console.log("[webhook][invoice.payment_failed] Invoice recebida", {
          invoiceId: invoice.id,
          customer: invoice.customer,
          subscription: invoice.subscription,
          status: invoice.status,
        });
        if (!invoice.subscription) {
          console.warn("[webhook][invoice.payment_failed] Invoice sem subscription");
          break;
        }

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
        console.log(`[webhook][customer.subscription.deleted] userId=${userId}`, {
          subscriptionId: subscription.id,
          status: subscription.status,
          customer: subscription.customer,
          metadata: subscription.metadata,
        });
        if (!userId) {
          console.warn("[webhook][customer.subscription.deleted] userId ausente no metadata", {
            metadata: subscription.metadata,
          });
          break;
        }

        await cancelSubscriptionOnProfile(userId, event.type);
        break;
      }

      default:
        console.log(`[webhook] Evento ignorado: ${event.type}`);
        break;
    }
  } catch (error) {
    console.error(`[webhook] Erro ao processar evento ${event.type}:`, {
      eventId: event.id,
      eventType: event.type,
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : null,
    });
    return json({ error: "Database write failed. Stripe will retry." }, 500);
  }

  console.log("[webhook] Evento processado com sucesso", {
    eventId: event.id,
    eventType: event.type,
  });
  return json({ received: true });
}

export const Route = createFileRoute("/api/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => handleStripeWebhook(request),
    },
  },
});
