import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Zap, Mail, Lock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — Zenith AI" },
      { name: "description", content: "Acesse sua conta Zenith AI." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: integrate auth
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-96 h-96 rounded-full bg-neon-purple/10 blur-[120px]" />
        <div className="absolute bottom-1/3 right-1/3 w-80 h-80 rounded-full bg-neon-magenta/8 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md glass rounded-2xl p-8 glow-border-purple">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Zap className="h-7 w-7 text-neon-purple" />
          <span className="text-xl font-bold gradient-text">Zenith AI</span>
        </div>

        <h1 className="text-2xl font-bold text-center mb-2">Entrar</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">Acesse sua estação de trabalho</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="email" type="email" placeholder="seu@email.com" className="pl-10" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="password" type="password" placeholder="••••••••" className="pl-10" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>
          <Button variant="hero" className="w-full" type="submit">Entrar</Button>
        </form>

        <p className="text-sm text-muted-foreground text-center mt-6">
          Não tem conta?{" "}
          <Link to="/signup" className="text-neon-purple hover:underline">Cadastre-se</Link>
        </p>
      </div>
    </div>
  );
}
