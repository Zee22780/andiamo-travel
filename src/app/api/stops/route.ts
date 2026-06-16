import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addStop } from "@/db/trips";

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
  const created = await addStop({
    ...parsed.data,
    source: "user",
    verification: "verified",
  });
  return NextResponse.json({ stop: created });
}
