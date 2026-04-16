import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/gemini-check")({
  server: {
    handlers: {
      GET: async () => {
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
          return Response.json(
            { error: "GEMINI_API_KEY não está configurada no ambiente." },
            { status: 500 }
          );
        }

        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
          );
          const data = await res.json() as {
            models?: { name: string; supportedGenerationMethods?: string[] }[];
            error?: { code: number; message: string };
          };

          if (!res.ok) {
            return Response.json(
              {
                keyPresent: true,
                keyLength: apiKey.length,
                apiStatus: res.status,
                apiError: data.error,
              },
              { status: 200 }
            );
          }

          const generateModels = (data.models ?? [])
            .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
            .map((m) => m.name);

          return Response.json({
            keyPresent: true,
            keyLength: apiKey.length,
            availableModels: generateModels,
          });
        } catch (err) {
          return Response.json(
            { error: String(err) },
            { status: 500 }
          );
        }
      },
    },
  },
});
