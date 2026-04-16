import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Code2, Blocks, Brain, Rocket, CheckCircle2, Loader2 } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";

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
  const checkoutSuccess = useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("checkout") === "success";
  }, []);

  useEffect(() => {
    if (!checkoutSuccess || isActive) return;

    let cancelled = false;
    setCheckingCheckout(true);

    async function pollSubscriptionStatus() {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const status = await refetch();
        if (cancelled || status === "active") break;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      if (!cancelled) setCheckingCheckout(false);
    }

    pollSubscriptionStatus();

    return () => {
      cancelled = true;
    };
  }, [checkoutSuccess, isActive, refetch]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Bem-vindo ao Zenith AI</h1>
      <p className="text-muted-foreground mb-8">Escolha uma categoria para começar</p>

      {checkoutSuccess && (
        <div className="glass rounded-xl p-5 glow-border-cyan mb-8 max-w-2xl flex items-center gap-3">
          {isActive ? (
            <CheckCircle2 className="h-5 w-5 text-neon-cyan shrink-0" />
          ) : (
            <Loader2 className="h-5 w-5 text-neon-purple shrink-0 animate-spin" />
          )}
          <div>
            <p className="font-semibold text-sm">
              {isActive ? "Pagamento confirmado. Plano Premium ativo." : "Pagamento confirmado. Atualizando seu plano..."}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {checkingCheckout && !isActive
                ? "Estamos sincronizando a confirmação do Stripe com sua conta."
                : "Se o status ainda não aparecer, aguarde alguns segundos e atualize a página."}
            </p>
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
