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
