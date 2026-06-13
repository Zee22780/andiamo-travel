"use client";

import {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useCallback, useRef, useState } from "react";
import { CanvasDay, CanvasStop } from "./types";

export type DayStops = Record<string, CanvasStop[]>; // dayId -> ordered stops

export function buildDayStops(days: CanvasDay[]): DayStops {
  return Object.fromEntries(days.map((d) => [d.id, d.stops]));
}

function findDay(dayStops: DayStops, stopId: string): string | null {
  for (const [dayId, list] of Object.entries(dayStops)) {
    if (list.some((s) => s.id === stopId)) return dayId;
  }
  return null;
}

export function useCanvasDnd(initial: DayStops) {
  const [dayStops, setDayStops] = useState<DayStops>(initial);
  const [activeStop, setActiveStop] = useState<CanvasStop | null>(null);
  const beforeDrag = useRef<DayStops | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const onDragStart = useCallback(
    (event: DragStartEvent) => {
      beforeDrag.current = dayStops;
      const dayId = findDay(dayStops, String(event.active.id));
      const stop = dayId
        ? dayStops[dayId].find((s) => s.id === event.active.id)
        : null;
      setActiveStop(stop ?? null);
    },
    [dayStops],
  );

  // Move the card between containers live while hovering
  const onDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    setDayStops((prev) => {
      const fromDay = findDay(prev, activeId);
      // over a stop -> its day; over empty column -> the day id itself
      const toDay = findDay(prev, overId) ?? (prev[overId] ? overId : null);
      if (!fromDay || !toDay || fromDay === toDay) return prev;

      const moving = prev[fromDay].find((s) => s.id === activeId)!;
      const overIndex = prev[toDay].findIndex((s) => s.id === overId);
      const insertAt = overIndex >= 0 ? overIndex : prev[toDay].length;

      return {
        ...prev,
        [fromDay]: prev[fromDay].filter((s) => s.id !== activeId),
        [toDay]: [
          ...prev[toDay].slice(0, insertAt),
          moving,
          ...prev[toDay].slice(insertAt),
        ],
      };
    });
  }, []);

  const onDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveStop(null);
      const { active, over } = event;
      const snapshot = beforeDrag.current;
      beforeDrag.current = null;
      if (!over) return;

      let next: DayStops | null = null;
      setDayStops((prev) => {
        const dayId = findDay(prev, String(active.id));
        if (!dayId) return prev;
        const oldIndex = prev[dayId].findIndex((s) => s.id === active.id);
        const overIndex = prev[dayId].findIndex((s) => s.id === over.id);
        const reordered =
          overIndex >= 0 && oldIndex !== overIndex
            ? { ...prev, [dayId]: arrayMove(prev[dayId], oldIndex, overIndex) }
            : prev;
        next = reordered;
        return reordered;
      });

      // Persist the full ordering of affected days (simple + idempotent)
      await new Promise((r) => setTimeout(r, 0)); // let state settle
      const state = next ?? dayStops;
      const moves = Object.entries(state).flatMap(([dayId, list]) =>
        list.map((stop, i) => ({ stopId: stop.id, dayId, sortOrder: i })),
      );
      try {
        const res = await fetch("/api/stops/batch", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ moves }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch {
        if (snapshot) setDayStops(snapshot); // revert optimistic update
      }
    },
    [dayStops],
  );

  return { dayStops, activeStop, sensors, onDragStart, onDragOver, onDragEnd };
}
