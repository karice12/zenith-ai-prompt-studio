import { createFileRoute, Link } from "@tanstack/react-router";
import { Code2, Blocks, Brain, Rocket } from "lucide-react";

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
  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Bem-vindo ao Zenith AI</h1>
      <p className="text-muted-foreground mb-8">Escolha uma categoria para começar</p>

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
