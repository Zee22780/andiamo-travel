"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { IntakeSummary } from "./types";

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

export function TripSummaryPanel({ summary }: { summary: IntakeSummary }) {
  return (
    <aside className="flex w-[45%] flex-col gap-6 overflow-y-auto bg-white p-8">
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
          disabled={!summary.readyToGenerate}
          className="w-full rounded-full text-base font-bold"
        >
          Draft my itinerary
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
