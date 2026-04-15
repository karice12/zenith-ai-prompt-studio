import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
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
    resolve: {
      alias: {
        "@": `${process.cwd()}/src`,
      },
    },
  },
});
