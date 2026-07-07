import {
  boolean,
  date,
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Mirrors notes/tech-brief.md §2. Supabase auth.users is the identity source;
// profiles carries app-facing fields keyed by the auth user id.

export const memberRole = pgEnum("member_role", ["owner", "editor", "viewer"]);
export const stopType = pgEnum("stop_type", [
  "activity",
  "meal",
  "lodging",
  "transit",
]);
export const verificationStatus = pgEnum("verification_status", [
  "unverified",
  "verified",
  "flagged",
]);
export const stopSource = pgEnum("stop_source", ["ai", "user"]);
export const chatRole = pgEnum("chat_role", ["user", "assistant"]);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // = auth.users.id
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const trips = pgTable("trips", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // pace/budget/interests captured at intake; consumed by generation prompts
  preferences: jsonb("preferences"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const tripMembers = pgTable("trip_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id),
  role: memberRole("role").notNull().default("owner"),
});

export const legs = pgTable("legs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  destination: text("destination").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  lodging: text("lodging"),
  sortOrder: integer("sort_order").notNull(),
});

export const days = pgTable("days", {
  id: uuid("id").primaryKey().defaultRandom(),
  legId: uuid("leg_id")
    .notNull()
    .references(() => legs.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  notes: text("notes"),
});

export const stops = pgTable("stops", {
  id: uuid("id").primaryKey().defaultRandom(),
  dayId: uuid("day_id")
    .notNull()
    .references(() => days.id, { onDelete: "cascade" }),
  type: stopType("type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  startTime: time("start_time"),
  durationMin: integer("duration_min"),
  sortOrder: integer("sort_order").notNull(),
  // verification lives on the stop — the badge renders on every card
  verification: verificationStatus("verification")
    .notNull()
    .default("unverified"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  source: stopSource("source").notNull().default("ai"),
  placeId: text("place_id"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  costEstimate: integer("cost_estimate"),
  mustDo: boolean("must_do").notNull().default(false),
});

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" }),
  role: chatRole("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Places API result cache — keyed by the normalized search query (title +
// destination). Caches the durable fields (existence, place_id, coords,
// business_status) with a TTL so the verify pass and the verify_place copilot
// tool don't re-bill Places for the same lookup. Volatile data (open-now) is
// fetched live, never cached. See notes/tech-brief.md §4.
// Destination place library for reference-based generation. Rows are promoted
// from Places-verified AI stops (see db/verify.ts); generation injects a
// compact per-destination catalog and the model schedules these by slug
// instead of writing each stop out, so library stops arrive pre-verified.
export const poiLibrary = pgTable(
  "poi_library",
  {
    slug: text("slug").primaryKey(), // prompt-facing id: "<city>/<title>"
    destination: text("destination").notNull(), // normalized leg destination
    type: stopType("type").notNull(), // activity | meal only
    title: text("title").notNull(),
    description: text("description"),
    typicalDurationMin: integer("typical_duration_min"),
    costEstimate: integer("cost_estimate"),
    placeId: text("place_id").notNull(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    timesUsed: integer("times_used").notNull().default(0),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("poi_library_destination_place_id").on(t.destination, t.placeId),
  ],
);

export const placesCache = pgTable("places_cache", {
  query: text("query").primaryKey(),
  found: boolean("found").notNull(),
  placeId: text("place_id"),
  displayName: text("display_name"),
  businessStatus: text("business_status"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
