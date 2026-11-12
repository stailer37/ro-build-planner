import { describe, expect, it } from "vitest";
import { layoutJobTree } from "./skillTreeLayout.ts";

const position = (job: Parameters<typeof layoutJobTree>[0]) =>
  Object.fromEntries(layoutJobTree(job).nodes.map((n) => [n.skill.name, [n.col, n.row]]));

describe("layoutJobTree", () => {
  it("puts each skill one column after its deepest prerequisite in the same job", () => {
    const p = position("Knight");
    expect(p.KN_SPEARMASTERY).toEqual([0, 0]);
    expect(p.KN_PIERCE).toEqual([1, 0]);
    expect(p.KN_SPEARSTAB).toEqual([2, 0]);
    // Needs Peco Peco Riding (column 0) and Spear Stab (column 2).
    expect(p.KN_BRANDISHSPEAR?.[0]).toBe(3);
  });

  it("keeps a skill on its first prerequisite's row when free, else the next free row", () => {
    const p = position("Knight");
    expect(p.KN_TWOHANDQUICKEN).toEqual([0, 1]);
    expect(p.KN_BOWLINGBASH).toEqual([1, 1]);
    expect(p.KN_ONEHAND).toEqual([1, 2]);
  });

  it("draws edges only inside the job and lists earlier-job prerequisites on the node", () => {
    const layout = layoutJobTree("Knight");
    expect(layout.edges).toContainEqual({ from: "KN_PIERCE", to: "KN_SPEARSTAB", level: 5 });
    expect(layout.edges.some((e) => e.from.startsWith("SM_"))).toBe(false);
    const thq = layout.nodes.find((n) => n.skill.name === "KN_TWOHANDQUICKEN");
    expect(thq?.external).toEqual([{ name: "SM_TWOHAND", level: 1 }]);
  });

  it("fills free cells with skills that have no link inside the job", () => {
    const p = position("Lord_Knight");
    expect(p.LK_HEADCRUSH).toEqual([0, 0]);
    expect(p.LK_JOINTBEAT).toEqual([1, 0]);
    expect(p.LK_AURABLADE).toEqual([2, 0]);
    expect(p.LK_BERSERK).toEqual([2, 1]);
  });

  it("never stacks two skills in the same cell", () => {
    for (const job of ["Novice_High", "Swordman_High", "Knight", "Lord_Knight"] as const) {
      const cells = layoutJobTree(job).nodes.map((n) => `${n.col}:${n.row}`);
      expect(new Set(cells).size).toBe(cells.length);
    }
  });
});
