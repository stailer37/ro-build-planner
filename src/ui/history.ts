// Undo/redo over the planner inputs.

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  /** When the present was last changed by an edit, to merge quick edits (typing "85") into one step. */
  editedAt: number;
}

/** Edits closer than this to the previous one join its undo step. */
export const MERGE_WINDOW_MS = 600;
const MAX_STEPS = 100;

export const initHistory = <T>(present: T): History<T> => ({ past: [], present, future: [], editedAt: -Infinity });

export function edit<T>(h: History<T>, next: T, now: number): History<T> {
  if (next === h.present) return h;
  const merge = now - h.editedAt < MERGE_WINDOW_MS && h.past.length > 0;
  return {
    past: merge ? h.past : [...h.past, h.present].slice(-MAX_STEPS),
    present: next,
    future: [],
    editedAt: now,
  };
}

export function undo<T>(h: History<T>): History<T> {
  const prev = h.past.at(-1);
  if (prev === undefined) return h;
  return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future], editedAt: -Infinity };
}

export function redo<T>(h: History<T>): History<T> {
  const [next, ...rest] = h.future;
  if (next === undefined) return h;
  return { past: [...h.past, h.present], present: next, future: rest, editedAt: -Infinity };
}
