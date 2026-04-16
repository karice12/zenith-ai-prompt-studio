import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const jsonHeaders = {
  "Content-Type": "application/json",
};

const SYSTEM_PROMPT = `You are a senior prompt engineer specializing in generating precise, production-ready prompts for AI systems. Your output must be a single, complete, technical prompt with zero ambiguity. Follow these rules strictly:
1. Output ONLY the final prompt — no explanations, no commentary, no markdown headers.
2. The prompt must be structured, explicit, and tailored to the provided platform, niche, goal, and tech stack.
3. Use imperative language. Define tone, format, constraints, and expected output within the prompt itself.
4. Include relevant technical context based on the stack provided.
5. The prompt must be self-contained and immediately usable without modification.`;

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: jsonHeaders });
}

function getAuthToken(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

function getSupabaseAdmin() {
  return createClient(
    process.env.VITE_SUPABASE_URL as string,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function getSupabaseAuth() {
  return createClient(
    process.env.VITE_SUPABASE_URL as string,
    process.env.VITE_SUPABASE_ANON_KEY as string,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function getMissingEnv() {
  return [
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_ANON_KEY",
    "VITE_SUPABASE_SERVICE_ROLE_KEY",
    "GEMINI_API_KEY",
  ].filter((key) => !process.env[key]);
}

export const Route = createFileRoute("/api/generate")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: { ...jsonHeaders, Allow: "POST, OPTIONS" },
        }),

      POST: async ({ request }) => {
        try {
          const missingEnv = getMissingEnv();
          if (missingEnv.length > 0) {
            console.error("[generate] Env ausente:", missingEnv);
            return json({ error: "Configuração incompleta.", missingEnv }, 500);
          }

          const token = getAuthToken(request);
          if (!token) return json({ error: "Token de autorização ausente" }, 401);

          const supabaseAuth = getSupabaseAuth();
          const { data: authData, error: authError } = await supabaseAuth.auth.getUser(token);
          if (authError || !authData.user) {
            console.error("[generate] auth.getUser falhou:", authError?.message);
            return json({ error: "Sessão inválida. Faça login novamente." }, 401);
          }

          const userId = authData.user.id;
          console.log("[generate] Usuário autenticado:", userId);

          const supabaseAdmin = getSupabaseAdmin();
          const { data: profile, error: profileError } = await supabaseAdmin
            .from("profiles")
            .select("subscription_status")
            .eq("id", userId)
            .maybeSingle();

          console.log("[generate] Profile lookup:", {
            userId,
            status: profile?.subscription_status ?? null,
            hasError: Boolean(profileError),
            errorMessage: profileError?.message ?? null,
          });

          if (profileError) {
            console.error("[generate] Profile lookup falhou:", profileError.message);
            return json({ error: "Erro ao verificar assinatura." }, 500);
          }

          if (!profile) {
            console.error("[generate] Profile não encontrado para userId:", userId);
            return json({ error: "Perfil não encontrado. Contate o suporte." }, 403);
          }

          if (profile.subscription_status !== "active") {
            console.warn("[generate] Assinatura inativa:", profile.subscription_status);
            return json({ error: "Assinatura ativa necessária para gerar prompts." }, 403);
          }

          let body: { platform?: string; niche?: string; goal?: string; stack?: string };
          try {
            body = await request.json();
          } catch {
            return json({ error: "Corpo da requisição inválido." }, 400);
          }

          const { platform, niche, goal, stack } = body;
          if (!platform || !niche || !goal || !stack) {
            return json({ error: "Campos obrigatórios ausentes: platform, niche, goal, stack." }, 400);
          }

          const userMessage = `Platform: ${platform}\nNiche: ${niche}\nGoal: ${goal}\nTech Stack: ${stack}`;

          console.log("[generate] Chamando Gemini API", { platform, niche, userId });

          let generatedPrompt: string;
          try {
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string, { apiVersion: "v1" });
            const model = genAI.getGenerativeModel({
              model: "gemini-1.5-flash-latest",
              systemInstruction: SYSTEM_PROMPT,
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 2048,
              },
            });

            const result = await model.generateContent(userMessage);
            generatedPrompt = result.response.text();
            console.log("[generate] Gemini respondeu com sucesso, tamanho:", generatedPrompt.length);
          } catch (geminiError) {
            const msg = geminiError instanceof Error ? geminiError.message : String(geminiError);
            console.error("[generate] Erro na chamada Gemini:", msg);
            return json({ error: `Erro na API de IA: ${msg}` }, 500);
          }

          const { error: insertError } = await supabaseAdmin
            .from("prompts_history")
            .insert({
              user_id: userId,
              content: generatedPrompt,
              created_at: new Date().toISOString(),
            });

          if (insertError) {
            console.error("[generate] Falha ao salvar histórico:", insertError.message);
          }

          return json({ prompt: generatedPrompt });
        } catch (unhandled) {
          const msg = unhandled instanceof Error ? unhandled.message : String(unhandled);
          console.error("[generate] Erro não tratado:", msg);
          return json({ error: `Erro interno do servidor: ${msg}` }, 500);
        }
      },
    },
  },
});
