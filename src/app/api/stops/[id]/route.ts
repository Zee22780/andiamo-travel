import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { stops } from "@/db/schema";
import { verifyStopById } from "@/db/verify";

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

// PATCH /api/stops/:id — edit one stop, attributed to the traveler. A retitle
// means it's a different place: the old resolution is dropped and the stop is
// re-verified inline so the response carries the new place's status/coords;
// other edits leave the resolution — including a flag — untouched.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = UpdateSchema.safeParse(await req.json());
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const retitled = parsed.data.title !== undefined;
  const [updated] = await db
    .update(stops)
    .set({
      ...parsed.data,
      source: "user",
      ...(retitled
        ? {
            verification: "unverified" as const,
            placeId: null,
            lat: null,
            lng: null,
            verifiedAt: null,
          }
        : {}),
    })
    .where(eq(stops.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (retitled && (updated.type === "activity" || updated.type === "meal")) {
    try {
      await verifyStopById(id);
      const fresh = await db.query.stops.findFirst({
        where: eq(stops.id, id),
      });
      return NextResponse.json({ stop: fresh ?? updated });
    } catch {
      // Best-effort: an unresolved retitle just stays unresolved.
    }
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
