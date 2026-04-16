import { createFileRoute } from "@tanstack/react-router";
import { handleStripeWebhook } from "@/routes/api/webhook";

export const Route = createFileRoute("/api/webhooks/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => handleStripeWebhook(request),
    },
  },
});