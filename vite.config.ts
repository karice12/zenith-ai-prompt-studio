import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const viteEnvDefine: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith("VITE_")) {
      viteEnvDefine[`import.meta.env.${key}`] = JSON.stringify(value);
    }
  }

  return {
    define: viteEnvDefine,
    plugins: [
      tailwindcss(),
      tsconfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart(),
      react(),
    ],
    resolve: {
      alias: {
        "@": `${process.cwd()}/src`,
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    server: {
      host: "0.0.0.0",
      port: 5000,
      strictPort: true,
      allowedHosts: true,
      hmr: {
        protocol: "wss",
        host: process.env.REPLIT_DEV_DOMAIN,
        clientPort: 443,
      },
    },
  };
});
