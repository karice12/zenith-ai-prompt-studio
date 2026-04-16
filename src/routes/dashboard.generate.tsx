import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Zap, Copy, Check, Scissors, ShoppingCart, Heart, GraduationCap, Landmark, UtensilsCrossed, MoreHorizontal, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";

export const Route = createFileRoute("/dashboard/generate")({
  component: GeneratePage,
});

const NICHES = [
  { value: "higiene-beleza", label: "Higiene e Beleza", hint: "Barbeiro, Salão", icon: Scissors },
  { value: "ecommerce", label: "E-commerce e Vendas", hint: "Shopify, Mercado Livre", icon: ShoppingCart },
  { value: "saude", label: "Saúde e Bem-estar", hint: "Clínicas, Consultórios", icon: Heart },
  { value: "educacao", label: "Educação e Info-produtos", hint: "", icon: GraduationCap },
  { value: "financeiro", label: "Serviços Financeiros", hint: "", icon: Landmark },
  { value: "gastronomia", label: "Gastronomia", hint: "Restaurantes, Delivery", icon: UtensilsCrossed },
  { value: "outros", label: "Outros", hint: "Campo livre", icon: MoreHorizontal },
];

function GeneratePage() {
  const [objective, setObjective] = useState("");
  const [stack, setStack] = useState("");
  const [niche, setNiche] = useState("");
  const [customNiche, setCustomNiche] = useState("");
  const [detail, setDetail] = useState("medium");
  const [platform, setPlatform] = useState("lovable");
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const { getToken } = useAuth();
  const { isActive, loading: subLoading } = useSubscription();
  const navigate = useNavigate();

  useEffect(() => {
    if (!subLoading && !isActive) {
      const timer = setTimeout(() => {
        navigate({ to: "/dashboard/subscription" });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isActive, subLoading, navigate]);

  const resolvedNiche = niche === "outros" ? customNiche : NICHES.find(n => n.value === niche)?.label || "";

  const handleGenerate = async () => {
    setApiError(null);
    setGenerating(true);

    const token = await getToken();

    if (!token) {
      setApiError("Sessão expirada. Faça login novamente.");
      setGenerating(false);
      return;
    }

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          platform,
          niche: resolvedNiche || "Geral",
          goal: `${objective} — Nível de detalhe: ${detail}`,
          stack,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const missing: string[] = data.missingEnv ?? [];
        const errorMsg = missing.length > 0
          ? `Variáveis de ambiente ausentes no servidor: ${missing.join(", ")}. Configure-as no painel do Vercel e faça um novo deploy.`
          : data.error || "Erro ao gerar prompt.";
        setApiError(errorMsg);
        setGenerating(false);
        return;
      }

      setOutput(data.prompt);
    } catch {
      setApiError("Erro de conexão. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (output) {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (subLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-2 border-neon-purple border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-4">
        <div className="glass rounded-2xl p-10 glow-border-purple max-w-md w-full flex flex-col items-center gap-6">
          <div className="h-16 w-16 rounded-full bg-neon-purple/15 flex items-center justify-center border border-neon-purple/30">
            <Lock className="h-8 w-8 text-neon-purple" />
          </div>
          <div>
            <h2 className="text-xl font-bold mb-2">Acesso restrito a assinantes</h2>
            <p className="text-muted-foreground text-sm">
              Esta funcionalidade é exclusiva para assinantes do Zenith AI.
              Você será redirecionado para os planos em instantes...
            </p>
          </div>
          <Button
            variant="hero"
            className="w-full"
            onClick={() => navigate({ to: "/dashboard/subscription" })}
          >
            Ver Planos
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Gerar Prompt</h1>
      <p className="text-muted-foreground mb-8">Preencha os campos e gere seu prompt otimizado</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input form */}
        <div className="glass rounded-xl p-6 glow-border-purple space-y-5">
          <div className="space-y-2">
            <Label>Plataforma</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lovable">Lovable</SelectItem>
                <SelectItem value="replit">Replit</SelectItem>
                <SelectItem value="claude">Claude</SelectItem>
                <SelectItem value="saas">SaaS Builder</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Objetivo</Label>
            <Input placeholder="Ex: Dashboard de analytics" value={objective} onChange={(e) => setObjective(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Stack Tecnológica</Label>
            <Input placeholder="Ex: React, TypeScript, Tailwind" value={stack} onChange={(e) => setStack(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Nicho / Setor</Label>
            <Select value={niche} onValueChange={(v) => { setNiche(v); if (v !== "outros") setCustomNiche(""); }}>
              <SelectTrigger><SelectValue placeholder="Selecione o nicho" /></SelectTrigger>
              <SelectContent>
                {NICHES.map((n) => {
                  const Icon = n.icon;
                  return (
                    <SelectItem key={n.value} value={n.value}>
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-[var(--neon-purple)] shrink-0" />
                        <span>{n.label}</span>
                        {n.hint && <span className="text-muted-foreground text-xs">({n.hint})</span>}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {niche === "outros" && (
              <Input
                placeholder="Digite seu nicho..."
                value={customNiche}
                onChange={(e) => setCustomNiche(e.target.value)}
                className="mt-2"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Nível de Detalhe</Label>
            <Select value={detail} onValueChange={setDetail}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Básico</SelectItem>
                <SelectItem value="medium">Médio</SelectItem>
                <SelectItem value="high">Avançado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {apiError && (
            <p className="text-sm text-destructive">{apiError}</p>
          )}

          <Button variant="hero" className="w-full" onClick={handleGenerate} disabled={!objective || generating}>
            <Zap className="h-4 w-4" />
            {generating ? "Gerando..." : "Gerar Prompt"}
          </Button>
        </div>

        {/* Output */}
        <div className="glass rounded-xl p-6 glow-border-cyan flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-neon-cyan">Output</span>
            <Button variant="ghost" size="sm" onClick={handleCopy} disabled={!output}>
              {copied ? <Check className="h-4 w-4 text-neon-cyan" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado!" : "Copiar"}
            </Button>
          </div>
          <div className="flex-1 rounded-lg bg-background/50 p-4 font-mono text-sm text-muted-foreground whitespace-pre-wrap min-h-[200px] overflow-auto border border-border">
            {output || "Seu prompt aparecerá aqui..."}
          </div>
        </div>
      </div>
    </div>
  );
}