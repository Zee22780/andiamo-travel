// Client-safe trip tree used by the canvas. Shaped by /trips/[id]/page.tsx
// from the Drizzle query result.

export type CanvasStop = {
  id: string;
  type: "activity" | "meal" | "lodging" | "transit";
  title: string;
  description: string | null;
  startTime: string | null; // HH:MM
  durationMin: number | null;
  sortOrder: number;
  verification: "unverified" | "verified" | "flagged";
  costEstimate: number | null;
  mustDo: boolean;
};

export type CanvasDay = {
  id: string;
  date: string;
  notes: string | null;
  stops: CanvasStop[];
};

export type CanvasLeg = {
  id: string;
  destination: string;
  startDate: string;
  endDate: string;
  lodging: string | null;
  days: CanvasDay[];
};

export type CanvasTrip = {
  id: string;
  name: string;
  region: string | null; // country/region for geocoding disambiguation
  legs: CanvasLeg[];
};
