import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CreditCard, Sparkles, Check, AlertCircle, Zap, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";

export const Route = createFileRoute("/dashboard/subscription")({
  component: SubscriptionPage,
});

const FEATURES = [
  "Prompts ilimitados via Gemini 1.5 Flash",
  "Histórico dos últimos 20 dias",
  "Templates exclusivos por nicho",
  "Suporte prioritário",
];

function SubscriptionPage() {
  const { user, getToken } = useAuth();
  const { isActive, status, loading: subLoading } = useSubscription();
  const [loadingPlan, setLoadingPlan] = useState<"monthly" | "annual" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async (plan: "monthly" | "annual") => {
    setError(null);
    setLoadingPlan(plan);

    const token = await getToken();
    if (!token || !user?.email) {
      setError("Sessão expirada. Faça login novamente.");
      setLoadingPlan(null);
      return;
    }

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plan,
          email: user.email,
          userId: user.id,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        console.error("Checkout API error:", {
          status: res.status,
          statusText: res.statusText,
          response: data,
        });
        setError(data?.error || "Não foi possível criar a sessão de pagamento.");
        setLoadingPlan(null);
        return;
      }

      if (!data?.url) {
        console.error("Checkout API returned no redirect URL:", data);
        setError("A API de pagamento não retornou a URL do checkout.");
        setLoadingPlan(null);
        return;
      }

      window.location.href = data.url;
    } catch (error) {
      console.error(error);
      setError("Erro de conexão. Verifique sua internet e tente novamente.");
      setLoadingPlan(null);
    }
  };

  const statusLabel: Record<string, string> = {
    active: "Ativo",
    inactive: "Inativo",
    past_due: "Pagamento pendente",
    cancelled: "Cancelado",
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Assinatura</h1>
      <p className="text-muted-foreground mb-8">Gerencie seu plano</p>

      {isActive && (
        <div className="glass rounded-xl p-6 glow-border-cyan max-w-2xl mb-8 flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-neon-cyan/15 flex items-center justify-center border border-neon-cyan/30 shrink-0">
            <Check className="h-5 w-5 text-neon-cyan" />
          </div>
          <div>
            <p className="font-semibold text-sm">Assinatura ativa</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Você tem acesso completo a todos os recursos do Zenith AI.
            </p>
          </div>
          <span className="ml-auto text-xs px-2.5 py-1 rounded-full bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20 shrink-0">
            {statusLabel[status ?? "active"]}
          </span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 max-w-2xl mb-6">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
        {/* Monthly */}
        <div className="glass rounded-xl p-6 glow-border-purple flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-neon-purple/15 flex items-center justify-center border border-neon-purple/30">
              <Zap className="h-5 w-5 text-neon-purple" />
            </div>
            <div>
              <p className="font-semibold text-sm">Plano Mensal</p>
              <p className="text-xs text-muted-foreground">Cancele quando quiser</p>
            </div>
          </div>

          <div>
            <span className="text-3xl font-bold">R$ 69</span>
            <span className="text-lg font-bold">,90</span>
            <span className="text-muted-foreground text-sm"> /mês</span>
          </div>

          <ul className="space-y-2 flex-1">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-3.5 w-3.5 text-neon-purple shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          <Button
            variant="hero"
            className="w-full"
            disabled={!!loadingPlan || subLoading || isActive}
            onClick={() => handleCheckout("monthly")}
          >
            {loadingPlan === "monthly" ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Aguarde...
              </span>
            ) : isActive ? (
              "Plano ativo"
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Assinar — R$ 69,90/mês
              </>
            )}
          </Button>
        </div>

        {/* Annual */}
        <div className="glass rounded-xl p-6 flex flex-col gap-5 border border-neon-purple/40 relative overflow-hidden">
          <div className="absolute top-3 right-3 text-xs px-2.5 py-1 rounded-full bg-neon-purple/20 text-neon-purple border border-neon-purple/30 font-medium">
            Melhor valor
          </div>

          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-neon-purple/15 flex items-center justify-center border border-neon-purple/30">
              <CalendarDays className="h-5 w-5 text-neon-purple" />
            </div>
            <div>
              <p className="font-semibold text-sm">Plano Anual</p>
              <p className="text-xs text-muted-foreground">Economia de ~15%</p>
            </div>
          </div>

          <div>
            <span className="text-3xl font-bold">R$ 712</span>
            <span className="text-lg font-bold">,98</span>
            <span className="text-muted-foreground text-sm"> /ano</span>
            <p className="text-xs text-muted-foreground mt-1">≈ R$ 59,41/mês</p>
          </div>

          <ul className="space-y-2 flex-1">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-3.5 w-3.5 text-neon-purple shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          <Button
            variant="glow"
            className="w-full"
            disabled={!!loadingPlan || subLoading || isActive}
            onClick={() => handleCheckout("annual")}
          >
            {loadingPlan === "annual" ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Aguarde...
              </span>
            ) : isActive ? (
              "Plano ativo"
            ) : (
              <>
                <CreditCard className="h-4 w-4" />
                Assinar — R$ 712,98/ano
              </>
            )}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-6 max-w-2xl">
        Pagamento processado com segurança pelo Stripe. Você será redirecionado para o portal de pagamento.
        Ao assinar, você concorda com os Termos de Uso do Zenith AI.
      </p>
    </div>
  );
}
