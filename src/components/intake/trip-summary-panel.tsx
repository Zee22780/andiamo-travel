"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { IntakeSummary } from "./types";

// Number of summary fields we track, for the mobile progress indicator.
function filledCount(summary: IntakeSummary): number {
  return [
    summary.destination,
    summary.startDate && summary.endDate,
    summary.travelers,
    summary.budget,
    summary.pace,
    summary.interests.length > 0,
  ].filter(Boolean).length;
}

const BUDGET_STEPS = ["shoestring", "mid", "comfortable", "luxury"] as const;
const PACE_STEPS = ["relaxed", "balanced", "packed"] as const;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/60">
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Unknown() {
  return <span className="text-sm text-on-surface-variant/50">—</span>;
}

function StepMeter<T extends string>({
  steps,
  value,
}: {
  steps: readonly T[];
  value: T | null;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {steps.map((step) => (
        <span
          key={step}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium capitalize",
            step === value
              ? "bg-primary/10 font-bold text-primary"
              : "text-on-surface-variant/50",
          )}
        >
          {step}
        </span>
      ))}
    </div>
  );
}

export function TripSummaryPanel({
  summary,
  onDraft,
  drafting,
}: {
  summary: IntakeSummary;
  onDraft: () => void;
  drafting: boolean;
}) {
  return (
    <aside className="hidden w-[45%] flex-col gap-6 overflow-y-auto bg-white p-8 lg:flex">
      <h2 className="font-headline text-2xl font-bold">Trip so far</h2>

      <Row label="Destination">
        {summary.destination ? (
          <div className="space-y-2">
            <span className="font-headline text-xl font-semibold">
              {summary.destination}
            </span>
            {summary.route.length > 1 && (
              <div className="flex flex-wrap items-center gap-1 text-sm text-on-surface-variant">
                {summary.route.map((city, i) => (
                  <span key={`${city}-${i}`} className="flex items-center gap-1">
                    {i > 0 && <span className="text-surface-variant">→</span>}
                    {city}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Unknown />
        )}
      </Row>

      <Row label="Dates">
        {summary.startDate && summary.endDate ? (
          <span className="text-sm font-medium">
            {summary.startDate} → {summary.endDate}
          </span>
        ) : (
          <Unknown />
        )}
      </Row>

      <Row label="Travelers">
        {summary.travelers ? (
          <span className="text-sm font-medium">{summary.travelers}</span>
        ) : (
          <Unknown />
        )}
      </Row>

      <Row label="Budget">
        {summary.budget ? (
          <StepMeter steps={BUDGET_STEPS} value={summary.budget} />
        ) : (
          <Unknown />
        )}
      </Row>

      <Row label="Pace">
        {summary.pace ? (
          <StepMeter steps={PACE_STEPS} value={summary.pace} />
        ) : (
          <Unknown />
        )}
      </Row>

      <Row label="Interests">
        {summary.interests.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {summary.interests.map((interest) => (
              <Badge
                key={interest}
                variant="secondary"
                className="rounded-full capitalize"
              >
                {interest}
              </Badge>
            ))}
          </div>
        ) : (
          <Unknown />
        )}
      </Row>

      <div className="mt-auto pt-4">
        <Button
          size="lg"
          disabled={!summary.readyToGenerate || drafting}
          onClick={onDraft}
          className="w-full rounded-full text-base font-bold"
        >
          {drafting ? "Drafting your itinerary…" : "Draft my itinerary"}
        </Button>
        {!summary.readyToGenerate && (
          <p className="mt-2 text-center text-xs text-on-surface-variant/60">
            I need at least destination, dates, and travelers first
          </p>
        )}
      </div>
    </aside>
  );
}

function MiniField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-warm px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold capitalize">{value}</div>
    </div>
  );
}

// Mobile-only collapsible "Trip so far" card, pinned at the top of the intake
// chat. Desktop keeps the full TripSummaryPanel aside (hidden below lg).
export function MobileTripSummary({ summary }: { summary: IntakeSummary }) {
  const [open, setOpen] = useState(false);
  const filled = filledCount(summary);
  const dates =
    summary.startDate && summary.endDate
      ? `${summary.startDate} → ${summary.endDate}`
      : null;
  const preview = summary.destination
    ? [summary.destination, dates].filter(Boolean).join(" · ")
    : "Tell me about your trip";

  return (
    <div className="shrink-0 border-b border-surface-variant bg-white lg:hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-xs font-bold uppercase tracking-widest text-on-surface-variant/60">
            Trip so far
          </span>
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
            {filled} of 6
          </span>
          {!open && (
            <span className="truncate text-sm text-on-surface-variant/80">
              {preview}
            </span>
          )}
        </div>
        <span
          aria-hidden
          className={cn(
            "shrink-0 text-on-surface-variant/70 transition-transform",
            open && "rotate-180",
          )}
        >
          ⌄
        </span>
      </button>

      {open && (
        <div className="space-y-2 px-4 pb-4">
          <div className="grid grid-cols-2 gap-2">
            <MiniField
              label="Destination"
              value={summary.destination ?? "—"}
            />
            <MiniField label="Dates" value={dates ?? "—"} />
            <MiniField
              label="Travelers"
              value={summary.travelers ? String(summary.travelers) : "—"}
            />
            <MiniField label="Budget" value={summary.budget ?? "—"} />
            <MiniField label="Pace" value={summary.pace ?? "—"} />
            <MiniField
              label="Interests"
              value={
                summary.interests.length > 0
                  ? `${summary.interests.length} chosen`
                  : "—"
              }
            />
          </div>
          {summary.interests.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {summary.interests.map((interest) => (
                <Badge
                  key={interest}
                  variant="secondary"
                  className="rounded-full capitalize"
                >
                  {interest}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
