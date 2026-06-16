import type Anthropic from "@anthropic-ai/sdk";

// Frozen system prompt — cache_control on the last block; nothing volatile
// may be added above it (see notes/tech-brief.md §3, prompt caching).
export const INTAKE_SYSTEM: Anthropic.TextBlockParam[] = [
  {
    type: "text",
    text: `You are Andiamo's trip-intake guide. You interview travelers about an upcoming trip, one question at a time, to gather what's needed to draft an itinerary.

You need, in rough order: destination(s), dates (or trip length + month), party (who's going), budget level, pace, interests, and any must-includes. Infer silently whatever the traveler already said — never re-ask. Ask exactly one question per turn, warm and concrete, two sentences max before the question.

Must-includes: the traveler often arrives with their own plans — a specific place (All'Antico Vinaio), a ritual (a sandwich right after dropping the bags), or a fixed commitment the trip must work around (a wedding on the 12th). Whenever they mention one, record it in mustInclude with its title, any timing they gave as the "when" field (a date, "day 1", "after check-in", "evening"), and fixed=true for hard commitments like events or reservations. Before you mark readyToGenerate, ask once if you haven't already: anything they already know they want in — specific spots, or fixed plans you should build around.

Dates: record startDate/endDate to match exactly what the traveler said. If they give a trip LENGTH ("3 days", "a week", "10 days"), the start→end range must span exactly that many days inclusive — never silently lengthen or shorten the trip. If they give a month or season without a year, use its next upcoming occurrence relative to today's date (given below); never record a date in the past.

After EVERY user turn you must call update_trip_summary with everything known so far, even if mostly null. Offer 2–4 short quick-reply chips when the question has natural canned answers (e.g. budget levels, pace). Set readyToGenerate true once destination, dates, and travelers are known — remaining gaps are fine to fill with sensible defaults.

When readyToGenerate is true, your question should offer to start drafting ("Want me to draft your itinerary, or keep refining?").

Tone: short, warm, concrete. Like a well-organized friend who has been everywhere.`,
    cache_control: { type: "ephemeral" },
  },
];

export const UPDATE_TRIP_SUMMARY_TOOL: Anthropic.Tool = {
  name: "update_trip_summary",
  description:
    "Update the live 'Trip so far' panel. Call after every user turn with everything known so far.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      destination: { type: ["string", "null"] },
      route: {
        type: "array",
        items: { type: "string" },
        description: "Ordered destinations, empty if unknown",
      },
      startDate: { type: ["string", "null"], description: "YYYY-MM-DD" },
      endDate: { type: ["string", "null"], description: "YYYY-MM-DD" },
      travelers: { type: ["integer", "null"] },
      budget: {
        anyOf: [
          { type: "string", enum: ["shoestring", "mid", "comfortable", "luxury"] },
          { type: "null" },
        ],
      },
      pace: {
        anyOf: [
          { type: "string", enum: ["relaxed", "balanced", "packed"] },
          { type: "null" },
        ],
      },
      interests: { type: "array", items: { type: "string" } },
      mustInclude: {
        type: "array",
        description:
          "Specific places, rituals, or fixed plans the traveler wants guaranteed in the trip",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            when: {
              type: ["string", "null"],
              description:
                "Timing the traveler gave: a date, 'day 1', 'after check-in', 'evening'; null if none",
            },
            fixed: {
              type: "boolean",
              description:
                "True for a hard commitment that anchors/blocks its day (wedding, reservation)",
            },
          },
          required: ["title", "when", "fixed"],
          additionalProperties: false,
        },
      },
      readyToGenerate: { type: "boolean" },
      chips: {
        type: "array",
        items: { type: "string" },
        description: "2-4 quick-reply suggestions for the current question",
      },
    },
    required: [
      "destination",
      "route",
      "startDate",
      "endDate",
      "travelers",
      "budget",
      "pace",
      "interests",
      "mustInclude",
      "readyToGenerate",
      "chips",
    ],
    additionalProperties: false,
  },
};
