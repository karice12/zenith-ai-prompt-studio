import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    server: {
      host: "0.0.0.0",
      port: 5000,
      strictPort: true,
      allowedHosts: [
        ".replit.dev",
        ".repl.co",
        "fddb1d69-2efe-48f2-a235-a90e61a5e8b7-00-1y9dzi3he8flm.janeway.replit.dev",
      ],
      hmr: {
        clientPort: 443,
      },
    },
    resolve: {
      alias: {
        "@": `${process.cwd()}/src`,
      },
    },
  },
});
