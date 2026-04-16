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
  const url = process.env.VITE_SUPABASE_URL as string;
  const key = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY as string;
  console.log("[webhook][supabase] Criando client com service_role_key", {
    hasSupabaseUrl: hasValue(url),
    supabaseHost: url ? new URL(url).host : null,
    hasServiceRoleKey: hasValue(key),
    serviceRoleKeyLength: key?.length ?? 0,
  });
  if (!url || !key) {
    throw new Error("VITE_SUPABASE_URL ou VITE_SUPABASE_SERVICE_ROLE_KEY não configurados");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getMissingEnv() {
  return [
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_SERVICE_ROLE_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
  ].filter((key) => !process.env[key]);
}

function resolvePlanFromInterval(interval: string | null | undefined) {
  if (interval === "year") return "annual";
  if (interval === "month") return "monthly";
  return null;
}

async function resolveUserIdFromCustomer(stripe: Stripe, customerId: string): Promise<string | null> {
  try {
    console.log("[webhook] Buscando userId via Stripe customer metadata", { customerId });
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) return null;
    const userId = (customer as Stripe.Customer).metadata?.userId ?? null;
    console.log("[webhook] userId via customer metadata:", userId);
    return userId;
  } catch (err) {
    console.error("[webhook] Falha ao buscar customer no Stripe:", err);
    return null;
  }
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

  console.log(`[webhook][${eventType}] Dados normalizados para upsert`, {
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

  const payload = {
    id: userId,
    subscription_status: "active",
    stripe_customer_id: customer ?? null,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    stripe_plan: plan,
    subscription_start_at: startAt,
    subscription_end_at: endAt,
  };

  console.log(`[webhook][${eventType}] Executando upsert no Supabase para userId=${userId}`);

  const { data, error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" })
    .select("id, subscription_status")
    .maybeSingle();

  console.log(`[webhook][${eventType}] Resultado do upsert`, {
    updatedProfileId: data?.id ?? null,
    updatedStatus: data?.subscription_status ?? null,
    hasError: Boolean(error),
    errorCode: error?.code ?? null,
    errorMessage: error?.message ?? null,
    errorDetails: error?.details ?? null,
    errorHint: error?.hint ?? null,
  });

  if (error) {
    console.error(`[webhook][${eventType}] Erro no upsert:`, error);
    throw error;
  }

  console.log(`[webhook][${eventType}] Upsert concluído com sucesso para userId=${userId}`);
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

  console.log(`[webhook][${eventType}] Resultado do cancelamento`, {
    hasError: Boolean(error),
    errorCode: error?.code ?? null,
    errorMessage: error?.message ?? null,
  });

  if (error) {
    console.error(`[webhook][${eventType}] Erro ao cancelar:`, error);
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

  console.log(`[webhook][${eventType}] Resultado do update de status`, {
    userId,
    status,
    hasError: Boolean(error),
    errorCode: error?.code ?? null,
    errorMessage: error?.message ?? null,
  });

  if (error) {
    console.error(`[webhook][${eventType}] Erro ao atualizar status:`, error);
    throw error;
  }
}

export async function handleStripeWebhook(request: Request) {
  console.log("[webhook] ===== Requisição recebida =====", {
    method: request.method,
    url: request.url,
    contentType: request.headers.get("content-type"),
    stripeSignaturePresent: Boolean(request.headers.get("stripe-signature")),
    stripeSignatureLength: request.headers.get("stripe-signature")?.length ?? 0,
    hasSupabaseUrl: hasValue(process.env.VITE_SUPABASE_URL),
    hasServiceRoleKey: hasValue(process.env.VITE_SUPABASE_SERVICE_ROLE_KEY),
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
    console.error("[webhook] ERRO: Variáveis de ambiente ausentes:", missingEnv);
    return json({ error: "Webhook configuration incomplete", missingEnv }, 500);
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    console.error("[webhook] ERRO: stripe-signature header ausente");
    return json({ error: "Missing Stripe signature" }, 400);
  }

  let event: Stripe.Event;
  let rawBody: Buffer;
  try {
    rawBody = Buffer.from(await request.arrayBuffer());
    console.log("[webhook] Body recebido para validação", {
      rawBodyBytes: rawBody.length,
      signaturePreview: `${signature.slice(0, 12)}...`,
      webhookSecretLength: process.env.STRIPE_WEBHOOK_SECRET?.length ?? 0,
    });
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
    console.log("[webhook] Assinatura Stripe válida", {
      eventId: event.id,
      eventType: event.type,
      created: event.created,
      livemode: event.livemode,
    });
  } catch (error) {
    console.error("[webhook] ERRO na verificação da assinatura:", {
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage: error instanceof Error ? error.message : String(error),
      signatureLength: signature.length,
      webhookSecretLength: process.env.STRIPE_WEBHOOK_SECRET?.length ?? 0,
    });
    return json({ error: "Invalid signature" }, 400);
  }

  console.log(`[webhook] Processando evento: ${event.type} (id=${event.id})`);

  const stripe = getStripe();
  const obj = event.data.object;

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = obj as Stripe.Checkout.Session;
        let userId = session.metadata?.userId ?? null;

        console.log("[webhook][checkout.session.completed] Session recebida", {
          sessionId: session.id,
          paymentStatus: session.payment_status,
          status: session.status,
          mode: session.mode,
          customer: session.customer,
          subscription: session.subscription,
          metadata: session.metadata,
          userIdFromMetadata: userId,
        });

        if (!userId && session.customer) {
          console.warn("[webhook][checkout.session.completed] userId ausente no metadata — buscando via customer");
          userId = await resolveUserIdFromCustomer(stripe, session.customer as string);
        }

        if (!userId) {
          console.error("[webhook][checkout.session.completed] ERRO: userId não encontrado em nenhuma fonte", {
            metadata: session.metadata,
            customer: session.customer,
          });
          break;
        }

        if (!session.subscription) {
          console.error("[webhook][checkout.session.completed] ERRO: subscription ausente na session", {
            sessionId: session.id,
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
        let userId = subscriptionEvent.metadata?.userId ?? null;

        console.log(`[webhook][customer.subscription.updated] userId=${userId}, status=${subscriptionEvent.status}`, {
          subscriptionId: subscriptionEvent.id,
          customer: subscriptionEvent.customer,
          metadata: subscriptionEvent.metadata,
        });

        if (!userId && subscriptionEvent.customer) {
          console.warn("[webhook][customer.subscription.updated] userId ausente — buscando via customer");
          userId = await resolveUserIdFromCustomer(stripe, subscriptionEvent.customer as string);
        }

        if (!userId) {
          console.error("[webhook][customer.subscription.updated] ERRO: userId não encontrado");
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

        let userId = subscription.metadata?.userId ?? null;

        console.log(`[webhook][invoice.payment_succeeded] userId=${userId}`, {
          subscriptionId: subscription.id,
          metadata: subscription.metadata,
        });

        if (!userId && invoice.customer) {
          console.warn("[webhook][invoice.payment_succeeded] userId ausente — buscando via customer");
          userId = await resolveUserIdFromCustomer(stripe, invoice.customer as string);
        }

        if (!userId) {
          console.error("[webhook][invoice.payment_succeeded] ERRO: userId não encontrado");
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
        let userId = subscription.metadata?.userId ?? null;

        if (!userId && invoice.customer) {
          userId = await resolveUserIdFromCustomer(stripe, invoice.customer as string);
        }

        if (!userId) {
          console.error("[webhook][invoice.payment_failed] ERRO: userId não encontrado");
          break;
        }

        await setStatus(userId, "past_due", event.type);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = obj as Stripe.Subscription;
        let userId = subscription.metadata?.userId ?? null;

        console.log(`[webhook][customer.subscription.deleted] userId=${userId}`, {
          subscriptionId: subscription.id,
          status: subscription.status,
          customer: subscription.customer,
          metadata: subscription.metadata,
        });

        if (!userId && subscription.customer) {
          userId = await resolveUserIdFromCustomer(stripe, subscription.customer as string);
        }

        if (!userId) {
          console.error("[webhook][customer.subscription.deleted] ERRO: userId não encontrado");
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
    console.error(`[webhook] ERRO ao processar evento ${event.type}:`, {
      eventId: event.id,
      eventType: event.type,
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : null,
    });
    return json({ error: "Database write failed. Stripe will retry." }, 500);
  }

  console.log("[webhook] ===== Evento processado com sucesso =====", {
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
