"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CanvasStop } from "./types";

const TYPES: CanvasStop["type"][] = ["activity", "meal", "lodging", "transit"];

export type StopDraft = {
  title: string;
  type: CanvasStop["type"];
  startTime: string;
  durationMin: string;
};

export function StopEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<StopDraft>;
  onSave: (draft: StopDraft) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<StopDraft>({
    title: initial?.title ?? "",
    type: initial?.type ?? "activity",
    startTime: initial?.startTime ?? "",
    durationMin: initial?.durationMin ?? "",
  });

  return (
    <form
      className="space-y-2 rounded-xl border border-primary/30 bg-white p-3 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (draft.title.trim()) onSave(draft);
      }}
    >
      <Input
        autoFocus
        value={draft.title}
        onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        placeholder="Stop title"
        className="h-8 text-sm"
      />
      <div className="flex gap-2">
        <select
          value={draft.type}
          onChange={(e) =>
            setDraft({ ...draft, type: e.target.value as CanvasStop["type"] })
          }
          className="h-8 flex-1 rounded-md border border-surface-variant bg-white px-2 text-xs capitalize"
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <Input
          value={draft.startTime}
          onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
          placeholder="HH:MM"
          className="h-8 w-20 text-xs"
        />
        <Input
          value={draft.durationMin}
          onChange={(e) =>
            setDraft({ ...draft, durationMin: e.target.value })
          }
          placeholder="min"
          inputMode="numeric"
          className="h-8 w-16 text-xs"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-7 text-xs"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={!draft.title.trim()}
          className="h-7 text-xs"
        >
          Save
        </Button>
      </div>
    </form>
  );
}
