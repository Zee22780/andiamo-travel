import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { stops } from "@/db/schema";

const UpdateSchema = z
  .object({
    type: z.enum(["activity", "meal", "lodging", "transit"]),
    title: z.string().min(1).max(200),
    description: z.string().max(1000).nullable(),
    startTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable(),
    durationMin: z.number().int().positive().nullable(),
    costEstimate: z.number().int().nonnegative().nullable(),
    mustDo: z.boolean(),
  })
  .partial();

// PATCH /api/stops/:id — edit one stop. A user edit clears any prior AI
// verification claim back to user-authored/verified.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = UpdateSchema.safeParse(await req.json());
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const [updated] = await db
    .update(stops)
    .set({ ...parsed.data, source: "user", verification: "verified" })
    .where(eq(stops.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ stop: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [deleted] = await db
    .delete(stops)
    .where(eq(stops.id, id))
    .returning({ id: stops.id });

  if (!deleted) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
