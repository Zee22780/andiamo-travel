import { eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { stops } from "@/db/schema";

const CreateSchema = z.object({
  dayId: z.string().uuid(),
  type: z.enum(["activity", "meal", "lodging", "transit"]).default("activity"),
  title: z.string().min(1).max(200),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable()
    .optional(),
  durationMin: z.number().int().positive().nullable().optional(),
});

// POST { dayId, title, ... } — manual stop add. Appends to the day; user-
// authored stops are marked verified (no AI claim to check).
export async function POST(req: NextRequest) {
  const parsed = CreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { dayId, type, title, startTime, durationMin } = parsed.data;

  const [{ next }] = await db
    .select({
      next: sql<number>`coalesce(max(${stops.sortOrder}) + 1, 0)`,
    })
    .from(stops)
    .where(eq(stops.dayId, dayId));

  const [created] = await db
    .insert(stops)
    .values({
      dayId,
      type,
      title,
      startTime: startTime ?? null,
      durationMin: durationMin ?? null,
      sortOrder: next,
      source: "user",
      verification: "verified",
    })
    .returning();

  return NextResponse.json({ stop: created });
}
