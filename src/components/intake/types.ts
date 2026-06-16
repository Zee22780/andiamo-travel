export type MustInclude = {
  title: string;
  when: string | null;
  fixed: boolean;
};

export type IntakeSummary = {
  destination: string | null;
  route: string[];
  startDate: string | null;
  endDate: string | null;
  travelers: number | null;
  budget: "shoestring" | "mid" | "comfortable" | "luxury" | null;
  pace: "relaxed" | "balanced" | "packed" | null;
  interests: string[];
  mustInclude: MustInclude[];
  readyToGenerate: boolean;
  chips: string[];
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export const EMPTY_SUMMARY: IntakeSummary = {
  destination: null,
  route: [],
  startDate: null,
  endDate: null,
  travelers: null,
  budget: null,
  pace: null,
  interests: [],
  mustInclude: [],
  readyToGenerate: false,
  chips: [],
};
