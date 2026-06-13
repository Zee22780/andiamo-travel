import type Anthropic from "@anthropic-ai/sdk";

// Frozen copilot system prompt — cache_control on the last block. Per-trip
// state is fetched via the get_trip_state tool, never inlined here.
export const COPILOT_SYSTEM: Anthropic.TextBlockParam[] = [
  {
    type: "text",
    text: `You are Andiamo's planning copilot, embedded in a trip itinerary canvas. The traveler asks for targeted changes to an existing trip; you make them surgically.

Core rules:
- ALWAYS call get_trip_state first to see the current legs/days/stops before acting. Day and stop ids come from there.
- Editing, moving, or removing EXISTING stops: use update_stops. These apply immediately — the user asked for them and they're reversible.
- Proposing NEW stops to add: use suggest_stops. These are NOT applied; the user reviews and accepts them. Never invent a way to add stops directly.
- Make the SMALLEST change that satisfies the request. "Make day 9 calmer" = remove or shorten a couple of stops on that day, not a full rebuild. Don't touch days the user didn't mention.
- When asked to fix or trim an OVERPACKED day, use update_stops to remove or shorten the least essential stops on that day only, until it fits the stated pace. Never delete or shorten a must-do. Prefer cutting low-value filler over signature experiences.
- Respect geography and timing: keep each day's stops in a sensible order and time sequence after edits.
- After acting, briefly tell the user what you changed (or proposed), in one or two warm, concrete sentences. Don't list every field.

Grounding (do not guess about real-world facts):
- Before claiming a place exists, is open/closed, or is real, call verify_place. It returns whether the place resolves and its business_status (operational / temporarily or permanently closed). If a place can't be verified, say so honestly ("I couldn't confirm this one") rather than asserting it's open.
- Before claiming how long it takes to get between two places, call get_travel_time. Don't invent walking or driving times.
- You still can't see live prices or exact opening hours — don't state those as fact.`,
    cache_control: { type: "ephemeral" },
  },
];

export const COPILOT_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_trip_state",
    description:
      "Return the current trip as legs → days → stops, with all ids, titles, times, durations and types. Call this first.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "update_stops",
    description:
      "Apply edits to EXISTING stops: edit fields, move to another day/position, or delete. Applies immediately.",
    input_schema: {
      type: "object",
      properties: {
        operations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["edit", "move", "delete"] },
              stopId: { type: "string" },
              // edit
              title: { type: "string" },
              startTime: { type: "string", description: "HH:MM or empty" },
              durationMin: { type: "integer" },
              stopType: {
                type: "string",
                enum: ["activity", "meal", "lodging", "transit"],
              },
              mustDo: { type: "boolean" },
              // move
              dayId: { type: "string" },
              sortOrder: { type: "integer" },
            },
            required: ["type", "stopId"],
          },
        },
      },
      required: ["operations"],
      additionalProperties: false,
    },
  },
  {
    name: "suggest_stops",
    description:
      "Propose NEW stops for the user to review and accept. Does NOT modify the trip.",
    input_schema: {
      type: "object",
      properties: {
        suggestions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              dayId: { type: "string" },
              title: { type: "string" },
              stopType: {
                type: "string",
                enum: ["activity", "meal", "lodging", "transit"],
              },
              startTime: { type: "string" },
              durationMin: { type: "integer" },
              reason: { type: "string" },
            },
            required: ["dayId", "title", "stopType"],
          },
        },
      },
      required: ["suggestions"],
      additionalProperties: false,
    },
  },
  {
    name: "verify_place",
    description:
      "Check whether a place is real and currently operating, via Google Places. Returns found, the resolved name, business_status (OPERATIONAL / CLOSED_TEMPORARILY / CLOSED_PERMANENTLY), and coordinates. Call before asserting a place exists or is open.",
    input_schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description:
            "Place name to verify, e.g. 'Livraria Lello'. The trip's city is added automatically.",
        },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "get_travel_time",
    description:
      "Real travel time between two places via Google Routes. Returns duration in minutes, distance, and mode (walk/drive, chosen by distance). Call before stating how long it takes to get between stops.",
    input_schema: {
      type: "object",
      properties: {
        origin: { type: "string", description: "Start place name." },
        destination: { type: "string", description: "End place name." },
      },
      required: ["origin", "destination"],
      additionalProperties: false,
    },
  },
];
