import { NextRequest } from "next/server";
import { ItinerarySchema, TripSummary } from "@/lib/ai/schemas";
import {
  loadCatalog,
  recordCatalogUse,
  resolveItinerary,
} from "@/db/poi-library";
import { saveItinerary } from "@/db/trips";
import { seedChatMessages } from "@/db/chat";
import type { Itinerary } from "@/lib/ai/schemas";

type Leg = Itinerary["legs"][number];

type IntakeMessage = { role: "user" | "assistant"; content: string };

// Keep only well-formed transcript turns; ignore anything malformed so a bad
// body can never break generation. (Mirrors /api/generate.)
function sanitizeTranscript(input: unknown): IntakeMessage[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((m) => {
    if (
      m &&
      typeof m === "object" &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.trim()
    ) {
      return [{ role: m.role, content: m.content }];
    }
    return [];
  });
}

export const maxDuration = 60;

// Experimental multi-agent planner path. Same request/SSE surface as
// /api/generate (progress/partial/itinerary/trip/done/error), but the middle
// box — the single Opus generation call — is replaced by the Python
// orchestration service (orchestrator/CONTRACT.md § C2). Everything from
// resolveItinerary onward is the same battle-tested seam. Gated by
// ORCHESTRATOR_URL; /api/generate remains the default planner.
export async function POST(req: NextRequest) {
  const orchestratorUrl = process.env.ORCHESTRATOR_URL;
  if (!orchestratorUrl) {
    return new Response(
      JSON.stringify({ error: "ORCHESTRATOR_URL is not configured" }),
      { status: 503 },
    );
  }

  const { summary, messages } = (await req.json()) as {
    summary: unknown;
    messages?: unknown;
  };
  if (!summary || typeof summary !== "object") {
    return new Response(JSON.stringify({ error: "summary required" }), {
      status: 400,
    });
  }
  const transcript = sanitizeTranscript(messages);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      try {
        const s = summary as Partial<TripSummary>;
        const catalog = await loadCatalog([
          ...(s.route ?? []),
          ...(s.destination ? [s.destination] : []),
        ]);

        const upstream = await fetch(`${orchestratorUrl}/plan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            summary,
            // Compact projection (CONTRACT.md § CatalogEntry) — full rows,
            // placeId, and coords stay here; TS owns resolution.
            catalog: catalog.map((p) => ({
              slug: p.slug,
              destination: p.destination,
              type: p.type,
              title: p.title,
              typicalDurationMin: p.typicalDurationMin,
            })),
          }),
        });
        if (!upstream.ok || !upstream.body) {
          throw new Error(`orchestrator responded ${upstream.status}`);
        }

        // Legs arrive in worker-completion order, indexed by final position.
        const legsByIndex: (Leg | undefined)[] = [];
        let finished = false;

        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let sep;
          while ((sep = buffer.indexOf("\n\n")) !== -1) {
            const frame = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            const event = frame.match(/^event: (.*)$/m)?.[1];
            const data = frame.match(/^data: (.*)$/m)?.[1];
            if (!event || !data) continue;

            if (event === "leg") {
              const payload = JSON.parse(data) as { index: number; leg: Leg };
              legsByIndex[payload.index] = payload.leg;
              // Progressive rendering: ship the known legs (resolved) so the
              // preview fills city by city as workers finish. Best-effort —
              // the final itinerary event is authoritative.
              try {
                const known = legsByIndex.filter(
                  (leg): leg is Leg => leg !== undefined,
                );
                const partial: Itinerary = { tripName: "", legs: known };
                send("partial", resolveItinerary(partial, catalog).itinerary);
              } catch {
                // skip this beat; a malformed leg fails the final parse below
              }
            } else if (event === "itinerary") {
              const parsed = ItinerarySchema.parse(JSON.parse(data));
              const { itinerary, usedSlugs, unknownSlugs } = resolveItinerary(
                parsed,
                catalog,
              );
              console.log(
                `[generate-orchestrated] catalog=${catalog.length} refs=${usedSlugs.length}` +
                  (unknownSlugs.length
                    ? ` unknown=${unknownSlugs.join(",")}`
                    : ""),
              );
              send("itinerary", itinerary);
              const tripId = await saveItinerary(
                itinerary,
                summary as Partial<TripSummary>,
              );
              await recordCatalogUse(usedSlugs);
              if (transcript.length) await seedChatMessages(tripId, transcript);
              send("trip", { tripId });
              send("done", {});
              finished = true;
            } else if (event === "error") {
              const { message } = JSON.parse(data) as { message: string };
              throw new Error(`orchestrator: ${message}`);
            }
            // "skeleton" is informational for now — P2.2 (per-leg progressive
            // rendering) will surface it as city placeholders in the preview.
          }
        }
        if (!finished) {
          throw new Error("orchestrator stream ended without an itinerary");
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "unknown error";
        send("error", { message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
