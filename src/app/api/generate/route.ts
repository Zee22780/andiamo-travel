import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextRequest } from "next/server";
import { GENERATE_SYSTEM } from "@/lib/ai/generate";
import { ItinerarySchema, TripSummary } from "@/lib/ai/schemas";
import {
  catalogPromptBlock,
  loadCatalog,
  recordCatalogUse,
  resolveItinerary,
} from "@/db/poi-library";
import { countStops, parsePartialItinerary } from "@/lib/ai/partial-itinerary";
import { saveItinerary } from "@/db/trips";
import { seedChatMessages } from "@/db/chat";

type IntakeMessage = { role: "user" | "assistant"; content: string };

// Keep only well-formed transcript turns; ignore anything malformed so a bad
// body can never break generation.
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

// Vercel Hobby caps function execution at 60s. Large multi-week generations
// can brush against this — keep new trips shorter when testing on Hobby, or
// raise this on a paid plan.
export const maxDuration = 60;

// POST { summary: TripSummary } → SSE stream:
//   event "progress"  data {chars}      — generation heartbeat
//   event "itinerary" data {…Itinerary} — final validated itinerary
//   event "done" / "error"
export async function POST(req: NextRequest) {
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

  const client = new Anthropic();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      try {
        // Known-places catalog for the trip's destinations: the model can
        // schedule these by slug (cheap reference) instead of writing each
        // stop out; empty catalog = no block, exactly the old behavior.
        const s = summary as Partial<TripSummary>;
        const catalog = await loadCatalog([
          ...(s.route ?? []),
          ...(s.destination ? [s.destination] : []),
        ]);
        const catalogBlock = catalogPromptBlock(catalog);

        const aiStream = client.messages.stream({
          model: "claude-opus-4-8",
          max_tokens: 64000,
          thinking: { type: "adaptive" },
          system: GENERATE_SYSTEM,
          output_config: { format: zodOutputFormat(ItinerarySchema) },
          messages: [
            {
              role: "user",
              content: `Traveler profile:\n${JSON.stringify(summary, null, 2)}\n\n${
                catalogBlock ? `${catalogBlock}\n\n` : ""
              }Draft the full itinerary.`,
            },
          ],
        });

        let chars = 0;
        let lastBeat = 0;
        let accumulated = "";
        let lastPartialStops = 0;
        aiStream.on("text", (delta) => {
          chars += delta.length;
          accumulated += delta;
          if (chars - lastBeat > 2000) {
            lastBeat = chars;
            send("progress", { chars });
            // Progressive rendering: parse whatever has streamed so far and,
            // when new complete stops exist, ship a reference-resolved
            // partial for the client to render live. Best-effort — a failed
            // parse just means no partial this beat.
            const partial = parsePartialItinerary(accumulated);
            if (partial) {
              const stops = countStops(partial);
              if (stops > lastPartialStops) {
                lastPartialStops = stops;
                send("partial", resolveItinerary(partial, catalog).itinerary);
              }
            }
          }
        });

        const final = await aiStream.finalMessage();
        if (final.stop_reason === "refusal") {
          throw new Error("Generation was declined; please adjust the trip details.");
        }
        const text =
          final.content.find((b) => b.type === "text")?.text ?? "";
        const parsed = ItinerarySchema.parse(JSON.parse(text));
        // Expand catalog references into full, pre-verified stops before
        // anything downstream (preview + persistence) sees the itinerary.
        const { itinerary, usedSlugs, unknownSlugs } = resolveItinerary(
          parsed,
          catalog,
        );
        console.log(
          `[generate] catalog=${catalog.length} refs=${usedSlugs.length}` +
            (unknownSlugs.length ? ` unknown=${unknownSlugs.join(",")}` : "") +
            ` output_tokens=${final.usage.output_tokens}`,
        );
        send("itinerary", itinerary);
        const tripId = await saveItinerary(
          itinerary,
          summary as Partial<TripSummary>,
        );
        await recordCatalogUse(usedSlugs);
        // Persist the intake interview as the trip's opening conversation so
        // the traveler can return to it from the canvas copilot.
        if (transcript.length) await seedChatMessages(tripId, transcript);
        send("trip", { tripId });
        send("done", {});
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
