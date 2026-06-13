<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Andiamo — project orientation

Andiamo (formerly "Waypoint") is an AI travel planner **and** in-trip companion (web first). You plan a real multi-week trip conversationally, edit it on a drag-and-drop canvas, and a copilot makes targeted changes by editing the **same DB rows** the canvas does — no "regenerate everything."

## Stack
- **Next.js 16** (App Router, route handlers, `export const dynamic = "force-dynamic"` where state must be fresh), **Tailwind v4** (`@theme` tokens in `src/app/globals.css`), **shadcn/ui** (radix-nova). Brand: teal `#0E7C6B`, terracotta accent `#D96F32`, warm off-white `#FAF8F5`, Bricolage Grotesque + Plus Jakarta Sans, 12px radius.
- **Supabase Postgres + Drizzle** — schema in `src/db/schema.ts`, client in `src/db/client.ts` (session pooler, `prepare:false`). Auth is a single shared **demo profile** for now (real Supabase Auth + RLS is an M0 leftover).
- **Anthropic SDK**, model `claude-opus-4-8`. Prompts in `src/lib/ai/*` use frozen system blocks + prompt caching. Structured output via zod (`src/lib/ai/schemas.ts`). The copilot is a manual tool-use loop: `get_trip_state` / `update_stops` / `suggest_stops`.
- **Maps:** MapLibre GL + MapTiler tiles + MapTiler geocoding (`MAPTILER_KEY`).

## Data model
`trips → legs → days → stops` (+ `trip_members`, `chat_messages`, `profiles`). Stops carry `verification` (unverified/verified/flagged), `source` (ai/user), and `lat/lng`. Trip phase (upcoming/active/past) is **derived from leg dates**, not stored.

## Key conventions
- Read the Next.js note above before writing any Next code.
- The **canvas is the source-of-truth UI**. The copilot and the "Verify places" pass both mutate DB rows then resync the board via `GET /api/trips/[id]/state` (force-dynamic + `cache:"no-store"`).
- **The database is the source of truth — there is no seed/fixture step.** Create trips through the app (intake → generate). Do not add seed data.
- Verify behavior in a **real browser** (Playwright MCP) — this project values e2e verification over unit tests. Run `npm run build` to typecheck + lint.

## Run
- `npm run dev` → http://localhost:3000. `npm run build` → typecheck + lint.
- `.env.local` holds secrets (`ANTHROPIC_API_KEY`, `DATABASE_URL`, Supabase keys, `MAPTILER_KEY`). Never commit it.

## Where the build is tracked
**`PLAN.md`** (local, gitignored) is the canonical doc: milestone roadmap, current status, the autonomous build-loop charter, and a dated progress log. **Read it first to continue the build.** `notes/` holds the product brief, tech brief, and design system. These are local-only — see the git rules in the user's global `~/.claude/CLAUDE.md` (no committing `PLAN.md`, `notes/`, `CLAUDE.md`, `.claude/`, `.env*`).
