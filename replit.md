# Zenith AI — Seu Engenheiro de Prompt

## Project Overview
A React-based AI prompt engineering dashboard built with TanStack Start (SSR), Tailwind CSS v4, and shadcn/ui components.

## Tech Stack
- **Framework:** React 19 + TanStack Start (full-stack SSR)
- **Routing:** TanStack Router (file-based, under `src/routes/`)
- **Styling:** Tailwind CSS v4 + shadcn/ui (Radix UI primitives)
- **Build Tool:** Vite 7
- **Package Manager:** npm
- **Runtime:** Node.js 22
- **Language:** TypeScript

## Project Structure
- `src/routes/` — File-based routes (root, login, signup, dashboard and nested routes)
- `src/routes/api/checkout.ts` — TanStack Start server route for Stripe checkout sessions
- `src/routes/api/webhook.ts` — TanStack Start server route for Stripe webhook subscription updates
- `src/routes/api/webhooks/stripe.ts` — Alias route for Stripe webhook endpoint compatibility
- `src/components/` — Reusable UI components (shadcn/ui in `ui/`, feature components at root)
- `src/hooks/` — Custom React hooks
- `src/lib/` — Utilities (Supabase client, Tailwind class merging)
- `src/styles.css` — Global styles and Tailwind imports
- `src/routeTree.gen.ts` — Auto-generated route tree (do not edit manually)

## Key Routes
- `/` — Landing page
- `/login` — Login
- `/signup` — Sign up
- `/dashboard` — Main dashboard
- `/dashboard/prompts` — Prompts management
- `/dashboard/templates` — Templates
- `/dashboard/subscription` — Subscription management
- `/dashboard/generate` — Generate prompts

## Development
- **Dev server:** `npm run dev` → port 5000
- **Build:** `npm run build`
- **Host:** `0.0.0.0` with `allowedHosts: true` for Replit proxy compatibility
- Missing client Supabase settings now disable auth-dependent features with a clear message instead of crashing the preview.
- Auth clears invalid local sessions and refreshes expired sessions before API token use to avoid stale cross-domain tokens.

## Environment Variables Required
- `VITE_SUPABASE_URL` — Supabase project URL (client-side)
- `VITE_SUPABASE_ANON_KEY` — Supabase anon key (client-side)
- `SUPABASE_URL` — Supabase project URL (server-side)
- `SUPABASE_ANON_KEY` — Supabase anon key fallback for server-side auth validation
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server-side only, keep secret)
- `STRIPE_SECRET_KEY` — Stripe secret key (server-side)
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret (server-side)
- `STRIPE_PRICE_MONTHLY` — (optional) Pre-created Stripe price ID for monthly plan
- `STRIPE_PRICE_ANNUAL` — (optional) Pre-created Stripe price ID for annual plan
- `NEXT_PUBLIC_APP_URL` — Public URL of the app (used for Stripe redirect URLs when set; Vercel URL envs are also supported)
- `GEMINI_API_KEY` — Google Gemini API key for prompt generation

## Vite Config
Standard TanStack Start + Vite config (migrated from Lovable-specific config).
Uses `@tanstack/react-start/plugin/vite`, `@tailwindcss/vite`, `vite-tsconfig-paths`, and `@vitejs/plugin-react`.
The Vite config exposes `VITE_` environment variables to client code via `import.meta.env`.

## Deployment
- **Target:** Static site
- **Build command:** `npm run build`
- **Public dir:** `dist/client`

## Stripe Webhook
- Current Replit dev webhook path: `/api/webhooks/stripe`
- Legacy webhook path still supported: `/api/webhook`
- Required secret: `STRIPE_WEBHOOK_SECRET`
- Webhook writes use `SUPABASE_SERVICE_ROLE_KEY` only in server-side webhook routes to bypass RLS for subscription status updates.
- Checkout routes validate the JWT with the anon key and perform profile/customer operations through a user-scoped Supabase client, not the service role key.
