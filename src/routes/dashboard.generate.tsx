import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Zap, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/dashboard/generate")({
  component: GeneratePage,
});

function GeneratePage() {
  const [objective, setObjective] = useState("");
  const [stack, setStack] = useState("");
  const [detail, setDetail] = useState("medium");
  const [platform, setPlatform] = useState("lovable");
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);

  const handleGenerate = () => {
    // Simulated output
    const prompt = `[${platform.toUpperCase()}] Objetivo: ${objective}\nStack: ${stack}\nNível de Detalhe: ${detail}\n\nAtue como um engenheiro de software sênior. Crie ${objective} utilizando ${stack}. Siga boas práticas, código limpo e componentizado. Implemente tratamento de erros e responsividade.`;
    setOutput(prompt);
  };

  const handleCopy = async () => {
    if (output) {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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

          <Button variant="hero" className="w-full" onClick={handleGenerate} disabled={!objective}>
            <Zap className="h-4 w-4" />
            Gerar Prompt
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
