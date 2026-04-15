import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `You are a senior prompt engineer specializing in generating precise, production-ready prompts for AI systems. Your output must be a single, complete, technical prompt with zero ambiguity. Follow these rules strictly:
1. Output ONLY the final prompt — no explanations, no commentary, no markdown headers.
2. The prompt must be structured, explicit, and tailored to the provided platform, niche, goal, and tech stack.
3. Use imperative language. Define tone, format, constraints, and expected output within the prompt itself.
4. Include relevant technical context based on the stack provided.
5. The prompt must be self-contained and immediately usable without modification.`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  const token = authHeader.replace("Bearer ", "");

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("subscription_status")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return res.status(403).json({ error: "Profile not found" });
  }

  if (profile.subscription_status !== "active") {
    return res.status(403).json({ error: "Active subscription required" });
  }

  const { platform, niche, goal, stack } = req.body;

  if (!platform || !niche || !goal || !stack) {
    return res.status(400).json({ error: "Missing required fields: platform, niche, goal, stack" });
  }

  const userMessage = `Platform: ${platform}\nNiche: ${niche}\nGoal: ${goal}\nTech Stack: ${stack}`;

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

  const { error: insertError } = await supabase
    .from("prompts_history")
    .insert({
      user_id: user.id,
      content: generatedPrompt,
      created_at: new Date().toISOString(),
    });

  if (insertError) {
    console.error("Failed to save prompt history:", insertError);
  }

  return res.status(200).json({ prompt: generatedPrompt });
}
