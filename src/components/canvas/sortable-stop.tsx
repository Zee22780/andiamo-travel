"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { StopCard } from "./stop-card";
import { CanvasStop } from "./types";

export function SortableStop({
  stop,
  index,
  onEdit,
  onDelete,
  checking,
}: {
  stop: CanvasStop;
  index?: number;
  onEdit?: () => void;
  onDelete?: () => void;
  checking?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stop.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "opacity-40" : undefined}
      {...attributes}
      {...listeners}
    >
      <StopCard
        stop={stop}
        index={index}
        onEdit={onEdit}
        onDelete={onDelete}
        checking={checking}
      />
    </div>
  );
}
