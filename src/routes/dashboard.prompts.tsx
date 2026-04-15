import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/dashboard/prompts")({
  component: PromptsPage,
});

function PromptsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Meus Prompts</h1>
      <p className="text-muted-foreground mb-8">Seus prompts salvos aparecerão aqui</p>

      <div className="glass rounded-xl p-12 glow-border-purple text-center">
        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Nenhum prompt salvo ainda</p>
        <p className="text-xs text-muted-foreground mt-1">Gere e salve prompts para acessá-los depois</p>
      </div>
    </div>
  );
}
