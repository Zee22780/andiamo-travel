# Orchestrator service contracts (C1 + C2)

These two contracts are the interlock between the Next.js app (TypeScript) and this
FastAPI orchestration service (Python). They are deliberately small; **any change to
either side must update this file first.** Source of truth on the TS side:
`src/lib/ai/schemas.ts` (Zod).

---

## C1 — Schema contract (Pydantic ≡ Zod)

The Python models in `app/models.py` must mirror `ItinerarySchema` / `TripSummarySchema`
**exactly** — same field names (camelCase on the wire), same optionality, same value
constraints. A drift here is the design's main failure mode.

Pydantic notes: use `model_config = ConfigDict(extra="forbid")` so typos fail loudly, and
camelCase field names exactly as below (no snake_case aliasing needed — the wire format IS
the field name).

### `InlineStop`

| Field | Type | Constraints / meaning |
|---|---|---|
| `type` | str enum | `"activity" \| "meal" \| "lodging" \| "transit"` |
| `title` | str | required |
| `description` | str \| None | required key, nullable |
| `startTime` | str | 24h `HH:MM`, regex `^([01]\d\|2[0-3]):[0-5]\d$` |
| `durationMin` | int | > 0 |
| `costEstimate` | int \| None | ≥ 0; per person USD; null = free/unknown |
| `mustDo` | bool | required |
| `userAdded` | bool | true only for traveler-specified must-includes |

### `RefStop` — compact reference to a Known-places catalog entry

| Field | Type | Constraints / meaning |
|---|---|---|
| `poi` | str | exact slug of a catalog entry, e.g. `porto/livraria-lello`. **Never invented** — only slugs present in the request catalog. |
| `startTime` | str | 24h `HH:MM` (same regex) |
| `durationMin` | int \| None | > 0; null = use the catalog's typical duration |
| `mustDo` | bool | required |
| `userAdded` | bool | required |

### `Stop` = `RefStop | InlineStop`

Discriminate by the presence of the `poi` key (TS does `"poi" in stop`). In Pydantic,
a plain `RefStop | InlineStop` union with `extra="forbid"` on both resolves this
unambiguously (an inline stop has no `poi`; a ref has no `title`/`type`).

### `Day`

| Field | Type | Constraints |
|---|---|---|
| `date` | str | `YYYY-MM-DD`, regex `^\d{4}-\d{2}-\d{2}$` |
| `notes` | str \| None | day theme / pacing note |
| `stops` | list[Stop] | |

### `Leg`

| Field | Type | Constraints |
|---|---|---|
| `destination` | str | city or region, e.g. `"Kyoto"` |
| `startDate` | str | `YYYY-MM-DD` |
| `endDate` | str | `YYYY-MM-DD` |
| `lodging` | str \| None | suggested neighborhood/area, not a specific hotel |
| `days` | list[Day] | must cover startDate…endDate, one Day per date |

### `Itinerary`

| Field | Type |
|---|---|
| `tripName` | str |
| `legs` | list[Leg] |

### `TripSummary` (request input — never emitted by Python)

| Field | Type | Constraints |
|---|---|---|
| `destination` | str \| None | |
| `route` | list[str] | ordered destinations; empty if unknown |
| `startDate` | str \| None | |
| `endDate` | str \| None | |
| `travelers` | int \| None | > 0 |
| `budget` | str enum \| None | `"shoestring" \| "mid" \| "comfortable" \| "luxury"` |
| `pace` | str enum \| None | `"relaxed" \| "balanced" \| "packed"` |
| `interests` | list[str] | |
| `mustInclude` | list[MustInclude] | `{title: str, when: str \| None, fixed: bool}` |
| `readyToGenerate` | bool | |

### The POI-resolution seam (who does what)

- **TS** loads the full library rows (`loadCatalog` in `src/db/poi-library.ts`) and sends
  Python only the **compact projection** below.
- **Python** may schedule catalog places as `RefStop`s (cheap slugs) and must scope each
  leg-worker to **its own destination's catalog subset** (filter on `destination`).
- **TS** expands refs back into full stops via the existing `resolveItinerary(catalog)`
  after the response — resolution logic is **never duplicated in Python**. Refs travel
  through every Python stage (workers → assembly → critic → response) **intact**.

### `CatalogEntry` (request input)

| Field | Type | Meaning |
|---|---|---|
| `slug` | str | prompt-facing id, `"<city>/<title>"` |
| `destination` | str | normalized leg destination (lowercase) — the worker-scoping key |
| `type` | str enum | `"activity" \| "meal"` (only these are ever in the library) |
| `title` | str | display title |
| `typicalDurationMin` | int \| None | default duration when a ref's `durationMin` is null |

---

## C2 — HTTP contract

### `GET /health`
`200 {"status": "ok"}` — liveness only.

### `POST /plan`

**Request** (`application/json`):

```json
{
  "summary":  { …TripSummary… },
  "catalog":  [ …CatalogEntry… ]
}
```

Malformed body → FastAPI's standard `422` (before any stream starts).

**Response**: `200` with `Content-Type: text/event-stream`. Events, in order:

| Event | Data (JSON) | Emitted |
|---|---|---|
| `skeleton` | `{"tripName": str, "legs": [{"destination": str, "startDate": str, "endDate": str}]}` | once, after the orchestrator plans the leg split — lets the client render city placeholders |
| `leg` | `{"index": int, "total": int, "leg": Leg}` | once per leg, **as each worker finishes — completion order, not itinerary order**; `index` is the leg's position in the final itinerary (0-based) |
| `itinerary` | full `Itinerary` (assembled + critic-patched, **refs intact**) | exactly once, on success |
| `done` | `{}` | terminal, after `itinerary` |
| `error` | `{"message": str}` | terminal, instead of `itinerary`/`done` |

Wire format per event:

```
event: leg
data: {"index": 0, "total": 2, "leg": {…}}

```

(One `data:` line of compact JSON, blank line terminator — matches how the Next.js
routes already emit SSE.)

**Consumer behavior (TS side, for reference):** relay `leg` events to the browser as
progressive `partial` updates; on `itinerary`, run `resolveItinerary` → `saveItinerary` →
`recordCatalogUse` → `seedChatMessages` exactly as `src/app/api/generate/route.ts` does.

### Environment

The service reads `ANTHROPIC_API_KEY` (via dotenv from the repo root `.env.local` in dev).
No database access — the service is stateless; persistence stays in TS.
