"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ItineraryPreview, PreviewItinerary } from "./itinerary-preview";
import { TripSummaryPanel } from "./trip-summary-panel";
import { ChatMessage, EMPTY_SUMMARY, IntakeSummary } from "./types";

const OPENER =
  "Hi! I'm your Waypoint guide. Tell me about the trip you have in mind — where to, roughly when, and who's coming?";

export function IntakeChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: OPENER },
  ]);
  const [summary, setSummary] = useState<IntakeSummary>(EMPTY_SUMMARY);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftProgress, setDraftProgress] = useState(0);
  const [itinerary, setItinerary] = useState<PreviewItinerary | null>(null);
  const [tripId, setTripId] = useState<string | null>(null);
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || streaming) return;
      setInput("");
      setStreaming(true);

      const history: ChatMessage[] = [...messages, { role: "user", content }];
      // The scripted opener stays client-side; the API conversation must
      // start with a user turn.
      const apiMessages = history.filter(
        (m, i) => !(i === 0 && m.role === "assistant"),
      );
      setMessages([...history, { role: "assistant", content: "" }]);

      try {
        const res = await fetch("/api/intake", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages }),
        });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let assistantText = "";

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

            if (event === "text") {
              assistantText += (JSON.parse(data) as { delta: string }).delta;
              setMessages((prev) => [
                ...prev.slice(0, -1),
                { role: "assistant", content: assistantText },
              ]);
            } else if (event === "summary") {
              const parsed = JSON.parse(data) as Partial<IntakeSummary>;
              setSummary({ ...EMPTY_SUMMARY, ...parsed });
            } else if (event === "error") {
              throw new Error(
                (JSON.parse(data) as { message: string }).message,
              );
            }
          }
        }
      } catch {
        setMessages((prev) => [
          ...prev.slice(0, -1),
          {
            role: "assistant",
            content:
              "Sorry — something went wrong on my end. Mind sending that again?",
          },
        ]);
      } finally {
        setStreaming(false);
      }
    },
    [messages, streaming],
  );

  const draft = useCallback(async () => {
    if (drafting) return;
    setDrafting(true);
    setDraftProgress(0);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
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
          if (event === "progress") {
            setDraftProgress((JSON.parse(data) as { chars: number }).chars);
          } else if (event === "itinerary") {
            setItinerary(JSON.parse(data) as PreviewItinerary);
          } else if (event === "trip") {
            const { tripId: id } = JSON.parse(data) as { tripId: string };
            setTripId(id);
            // Land on the editable canvas (the real workspace), not the
            // read-only preview.
            router.push(`/trips/${id}`);
          } else if (event === "error") {
            throw new Error((JSON.parse(data) as { message: string }).message);
          }
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Drafting hit a snag — give it another try in a moment, or keep refining the trip.",
        },
      ]);
    } finally {
      setDrafting(false);
    }
  }, [drafting, summary, router]);

  if (itinerary) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-surface-variant bg-surface-warm px-6 py-3">
          <span className="text-sm font-medium text-on-surface-variant">
            {tripId
              ? "Opening your editable itinerary…"
              : "Finishing up your itinerary…"}
          </span>
          {tripId && (
            <a
              href={`/trips/${tripId}`}
              className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-white transition-transform hover:opacity-90 active:scale-95"
            >
              Open editable itinerary →
            </a>
          )}
        </div>
        <ItineraryPreview itinerary={itinerary} />
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Chat — left 55% */}
      <section className="flex w-[55%] flex-col border-r border-surface-variant">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-6">
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed",
                m.role === "user"
                  ? "ml-auto bg-primary text-white"
                  : "bg-white shadow-sm border border-surface-variant/50",
              )}
            >
              {m.content || (
                <span className="inline-block animate-pulse text-on-surface-variant">
                  …
                </span>
              )}
            </div>
          ))}
          {summary.chips.length > 0 && !streaming && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-on-surface-variant/60">
                Tap a quick reply, or just type your answer
              </p>
              <div className="flex flex-wrap gap-2">
                {summary.chips.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => send(chip)}
                    className="rounded-full border border-surface-variant/60 bg-white px-4 py-2 text-xs font-bold text-on-surface-variant shadow-sm transition-all hover:border-primary/40 hover:text-primary"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {drafting && (
          <div className="border-t border-surface-variant bg-primary/5 px-6 py-2 text-xs font-medium text-primary">
            Drafting your itinerary — this can take a minute or two for long
            trips{draftProgress > 0 ? ` (${draftProgress.toLocaleString()} characters so far)` : ""}…
          </div>
        )}
        <form
          className="flex gap-2 border-t border-surface-variant bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Reply to Waypoint…"
            disabled={streaming}
            className="rounded-full"
          />
          <Button
            type="submit"
            disabled={streaming || !input.trim()}
            className="rounded-full px-6"
          >
            Send
          </Button>
        </form>
      </section>

      {/* Trip so far — right 45% */}
      <TripSummaryPanel summary={summary} onDraft={draft} drafting={drafting} />
    </div>
  );
}
