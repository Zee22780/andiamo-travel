import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __waypointDb: ReturnType<typeof makeDb> | undefined;
}

function makeDb() {
  const sql = postgres(process.env.DATABASE_URL!, {
    prepare: false, // required behind Supabase pooler
    max: 5,
  });
  return drizzle(sql, { schema });
}

// Reuse across hot reloads / route invocations
export const db = globalThis.__waypointDb ?? (globalThis.__waypointDb = makeDb());

// Placeholder identity until Supabase Auth lands (M0 leftover): all trips
// belong to a single demo profile, upserted on first use.
export const DEMO_PROFILE_ID = "00000000-0000-4000-8000-000000000001";

export async function ensureDemoProfile() {
  await db
    .insert(schema.profiles)
    .values({ id: DEMO_PROFILE_ID, displayName: "Demo traveler" })
    .onConflictDoNothing();
}
