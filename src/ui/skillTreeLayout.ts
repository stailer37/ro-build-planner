// Grid layout of one job's skill tree: linked skills get columns by prerequisite depth
// inside the job and rows that keep them level with their first prerequisite; skills
// with no link inside the job then fill the free cells, row by row.

import type { JobName } from "../core/data.ts";
import { PLANNER_SKILLS, type PlannerSkill } from "../core/skills.ts";

export interface TreeNode {
  skill: PlannerSkill;
  col: number;
  row: number;
  /** Prerequisites from earlier jobs, shown on the node instead of as edges. */
  external: { name: string; level: number }[];
}

export interface TreeEdge {
  from: string;
  to: string;
  level: number;
}

export interface TreeLayout {
  nodes: TreeNode[];
  edges: TreeEdge[];
  cols: number;
  rows: number;
}

/** Minimum grid width, so unlinked skills spread sideways instead of stacking. */
const MIN_COLS = 4;

export function layoutJobTree(job: JobName): TreeLayout {
  const skills = PLANNER_SKILLS.filter((s) => s.job === job);
  const inJob = new Map(skills.map((s) => [s.name, s]));
  const linkedNames = new Set(
    skills.flatMap((s) => s.requires.filter((r) => inJob.has(r.name)).flatMap((r) => [r.name, s.name])),
  );
  const linked = skills.filter((s) => linkedNames.has(s.name));

  const depthMemo = new Map<string, number>();
  const depth = (s: PlannerSkill): number => {
    const known = depthMemo.get(s.name);
    if (known !== undefined) return known;
    const parents = s.requires.flatMap((r) => inJob.get(r.name) ?? []);
    const d = parents.length ? 1 + Math.max(...parents.map(depth)) : 0;
    depthMemo.set(s.name, d);
    return d;
  };

  const rowOf = new Map<string, number>();
  const colOf = new Map<string, number>();
  const linkedCols = linked.length ? Math.max(...linked.map(depth)) + 1 : 0;
  for (let col = 0; col < linkedCols; col++) {
    const taken = new Set<number>();
    const desired = (s: PlannerSkill) => {
      const parentRows = s.requires.flatMap((r) => rowOf.get(r.name) ?? []);
      return parentRows.length ? Math.min(...parentRows) : 0;
    };
    const column = linked.filter((s) => depth(s) === col);
    // Stable sort keeps skill_tree order among skills that want the same row.
    for (const s of [...column].sort((a, b) => desired(a) - desired(b))) {
      let row = desired(s);
      while (taken.has(row)) row++;
      taken.add(row);
      rowOf.set(s.name, row);
      colOf.set(s.name, col);
    }
  }

  const width = Math.max(linkedCols, MIN_COLS);
  const occupied = new Set(linked.map((s) => `${colOf.get(s.name)}:${rowOf.get(s.name)}`));
  let cell = 0;
  for (const s of skills.filter((k) => !linkedNames.has(k.name))) {
    while (occupied.has(`${cell % width}:${Math.trunc(cell / width)}`)) cell++;
    colOf.set(s.name, cell % width);
    rowOf.set(s.name, Math.trunc(cell / width));
    cell++;
  }

  const nodes = skills.map((s) => ({
    skill: s,
    col: colOf.get(s.name) ?? 0,
    row: rowOf.get(s.name) ?? 0,
    external: s.requires.filter((r) => !inJob.has(r.name)),
  }));
  const edges = skills.flatMap((s) =>
    s.requires.filter((r) => inJob.has(r.name)).map((r) => ({ from: r.name, to: s.name, level: r.level })),
  );
  return {
    nodes,
    edges,
    cols: nodes.length ? Math.max(...nodes.map((n) => n.col)) + 1 : 0,
    rows: nodes.length ? Math.max(...nodes.map((n) => n.row)) + 1 : 0,
  };
}
