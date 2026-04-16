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

function getSupabaseAuth() {
  return createClient(process.env.VITE_SUPABASE_URL as string, process.env.VITE_SUPABASE_ANON_KEY as string, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getSupabaseUserClient(token: string) {
  return createClient(process.env.VITE_SUPABASE_URL as string, process.env.VITE_SUPABASE_ANON_KEY as string, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

function getMissingEnv() {
  return [
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_ANON_KEY",
    "GEMINI_API_KEY",
  ].filter((key): key is string => Boolean(key && !process.env[key]));
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
        const missingEnv = getMissingEnv();
        if (missingEnv.length > 0) {
          console.error("[generate] Env ausente:", missingEnv);
          return json({ error: "Configuração incompleta.", missingEnv }, 500);
        }

        const token = getAuthToken(request);
        if (!token) return json({ error: "Missing authorization token" }, 401);

        const supabaseAuth = getSupabaseAuth();
        const { data: authData, error: authError } = await supabaseAuth.auth.getUser(token);
        if (authError || !authData.user) {
          console.error("[generate] auth.getUser falhou:", authError?.message);
          return json({ error: "Invalid token" }, 401);
        }

        const supabase = getSupabaseUserClient(token);
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("subscription_status")
          .eq("id", authData.user.id)
          .single();

        if (profileError || !profile) {
          console.error("[generate] Profile lookup falhou:", profileError?.message);
          return json({ error: "Profile not found" }, 403);
        }

        if (profile.subscription_status !== "active") {
          return json({ error: "Active subscription required" }, 403);
        }

        let body: { platform?: string; niche?: string; goal?: string; stack?: string };
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid request body" }, 400);
        }

        const { platform, niche, goal, stack } = body;
        if (!platform || !niche || !goal || !stack) {
          return json({ error: "Missing required fields: platform, niche, goal, stack" }, 400);
        }

        const userMessage = `Platform: ${platform}\nNiche: ${niche}\nGoal: ${goal}\nTech Stack: ${stack}`;
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
        const model = genAI.getGenerativeModel({
          model: "gemini-1.5-flash",
          systemInstruction: SYSTEM_PROMPT,
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 2048,
          },
        });

        const result = await model.generateContent(userMessage);
        const generatedPrompt = result.response.text();

        const { error: insertError } = await supabase.from("prompts_history").insert({
          user_id: authData.user.id,
          content: generatedPrompt,
          created_at: new Date().toISOString(),
        });

        if (insertError) {
          console.error("[generate] Falha ao salvar histórico:", insertError);
        }

        return json({ prompt: generatedPrompt });
      },
    },
  },
});