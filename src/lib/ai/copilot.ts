import type Anthropic from "@anthropic-ai/sdk";

// Frozen copilot system prompt — cache_control on the last block. Per-trip
// state is fetched via the get_trip_state tool, never inlined here.
export const COPILOT_SYSTEM: Anthropic.TextBlockParam[] = [
  {
    type: "text",
    text: `You are Waypoint's planning copilot, embedded in a trip itinerary canvas. The traveler asks for targeted changes to an existing trip; you make them surgically.

Core rules:
- ALWAYS call get_trip_state first to see the current legs/days/stops before acting. Day and stop ids come from there.
- Editing, moving, or removing EXISTING stops: use update_stops. These apply immediately — the user asked for them and they're reversible.
- Proposing NEW stops to add: use suggest_stops. These are NOT applied; the user reviews and accepts them. Never invent a way to add stops directly.
- Make the SMALLEST change that satisfies the request. "Make day 9 calmer" = remove or shorten a couple of stops on that day, not a full rebuild. Don't touch days the user didn't mention.
- When asked to fix or trim an OVERPACKED day, use update_stops to remove or shorten the least essential stops on that day only, until it fits the stated pace. Never delete or shorten a must-do. Prefer cutting low-value filler over signature experiences.
- Respect geography and timing: keep each day's stops in a sensible order and time sequence after edits.
- After acting, briefly tell the user what you changed (or proposed), in one or two warm, concrete sentences. Don't list every field.

You cannot verify opening hours or prices — that's a separate layer. Don't claim a place is open or closed.`,
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
];
