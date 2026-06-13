import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextRequest } from "next/server";
import { GENERATE_SYSTEM } from "@/lib/ai/generate";
import { ItinerarySchema, TripSummary } from "@/lib/ai/schemas";
import { saveItinerary } from "@/db/trips";

// Vercel Hobby caps function execution at 60s. Large multi-week generations
// can brush against this — keep new trips shorter when testing on Hobby, or
// raise this on a paid plan.
export const maxDuration = 60;

// POST { summary: TripSummary } → SSE stream:
//   event "progress"  data {chars}      — generation heartbeat
//   event "itinerary" data {…Itinerary} — final validated itinerary
//   event "done" / "error"
export async function POST(req: NextRequest) {
  const { summary } = (await req.json()) as { summary: unknown };
  if (!summary || typeof summary !== "object") {
    return new Response(JSON.stringify({ error: "summary required" }), {
      status: 400,
    });
  }

  const client = new Anthropic();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      try {
        const aiStream = client.messages.stream({
          model: "claude-opus-4-8",
          max_tokens: 64000,
          thinking: { type: "adaptive" },
          system: GENERATE_SYSTEM,
          output_config: { format: zodOutputFormat(ItinerarySchema) },
          messages: [
            {
              role: "user",
              content: `Traveler profile:\n${JSON.stringify(summary, null, 2)}\n\nDraft the full itinerary.`,
            },
          ],
        });

        let chars = 0;
        let lastBeat = 0;
        aiStream.on("text", (delta) => {
          chars += delta.length;
          if (chars - lastBeat > 2000) {
            lastBeat = chars;
            send("progress", { chars });
          }
        });

        const final = await aiStream.finalMessage();
        if (final.stop_reason === "refusal") {
          throw new Error("Generation was declined; please adjust the trip details.");
        }
        const text =
          final.content.find((b) => b.type === "text")?.text ?? "";
        const itinerary = ItinerarySchema.parse(JSON.parse(text));
        send("itinerary", itinerary);
        const tripId = await saveItinerary(
          itinerary,
          summary as Partial<TripSummary>,
        );
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
