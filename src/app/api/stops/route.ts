import { and, asc, eq, gte, sql } from "drizzle-orm";
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

// POST { dayId, title, ... } — manual / accepted stop add. A timed stop slots
// into the day in start-time order (matching the AI's time-ordered stops); an
// untimed stop appends. User-authored stops are marked verified (no AI claim).
export async function POST(req: NextRequest) {
  const parsed = CreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const { dayId, type, title, startTime, durationMin } = parsed.data;

  const existing = await db
    .select({ sortOrder: stops.sortOrder, startTime: stops.startTime })
    .from(stops)
    .where(eq(stops.dayId, dayId))
    .orderBy(asc(stops.sortOrder));

  // Insert before the first stop scheduled later in the day; otherwise append.
  const maxOrder = existing.length
    ? Math.max(...existing.map((s) => s.sortOrder)) + 1
    : 0;
  const laterTimed = startTime
    ? existing.find(
        (s) => s.startTime != null && s.startTime.slice(0, 5) > startTime,
      )
    : undefined;
  const insertAt = laterTimed ? laterTimed.sortOrder : maxOrder;

  const created = await db.transaction(async (tx) => {
    if (laterTimed) {
      await tx
        .update(stops)
        .set({ sortOrder: sql`${stops.sortOrder} + 1` })
        .where(and(eq(stops.dayId, dayId), gte(stops.sortOrder, insertAt)));
    }
    const [row] = await tx
      .insert(stops)
      .values({
        dayId,
        type,
        title,
        startTime: startTime ?? null,
        durationMin: durationMin ?? null,
        sortOrder: insertAt,
        source: "user",
        verification: "verified",
      })
      .returning();
    return row;
  });

  return NextResponse.json({ stop: created });
}
