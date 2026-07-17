# Andiamo orchestrator (Python / FastAPI)

Multi-agent trip generation: **orchestrator (Opus) → parallel leg-workers
(Haiku) → critic (Opus)**, called by the Next.js app behind the
`ORCHESTRATOR_URL` flag. Contracts in `CONTRACT.md`; build order and hints in
`GUIDE.md`; piece breakdown in `../notes/leg-worker-plan.md`.

## Run

```sh
cd orchestrator
uv sync                                    # once — creates .venv, installs deps
uv run uvicorn app.main:app --reload --port 8100
```

- `GET  http://localhost:8100/health` → `{"status": "ok"}`
- `POST http://localhost:8100/plan` → SSE stream (stub mode until the real
  pipeline lands): `curl -N localhost:8100/plan -H 'content-type: application/json' -d '{"summary":{"destination":"Porto"},"catalog":[]}'`

`ANTHROPIC_API_KEY` is read from the repo root `.env.local` via dotenv (see
`app/claude.py`).

## Test

```sh
uv run pytest            # harness + implemented pieces; unimplemented ones skip
uv run pytest -m live    # real API calls (needs the key; costs money)
```

Skips are your progress tracker — each names the piece and the guide section.

## Wire into the app

Two env vars gate the new path (both unset ⇒ the original single-call
planner, `/api/generate`, exactly as before):

- `ORCHESTRATOR_URL` — server-side: where `/api/generate-orchestrated`
  finds this service (it 503s without it).
- `NEXT_PUBLIC_USE_ORCHESTRATOR=1` — client-side: makes the intake screen
  target the new endpoint (inlined at build time, so restart dev after
  changing it).

```sh
ORCHESTRATOR_URL=http://localhost:8100 NEXT_PUBLIC_USE_ORCHESTRATOR=1 npm run dev
```
