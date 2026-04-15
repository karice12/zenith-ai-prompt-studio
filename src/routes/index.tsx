import { createFileRoute } from "@tanstack/react-router";
import { LandingHeader, HeroSection, PricingSection, Footer } from "@/components/landing-sections";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Zenith AI — Seu Engenheiro de Prompt" },
      { name: "description", content: "Engenharia de prompts avançada com IA. Gere prompts otimizados para Lovable, Replit, Claude e mais." },
      { property: "og:title", content: "Zenith AI — Seu Engenheiro de Prompt" },
      { property: "og:description", content: "A ciência por trás do prompt perfeito." },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />
      <HeroSection />
      <PricingSection />
      <Footer />
    </div>
  );
}
