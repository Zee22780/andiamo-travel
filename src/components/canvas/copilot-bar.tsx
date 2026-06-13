"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CanvasStop, CanvasTrip } from "./types";
import { buildDayStops, CanvasDndState } from "./use-canvas-dnd";

type Suggestion = {
  dayId: string;
  title: string;
  stopType: CanvasStop["type"];
  startTime?: string;
  durationMin?: number;
  reason?: string;
};

type Msg = { role: "user" | "assistant"; content: string };

const STARTERS = [
  "Make day 1 calmer",
  "Add a rest afternoon",
  "Find a dinner spot near the river",
];

export function CopilotBar({
  tripId,
  dnd,
  dayLabels,
  initialMessages,
  request,
}: {
  tripId: string;
  dnd: CanvasDndState;
  dayLabels: Record<string, string>;
  initialMessages: { role: "user" | "assistant"; content: string }[];
  request?: { text: string; n: number } | null;
}) {
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  // Suggestions live in their own state so streaming text can never clobber them.
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  // Fire canvas-originated prompts ("Fix this day") through the same send path.
  // Track the last-handled request number so each click sends exactly once.
  const lastRequestN = useRef(request?.n ?? 0);
  useEffect(() => {
    if (request && request.n !== lastRequestN.current) {
      lastRequestN.current = request.n;
      send(request.text);
    }
    // send is intentionally omitted; we react only to a new request number.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  async function resyncBoard() {
    try {
      const res = await fetch(`/api/trips/${tripId}/state`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const { trip } = (await res.json()) as { trip: CanvasTrip };
      dnd.resync(buildDayStops(trip.legs.flatMap((l) => l.days)));
    } catch {
      // board stays as-is; user can reload
    }
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    setInput("");
    setOpen(true);
    setBusy(true);
    setMessages((m) => [
      ...m,
      { role: "user", content },
      { role: "assistant", content: "" },
    ]);

    try {
      const res = await fetch(`/api/trips/${tripId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistant = "";
      let didApply = false;

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
            assistant += (JSON.parse(data) as { delta: string }).delta;
            setMessages((m) => {
              const next = [...m];
              next[next.length - 1] = { role: "assistant", content: assistant };
              return next;
            });
          } else if (event === "applied") {
            didApply = true;
          } else if (event === "suggestions") {
            const { items } = JSON.parse(data) as { items: Suggestion[] };
            // Only keep suggestions that target a real day on this trip.
            const valid = (items ?? []).filter((s) => s.dayId in dayLabels);
            if (valid.length) setSuggestions((prev) => [...prev, ...valid]);
          } else if (event === "error") {
            throw new Error((JSON.parse(data) as { message: string }).message);
          }
        }
      }
      if (didApply) await resyncBoard();
    } catch {
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = {
          role: "assistant",
          content: "Something went wrong — try that again in a moment.",
        };
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  async function acceptSuggestion(idx: number) {
    const s = suggestions[idx];
    if (!s) return;
    try {
      const res = await fetch("/api/stops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayId: s.dayId,
          title: s.title,
          type: s.stopType,
          startTime: s.startTime ?? null,
          durationMin: s.durationMin ?? null,
        }),
      });
      if (res.ok) {
        setSuggestions((prev) => prev.filter((_, i) => i !== idx));
        await resyncBoard();
      }
    } catch {
      // ignore; suggestion card stays
    }
  }

  function dismissSuggestion(idx: number) {
    setSuggestions((prev) => prev.filter((_, i) => i !== idx));
  }

  const hasContent = messages.length > 0 || suggestions.length > 0;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center px-4 pb-5">
      {open && hasContent && (
        <div className="pointer-events-auto mb-3 max-h-80 w-full max-w-2xl overflow-y-auto rounded-2xl border border-surface-variant bg-white/95 p-4 shadow-xl backdrop-blur">
          <div className="space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed",
                  m.role === "user"
                    ? "ml-auto bg-primary text-white"
                    : "bg-surface-warm",
                )}
              >
                {m.content || (
                  <span className="animate-pulse text-on-surface-variant">…</span>
                )}
              </div>
            ))}

            {suggestions.map((s, i) => (
              <div
                key={`sugg-${i}`}
                className="rounded-xl border border-amber-200 bg-amber-50/60 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{s.title}</span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                    suggested
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  {dayLabels[s.dayId] ?? "a day"}
                  {s.startTime ? ` · ${s.startTime}` : ""}
                  {s.reason ? ` — ${s.reason}` : ""}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => acceptSuggestion(i)}
                  >
                    Add it
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => dismissSuggestion(i)}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!open && (
        <div className="pointer-events-auto mb-2 flex flex-wrap justify-center gap-2">
          {STARTERS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full border border-surface-variant/60 bg-white px-3 py-1.5 text-xs font-bold text-on-surface-variant shadow-sm transition-all hover:border-primary/40 hover:text-primary"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="pointer-events-auto flex w-full max-w-2xl items-center gap-2 rounded-full bg-primary p-2 pl-5 shadow-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => messages.length > 0 && setOpen(true)}
          disabled={busy}
          placeholder="Ask anything — 'fill Thursday afternoon', 'make day 2 calmer'…"
          className="border-0 bg-transparent text-white placeholder:text-white/70 focus-visible:ring-0"
        />
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="px-2 text-xs font-medium text-white/80 hover:text-white"
          >
            {open ? "Hide" : "Show"}
          </button>
        )}
        <Button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-full bg-white px-5 text-primary hover:bg-white/90"
        >
          {busy ? "…" : "Send"}
        </Button>
      </form>
    </div>
  );
}
