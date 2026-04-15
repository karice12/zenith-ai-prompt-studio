import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Zap, Mail, Lock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Cadastro — Zenith AI" },
      { name: "description", content: "Crie sua conta Zenith AI." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await signUp(email, password, name);

    if (error) {
      setError(error);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    setTimeout(() => navigate({ to: "/dashboard" }), 2000);
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

        <h1 className="text-2xl font-bold text-center mb-2">Criar Conta</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">Comece a criar prompts perfeitos</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="name" placeholder="Seu nome" className="pl-10" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
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
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
          {success && (
            <p className="text-sm text-green-500 text-center">Conta criada! Redirecionando...</p>
          )}

          <Button variant="hero" className="w-full" type="submit" disabled={loading}>
            {loading ? "Criando conta..." : "Criar Conta"}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground text-center mt-6">
          Já tem conta?{" "}
          <Link to="/login" className="text-neon-purple hover:underline">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
