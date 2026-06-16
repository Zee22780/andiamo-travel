import { z } from "zod";

// Generation target for /api/trips/:id/generate. Mirrors src/db/schema.ts —
// legs → days → stops — so parsed output inserts without reshaping.

export const StopSchema = z.object({
  type: z.enum(["activity", "meal", "lodging", "transit"]),
  title: z.string(),
  description: z.string().nullable(),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .describe("24h HH:MM local time"),
  durationMin: z.number().int().positive(),
  costEstimate: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .describe("Estimated cost per person in USD, null if free/unknown"),
  mustDo: z.boolean(),
  userAdded: z
    .boolean()
    .describe(
      "True if this stop came from a traveler-specified must-include (their own place, ritual, or fixed commitment), not the AI's own picks",
    ),
});

export const DaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().nullable().describe("Day theme or pacing note"),
  stops: z.array(StopSchema),
});

export const LegSchema = z.object({
  destination: z.string().describe("City or region, e.g. 'Kyoto'"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lodging: z
    .string()
    .nullable()
    .describe("Suggested neighborhood/area to stay, not a specific hotel"),
  days: z.array(DaySchema),
});

export const ItinerarySchema = z.object({
  tripName: z.string(),
  legs: z.array(LegSchema),
});

export type Itinerary = z.infer<typeof ItinerarySchema>;

// Live "Trip so far" panel state, updated each intake turn.
export const TripSummarySchema = z.object({
  destination: z.string().nullable(),
  route: z.array(z.string()).describe("Ordered destinations, empty if unknown"),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  travelers: z.number().int().positive().nullable(),
  budget: z.enum(["shoestring", "mid", "comfortable", "luxury"]).nullable(),
  pace: z.enum(["relaxed", "balanced", "packed"]).nullable(),
  interests: z.array(z.string()),
  mustInclude: z
    .array(
      z.object({
        title: z.string(),
        when: z
          .string()
          .nullable()
          .describe(
            "Timing the traveler gave, e.g. a date, 'day 1', 'after check-in', 'evening'; null if none",
          ),
        fixed: z
          .boolean()
          .describe(
            "True for a hard commitment that anchors/blocks its day (wedding, reservation)",
          ),
      }),
    )
    .describe(
      "Specific places, rituals, or fixed plans the traveler wants guaranteed in the trip",
    ),
  readyToGenerate: z
    .boolean()
    .describe("True once destination, dates, and travelers are known"),
});

export type TripSummary = z.infer<typeof TripSummarySchema>;
