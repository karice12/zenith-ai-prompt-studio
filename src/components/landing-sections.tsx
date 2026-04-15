import { Link } from "@tanstack/react-router";
import { Zap, Brain, Sparkles, Github, Twitter, Linkedin } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Zap className="h-6 w-6 text-neon-purple" />
          <span className="text-lg font-bold gradient-text">Zenith AI</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6">
          <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Preços</a>
          <Link to="/login">
            <Button variant="ghost" size="sm">Entrar</Button>
          </Link>
          <Link to="/signup">
            <Button variant="hero" size="sm">Começar Agora</Button>
          </Link>
        </nav>
        <Link to="/signup" className="md:hidden">
          <Button variant="hero" size="sm">Começar</Button>
        </Link>
      </div>
    </header>
  );
}

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-neon-purple/10 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-neon-magenta/8 blur-[100px]" />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 rounded-full bg-neon-cyan/5 blur-[80px]" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-neon-purple/30 bg-neon-purple/5 mb-8">
          <Sparkles className="h-4 w-4 text-neon-purple" />
          <span className="text-xs text-neon-purple font-medium">Powered by AI</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight leading-tight">
          <span className="gradient-text">Zenith AI</span>
          <br />
          <span className="text-foreground">A Ciência por trás do</span>
          <br />
          <span className="text-foreground">Prompt Perfeito</span>
        </h1>

        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          Engenharia de prompts avançada para Lovable, Replit, Claude e mais. 
          Gere prompts otimizados e acelere seu desenvolvimento.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/signup">
            <Button variant="hero" size="xl">
              <Zap className="h-5 w-5" />
              Começar Agora
            </Button>
          </Link>
          <Link to="/login">
            <Button variant="glow" size="xl">
              Já tenho conta
            </Button>
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
          {[
            { icon: Brain, title: "Engenharia Avançada", desc: "Prompts otimizados por IA" },
            { icon: Zap, title: "Templates Prontos", desc: "Para as maiores plataformas" },
            { icon: Sparkles, title: "Resultados Precisos", desc: "Output limpo e funcional" },
          ].map((f) => (
            <div key={f.title} className="glass rounded-xl p-5 glow-border-purple transition-all hover:scale-105">
              <f.icon className="h-8 w-8 text-neon-purple mb-3" />
              <h3 className="font-semibold text-sm">{f.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PricingSection() {
  return (
    <section id="pricing" className="py-24 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto text-center mb-12">
        <h2 className="text-3xl sm:text-4xl font-bold gradient-text">Planos</h2>
        <p className="mt-3 text-muted-foreground">Escolha o plano ideal para você</p>
      </div>

      <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Monthly */}
        <div className="glass rounded-2xl p-6 glow-border-purple flex flex-col">
          <h3 className="text-lg font-semibold">Mensal</h3>
          <div className="mt-4">
            <span className="text-4xl font-bold">R$ 69,90</span>
            <span className="text-muted-foreground text-sm">/mês</span>
          </div>
          <ul className="mt-6 space-y-3 text-sm text-muted-foreground flex-1">
            <li className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-neon-purple" /> Prompts ilimitados</li>
            <li className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-neon-purple" /> Todos os templates</li>
            <li className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-neon-purple" /> Suporte prioritário</li>
          </ul>
          <Link to="/signup" className="mt-6">
            <Button variant="outline" className="w-full">Assinar Mensal</Button>
          </Link>
        </div>

        {/* Annual */}
        <div className="relative glass rounded-2xl p-6 glow-border-magenta flex flex-col">
          <div className="absolute -top-3 right-4 px-3 py-1 rounded-full gradient-bg text-xs font-semibold text-primary-foreground">
            Mais Popular
          </div>
          <h3 className="text-lg font-semibold">Anual</h3>
          <div className="mt-4">
            <span className="text-4xl font-bold">R$ 712,98</span>
            <span className="text-muted-foreground text-sm">/ano</span>
          </div>
          <p className="text-xs text-neon-cyan mt-1">Economize R$ 125,82</p>
          <ul className="mt-6 space-y-3 text-sm text-muted-foreground flex-1">
            <li className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-neon-magenta" /> Tudo do plano mensal</li>
            <li className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-neon-magenta" /> Acesso antecipado</li>
            <li className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-neon-magenta" /> Templates exclusivos</li>
          </ul>
          <Link to="/signup" className="mt-6">
            <Button variant="hero" className="w-full">Assinar Anual</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border py-12 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-neon-purple" />
          <span className="font-bold gradient-text">Zenith AI</span>
        </div>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <a href="#" className="hover:text-foreground transition-colors">Termos</a>
          <a href="#" className="hover:text-foreground transition-colors">Privacidade</a>
          <a href="#" className="hover:text-foreground transition-colors">Contato</a>
        </div>
        <div className="flex items-center gap-4">
          <a href="#" className="text-muted-foreground hover:text-neon-purple transition-colors"><Github className="h-5 w-5" /></a>
          <a href="#" className="text-muted-foreground hover:text-neon-purple transition-colors"><Twitter className="h-5 w-5" /></a>
          <a href="#" className="text-muted-foreground hover:text-neon-purple transition-colors"><Linkedin className="h-5 w-5" /></a>
        </div>
      </div>
    </footer>
  );
}
