import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard/subscription")({
  component: SubscriptionPage,
});

function SubscriptionPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Assinatura</h1>
      <p className="text-muted-foreground mb-8">Gerencie seu plano</p>

      <div className="glass rounded-xl p-8 glow-border-purple max-w-md">
        <div className="flex items-center gap-3 mb-4">
          <CreditCard className="h-6 w-6 text-neon-purple" />
          <span className="font-semibold">Plano Gratuito</span>
        </div>
        <p className="text-sm text-muted-foreground mb-6">Faça upgrade para desbloquear prompts ilimitados e templates exclusivos.</p>
        <div className="space-y-3">
          <Button variant="hero" className="w-full">
            <Sparkles className="h-4 w-4" />
            Upgrade — R$ 69,90/mês
          </Button>
          <Button variant="glow" className="w-full">
            Plano Anual — R$ 712,98/ano
          </Button>
        </div>
      </div>
    </div>
  );
}
