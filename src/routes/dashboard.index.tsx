import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import { Code2, Blocks, Brain, Rocket, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardHome,
});

const categories = [
  { id: "lovable", name: "Lovable", desc: "Prompts para Lovable AI", icon: Blocks, color: "glow-border-purple" },
  { id: "replit", name: "Replit", desc: "Prompts para Replit Agent", icon: Code2, color: "glow-border-cyan" },
  { id: "claude", name: "Claude", desc: "Prompts para Claude AI", icon: Brain, color: "glow-border-magenta" },
  { id: "saas", name: "SaaS Builder", desc: "Prompts para criar SaaS", icon: Rocket, color: "glow-border-purple" },
];

function DashboardHome() {
  const { isActive, refetch } = useSubscription();
  const [checkingCheckout, setCheckingCheckout] = useState(false);
  const [pollingGaveUp, setPollingGaveUp] = useState(false);
  const [manualRefetching, setManualRefetching] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkoutSuccess = useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("checkout") === "success";
  }, []);

  useEffect(() => {
    if (!checkoutSuccess || isActive) return;

    let cancelled = false;
    setCheckingCheckout(true);
    setPollingGaveUp(false);

    let attempt = 0;
    const MAX_ATTEMPTS = 15;
    const INTERVAL_MS = 3000;

    async function poll() {
      if (cancelled || attempt >= MAX_ATTEMPTS) {
        if (!cancelled) {
          setCheckingCheckout(false);
          setPollingGaveUp(true);
        }
        return;
      }

      attempt += 1;
      console.log(`[Zenith] Polling assinatura — tentativa ${attempt}/${MAX_ATTEMPTS}`);

      const status = await refetch();
      console.log(`[Zenith] Status retornado: ${status}`);

      if (cancelled) return;

      if (status === "active") {
        setCheckingCheckout(false);
        setPollingGaveUp(false);
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.delete("checkout");
          window.history.replaceState({}, "", url.toString());
        }
        return;
      }

      pollingRef.current = setTimeout(poll, INTERVAL_MS);
    }

    poll();

    return () => {
      cancelled = true;
      if (pollingRef.current) clearTimeout(pollingRef.current);
    };
  }, [checkoutSuccess, isActive, refetch]);

  const handleManualRefetch = async () => {
    setManualRefetching(true);
    setPollingGaveUp(false);
    console.log("[Zenith] Verificação manual do status");
    const status = await refetch();
    console.log(`[Zenith] Status após verificação manual: ${status}`);
    setManualRefetching(false);
    if (status !== "active") setPollingGaveUp(true);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Bem-vindo ao Zenith AI</h1>
      <p className="text-muted-foreground mb-8">Escolha uma categoria para começar</p>

      {checkoutSuccess && (
        <div className="glass rounded-xl p-5 glow-border-cyan mb-8 max-w-2xl flex items-start gap-3">
          <div className="shrink-0 mt-0.5">
            {isActive ? (
              <CheckCircle2 className="h-5 w-5 text-neon-cyan" />
            ) : (
              <Loader2 className={`h-5 w-5 text-neon-purple ${checkingCheckout || manualRefetching ? "animate-spin" : ""}`} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">
              {isActive
                ? "Pagamento confirmado. Plano Premium ativo."
                : "Pagamento confirmado. Atualizando seu plano..."}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {isActive
                ? "Você agora tem acesso completo a todos os recursos do Zenith AI."
                : checkingCheckout || manualRefetching
                  ? "Sincronizando confirmação do Stripe com sua conta. Aguarde..."
                  : "O Stripe ainda está processando. Clique em verificar para tentar novamente."}
            </p>
            {pollingGaveUp && !isActive && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3 h-8 text-xs gap-1.5"
                onClick={handleManualRefetch}
                disabled={manualRefetching}
              >
                <RefreshCw className={`h-3 w-3 ${manualRefetching ? "animate-spin" : ""}`} />
                Verificar agora
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            to="/dashboard/generate"
            className={`glass rounded-xl p-5 ${cat.color} transition-all hover:scale-105 cursor-pointer block`}
          >
            <cat.icon className="h-8 w-8 text-neon-purple mb-3" />
            <h3 className="font-semibold">{cat.name}</h3>
            <p className="text-xs text-muted-foreground mt-1">{cat.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
