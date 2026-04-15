import { createFileRoute } from "@tanstack/react-router";
import { LayoutTemplate } from "lucide-react";

export const Route = createFileRoute("/dashboard/templates")({
  component: TemplatesPage,
});

function TemplatesPage() {
  const templates = [
    { name: "Landing Page SaaS", platform: "Lovable" },
    { name: "API REST Completa", platform: "Replit" },
    { name: "Análise de Dados", platform: "Claude" },
    { name: "Dashboard Admin", platform: "Lovable" },
    { name: "Chatbot com IA", platform: "Claude" },
    { name: "E-commerce MVP", platform: "SaaS Builder" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Templates</h1>
      <p className="text-muted-foreground mb-8">Modelos prontos para acelerar seus projetos</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((t) => (
          <div key={t.name} className="glass rounded-xl p-5 glow-border-purple transition-all hover:scale-105 cursor-pointer">
            <LayoutTemplate className="h-6 w-6 text-neon-purple mb-3" />
            <h3 className="font-semibold text-sm">{t.name}</h3>
            <span className="text-xs text-neon-cyan mt-1 inline-block">{t.platform}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
