import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { stops } from "@/db/schema";

const BatchSchema = z.object({
  moves: z
    .array(
      z.object({
        stopId: z.string().uuid(),
        dayId: z.string().uuid(),
        sortOrder: z.number().int().nonnegative(),
      }),
    )
    .min(1)
    .max(200),
});

// PATCH { moves: [{stopId, dayId, sortOrder}] }
// One mutation path for drag-and-drop now and AI update_stops later.
export async function PATCH(req: NextRequest) {
  const parsed = BatchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  await db.transaction(async (tx) => {
    for (const move of parsed.data.moves) {
      await tx
        .update(stops)
        .set({ dayId: move.dayId, sortOrder: move.sortOrder })
        .where(eq(stops.id, move.stopId));
    }
  });

  return NextResponse.json({ ok: true, updated: parsed.data.moves.length });
}
