# Your build path — orchestrator core, piece by piece

Each piece has a skeleton file with `TODO(you)` markers and a **pytest
acceptance check** — you're done when it passes. Run `uv run pytest` any time:
skips tell you what's left, greens tell you what works. Stuck? Say
**"review P0.1"** (etc.) in any Claude session for a review or unblock — and
`app/stub.py` + `app/main.py` are working FastAPI/SSE reference code to crib
from. Hints below point the way; they're not solutions.

Order: **P0.1 → P0.3 → P1.1 → P1.2 → P1.3 → P1.4**, then we pair on P1.5.

---

## P0.1 — Pydantic models ≡ C1  (`app/models.py`)

**Goal:** Python speaks the exact itinerary shape the TS app speaks (Zod).
**Check:** `uv run pytest tests/test_models_roundtrip.py`
**Read first:** `CONTRACT.md` § C1 — it's the field-by-field spec.

Hints:
- Pydantic v2 basics: subclass `BaseModel`; a field is just an annotation
  (`title: str`, `description: str | None`). Parse with
  `Model.model_validate(dict)`, serialize with `model_dump(mode="json")`.
- `model_config = ConfigDict(extra="forbid")` on **every** model — it's both
  a typo guard and what makes the `RefStop | InlineStop` union unambiguous
  (an inline stop has no `poi` field to match, a ref has no `title`).
- The union is just a type alias: `Stop = RefStop | InlineStop`. Order
  matters in unions without a discriminator — put `RefStop` first and check
  what happens if you flip it (the round-trip test will tell you).
- Regex constraints: `Field(pattern=TIME_RE)`. Positive int:
  `Field(gt=0)`. Enums: `Literal["activity", "meal", "lodging", "transit"]`.
- "No field loss" means `model_dump(mode="json") == original` — every field
  present, including the nulls. If the dump drops or adds keys, a field is
  misnamed or has a wrong default.

## P0.3 — First real Claude call  (`app/claude.py`)

**Goal:** async client + key + one real request work.
**Check:** `uv run pytest -m live tests/test_live.py::test_smoke_call`

Hints:
- `from anthropic import AsyncAnthropic` — the async twin of the TS SDK the
  app already uses. `load_env()` (provided) puts the key in the environment;
  `AsyncAnthropic()` picks it up.
- One message: `await client.messages.create(model=ORCHESTRATOR_MODEL,
  max_tokens=…, messages=[{"role": "user", "content": "…"}])`. The response's
  `.content` is a list of blocks; text lives in blocks with `.type == "text"`.
- Try it interactively first: `uv run python -c "import asyncio, app.claude as c; print(asyncio.run(c.smoke()))"`.

## P1.1 — Orchestrator: profile → leg skeleton  (`app/orchestrator.py`)

**Goal:** Opus plans the *shape* of the trip (cities, day split, pacing,
budget split, transit days) as a typed object — no stops yet.
**Check:** `uv run pytest -m live tests/test_live.py::test_orchestrator_skeleton_covers_every_date`

Hints:
- Define `LegSkeleton` / `TripSkeleton` in this file (sketch in the module
  docstring). They're internal — not part of C1 — so shape them for good
  reasoning, not for the wire.
- **Structured output** is the key new concept: constrain the model's reply
  to your Pydantic schema. The Python SDK's recommended path is
  `client.messages.parse(..., output_format=TripSkeleton)` → the validated
  object is on `response.parsed_output`. (If your installed SDK version
  differs, the equivalent is `output_config={"format": …}` on
  `messages.create` — check `import anthropic; help(anthropic)`.)
- Prompt: traveler profile (JSON) + the catalog city list + explicit rules —
  every date from startDate to endDate in exactly one leg; legs in travel
  order; say *why* per-leg pacing/budget guidance matters (the worker reads it).
- Opus + adaptive thinking (`thinking={"type": "adaptive"}`) is the right
  setting for a planning call.

## P1.2 — Leg-worker: one leg, scoped context  (`app/worker.py`)

**Goal:** Haiku fills one leg's days/stops in C1 shape, from only its own
slice of context.
**Check:** `uv run pytest -m live tests/test_live.py::test_worker_fills_one_leg`

Hints:
- Same structured-output pattern as P1.1, but `output_format=models.Leg` and
  `model=WORKER_MODEL` (Haiku — the cheap bulk generator; that split is the
  cost story of this whole design).
- The prompt gets three things only: the shared profile, this leg's skeleton,
  this city's catalog subset. Emitting a catalog place = a `{"poi": slug, …}`
  ref, slugs strictly from the subset. Look at `catalogPromptBlock()` in
  `../src/db/poi-library.ts` for the wording the model already understands.
- The live test checks: right dates, non-empty days, no invented slugs.

## P1.3 — Fan-out: `asyncio.gather`  (`app/fanout.py`)

**Goal:** all workers run at once; wall-clock ≈ the slowest leg.
**Check:** `uv run pytest tests/test_fanout.py` (no API key — it injects a
fake worker and *measures* concurrency).

Hints:
- `await asyncio.gather(*(worker(s) for s in leg_skeletons))` — gather
  preserves argument order, which is exactly the ordering guarantee the test
  wants. That's genuinely almost the whole function.
- Worth understanding *why* this parallelizes: each worker coroutine spends
  its time awaiting network I/O, so the event loop interleaves them — no
  threads involved.

## P1.4 — Assembly  (`app/assemble.py`)

**Goal:** stitch worker legs into one C1 `Itinerary`.
**Check:** `uv run pytest tests/test_assemble.py` (pure, no API).

Hints:
- Sort by `startDate` (ISO strings sort correctly as strings), validate the
  result by constructing `models.Itinerary`, keep refs untouched.
- The test feeds legs in reverse order on purpose — workers finish whenever
  they finish.

## Then: wire it in

Swap the stub in `app/main.py` for the real pipeline (the TODO there shows
the shape) — emit a `leg` SSE event as each worker finishes, `itinerary` after
assembly. At that point the Next.js side (already built against the stub)
lights up with real multi-agent generation, and we pair on **P1.5 (critic)**
and then measure tokens/cost old-vs-new (P3).
