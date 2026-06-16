import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { INTAKE_SYSTEM, UPDATE_TRIP_SUMMARY_TOOL } from "@/lib/ai/intake";

export const maxDuration = 60;

// POST { messages: [{role, content}] } → SSE stream:
//   event "text"    data {delta}            — assistant reply tokens
//   event "summary" data {…TripSummary, chips} — final trip-so-far state
//   event "done"    data {}
export async function POST(req: NextRequest) {
  const { messages } = (await req.json()) as {
    messages: Anthropic.MessageParam[];
  };
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: "messages required" }), {
      status: 400,
    });
  }

  const client = new Anthropic();
  const encoder = new TextEncoder();

  // Anchor relative/partial dates ("October", "next month") to a real calendar
  // and keep the trip in the future. Appended AFTER the frozen INTAKE_SYSTEM so
  // this volatile value never invalidates the cached prefix (cache_control sits
  // on the last frozen block).
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const system: Anthropic.TextBlockParam[] = [
    ...INTAKE_SYSTEM,
    { type: "text", text: `Today's date is ${today}. The traveler is planning an upcoming trip — resolve any month or season they name to its next future occurrence and never propose dates in the past.` },
  ];

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      try {
        const aiStream = client.messages.stream({
          model: "claude-opus-4-8",
          max_tokens: 1024,
          output_config: { effort: "low" }, // short interview turns; latency matters
          system,
          tools: [UPDATE_TRIP_SUMMARY_TOOL],
          messages,
        });

        aiStream.on("text", (delta) => send("text", { delta }));

        const final = await aiStream.finalMessage();
        const toolUse = final.content.find((b) => b.type === "tool_use");
        if (toolUse) send("summary", toolUse.input);
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
