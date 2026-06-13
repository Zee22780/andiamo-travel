import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Supabase connection string; set when Supabase project exists
    url: process.env.DATABASE_URL!,
  },
});
