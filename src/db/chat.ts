import { asc, eq } from "drizzle-orm";
import { db } from "./client";
import { chatMessages } from "./schema";

export async function loadChat(tripId: string) {
  return db.query.chatMessages.findMany({
    where: eq(chatMessages.tripId, tripId),
    orderBy: asc(chatMessages.createdAt),
  });
}

export async function saveChatMessage(
  tripId: string,
  role: "user" | "assistant",
  content: string,
) {
  if (!content.trim()) return;
  await db.insert(chatMessages).values({ tripId, role, content });
}

// Seed a trip's conversation with an existing transcript (e.g. the intake
// interview that produced the trip) so it shows up as the copilot's history.
// Explicit, strictly-increasing createdAt values keep the original order —
// a single batch insert would otherwise collide on identical defaultNow()
// timestamps, and loadChat orders by createdAt.
export async function seedChatMessages(
  tripId: string,
  messages: { role: "user" | "assistant"; content: string }[],
) {
  const base = Date.now();
  const rows = messages
    .filter((m) => m.content.trim())
    .map((m, i) => ({
      tripId,
      role: m.role,
      content: m.content,
      createdAt: new Date(base + i),
    }));
  if (rows.length) await db.insert(chatMessages).values(rows);
}
