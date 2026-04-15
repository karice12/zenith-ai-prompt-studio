import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileText, Copy, Check, Zap, Clock, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/dashboard/prompts")({
  component: PromptsPage,
});

interface Prompt {
  id: string;
  content: string;
  created_at: string;
}

function extractTitle(content: string): string {
  const firstLine = content.split("\n").find((l) => l.trim().length > 0) ?? "";
  return firstLine.length > 80 ? firstLine.slice(0, 80) + "…" : firstLine || "Prompt gerado";
}

function extractPreview(content: string): string {
  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  const body = lines.slice(1).join(" ").trim() || lines[0] || "";
  return body.length > 160 ? body.slice(0, 160) + "…" : body;
}

function PromptCard({ prompt }: { prompt: Prompt }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(prompt.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const timeAgo = formatDistanceToNow(new Date(prompt.created_at), {
    addSuffix: true,
    locale: ptBR,
  });

  return (
    <div className="glass rounded-xl p-5 glow-border-purple flex flex-col gap-3 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-neon-purple/15 flex items-center justify-center border border-neon-purple/20 shrink-0 mt-0.5">
            <FileText className="h-4 w-4 text-neon-purple" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium leading-snug truncate">{extractTitle(prompt.content)}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">{timeAgo}</span>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="shrink-0 h-8 px-2.5"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-neon-cyan" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          <span className="text-xs ml-1">{copied ? "Copiado!" : "Copiar"}</span>
        </Button>
      </div>

      <div
        className={`rounded-lg bg-background/50 border border-border p-3 font-mono text-xs text-muted-foreground leading-relaxed cursor-pointer transition-all ${
          expanded ? "whitespace-pre-wrap" : "line-clamp-3"
        }`}
        onClick={() => setExpanded((v) => !v)}
        title={expanded ? "Clique para recolher" : "Clique para expandir"}
      >
        {expanded ? prompt.content : extractPreview(prompt.content)}
      </div>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-neon-purple transition-colors self-start"
      >
        <ChevronRight
          className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-90" : ""}`}
        />
        {expanded ? "Recolher" : "Ver completo"}
      </button>
    </div>
  );
}

function PromptsPage() {
  const { user } = useAuth();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !user) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchPrompts() {
      setLoading(true);
      setError(null);

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 20);

      const { data, error: fetchError } = await supabase
        .from("prompts_history")
        .select("id, content, created_at")
        .eq("user_id", user!.id)
        .gte("created_at", cutoff.toISOString())
        .order("created_at", { ascending: false })
        .limit(50);

      if (!cancelled) {
        if (fetchError) {
          setError("Não foi possível carregar seus prompts.");
        } else {
          setPrompts(data ?? []);
        }
        setLoading(false);
      }
    }

    fetchPrompts();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold">Meus Prompts</h1>
        {!loading && prompts.length > 0 && (
          <span className="text-xs text-muted-foreground px-2.5 py-1 rounded-full bg-muted border border-border">
            {prompts.length} prompt{prompts.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      <p className="text-muted-foreground mb-8">Histórico dos últimos 20 dias</p>

      {loading && (
        <div className="flex items-center justify-center h-48">
          <div className="h-8 w-8 rounded-full border-2 border-neon-purple border-t-transparent animate-spin" />
        </div>
      )}

      {!loading && error && (
        <div className="glass rounded-xl p-8 glow-border-purple text-center max-w-md">
          <FileText className="h-10 w-10 text-destructive mx-auto mb-3" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {!loading && !error && prompts.length === 0 && (
        <div className="glass rounded-xl p-14 glow-border-purple text-center max-w-md">
          <div className="h-16 w-16 rounded-full bg-neon-purple/10 flex items-center justify-center mx-auto mb-5 border border-neon-purple/20">
            <Zap className="h-8 w-8 text-neon-purple" />
          </div>
          <h2 className="font-semibold mb-2">Seu histórico está vazio</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Seu histórico aparecerá aqui. Vamos criar algo novo?
          </p>
          <Link to="/dashboard/generate">
            <Button variant="hero" className="w-full">
              <Zap className="h-4 w-4" />
              Gerar primeiro prompt
            </Button>
          </Link>
        </div>
      )}

      {!loading && !error && prompts.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {prompts.map((prompt) => (
            <PromptCard key={prompt.id} prompt={prompt} />
          ))}
        </div>
      )}
    </div>
  );
}
