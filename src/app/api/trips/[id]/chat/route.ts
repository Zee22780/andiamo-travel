import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { COPILOT_SYSTEM, COPILOT_TOOLS } from "@/lib/ai/copilot";
import { loadChat, saveChatMessage } from "@/db/chat";
import {
  applyStopOperations,
  loadTrip,
  loadTripRegion,
  StopOperation,
} from "@/db/trips";
import { placeLookup } from "@/lib/places";
import { travelTimes } from "@/lib/routes";

export const maxDuration = 120;

// POST { message } → SSE stream:
//   text        {delta}            — assistant tokens
//   applied     {count}            — update_stops took effect (client should refresh)
//   suggestions {items}            — proposed new stops for accept/decline
//   done / error
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tripId } = await params;
  const { message } = (await req.json()) as { message: string };
  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: "message required" }), {
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
        const history = await loadChat(tripId);
        await saveChatMessage(tripId, "user", message);

        // Region (country) for disambiguating place lookups in the grounding
        // tools. Loaded once; the queries append it to bare place names.
        const region = await loadTripRegion(tripId);
        const withRegion = (s: string) => (region ? `${s}, ${region}` : s);

        const messages: Anthropic.MessageParam[] = [
          ...history.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          { role: "user", content: message },
        ];

        let assistantText = "";
        let appliedTotal = 0;

        // Manual agentic loop: run tools server-side, feed results back.
        for (let turn = 0; turn < 6; turn++) {
          const ai = client.messages.stream({
            model: "claude-opus-4-8",
            max_tokens: 8000,
            thinking: { type: "adaptive" },
            system: COPILOT_SYSTEM,
            tools: COPILOT_TOOLS,
            messages,
          });
          ai.on("text", (delta) => {
            assistantText += delta;
            send("text", { delta });
          });
          const final = await ai.finalMessage();
          messages.push({ role: "assistant", content: final.content });

          if (final.stop_reason !== "tool_use") break;

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const block of final.content) {
            if (block.type !== "tool_use") continue;

            if (block.name === "get_trip_state") {
              const trip = await loadTrip(tripId);
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify(trip ?? { error: "trip not found" }),
              });
            } else if (block.name === "update_stops") {
              const { operations } = block.input as {
                operations: StopOperation[];
              };
              const { applied } = await applyStopOperations(operations);
              appliedTotal += applied;
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify({ applied }),
              });
            } else if (block.name === "suggest_stops") {
              const { suggestions } = block.input as { suggestions: unknown[] };
              send("suggestions", { items: suggestions });
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify({
                  surfaced: Array.isArray(suggestions) ? suggestions.length : 0,
                }),
              });
            } else if (block.name === "verify_place") {
              const { name } = block.input as { name: string };
              const p = await placeLookup(withRegion(name));
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify(
                  p.found
                    ? {
                        found: true,
                        name: p.displayName,
                        businessStatus: p.businessStatus ?? "OPERATIONAL",
                      }
                    : { found: false },
                ),
              });
            } else if (block.name === "get_travel_time") {
              const { origin, destination } = block.input as {
                origin: string;
                destination: string;
              };
              const [a, b] = await Promise.all([
                placeLookup(withRegion(origin)),
                placeLookup(withRegion(destination)),
              ]);
              let result: unknown;
              if (a.lat == null || a.lng == null) {
                result = { error: `Could not locate "${origin}".` };
              } else if (b.lat == null || b.lng == null) {
                result = { error: `Could not locate "${destination}".` };
              } else {
                const legs = await travelTimes([
                  {
                    key: "t",
                    from: { lat: a.lat, lng: a.lng },
                    to: { lat: b.lat, lng: b.lng },
                  },
                ]);
                const leg = legs.t;
                result = leg
                  ? {
                      durationMin: leg.durationMin,
                      distanceMeters: leg.distanceMeters,
                      mode: leg.mode,
                    }
                  : { error: "No route found between those places." };
              }
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify(result),
              });
            }
          }
          messages.push({ role: "user", content: toolResults });
        }

        if (appliedTotal > 0) send("applied", { count: appliedTotal });
        await saveChatMessage(tripId, "assistant", assistantText);
        send("done", {});
      } catch (error) {
        const m = error instanceof Error ? error.message : "unknown error";
        send("error", { message: m });
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
