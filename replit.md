# Zenith AI — Seu Engenheiro de Prompt

## Project Overview
A React-based AI prompt engineering dashboard built with TanStack Start (SSR), Tailwind CSS v4, and shadcn/ui components.

## Tech Stack
- **Framework:** React 19 + TanStack Start (full-stack SSR)
- **Routing:** TanStack Router (file-based, under `src/routes/`)
- **Styling:** Tailwind CSS v4 + shadcn/ui (Radix UI primitives)
- **Build Tool:** Vite 7
- **Package Manager:** npm (node_modules present; bun.lockb also present from original)
- **Runtime:** Node.js 22
- **Language:** TypeScript

## Project Structure
- `src/routes/` — File-based routes (root, login, signup, dashboard and nested routes)
- `src/components/` — Reusable UI components (shadcn/ui in `ui/`, feature components at root)
- `src/hooks/` — Custom React hooks
- `src/lib/` — Utilities (Tailwind class merging, etc.)
- `src/styles.css` — Global styles and Tailwind imports
- `src/routeTree.gen.ts` — Auto-generated route tree

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

## Deployment
- **Target:** Static site
- **Build command:** `npm run build`
- **Public dir:** `dist/client`
