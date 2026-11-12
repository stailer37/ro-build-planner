import { describe, expect, it } from "vitest";
import { validatePlan } from "../core/plan.ts";
import { GUIDE_BUILDS, applyGuideBuild, findGuideBuild, matchingGuideBuild } from "./guide.ts";
import { DEFAULT_INPUTS } from "./share.ts";

describe("guide builds", () => {
  it("has one build per style and goal", () => {
    expect(GUIDE_BUILDS).toHaveLength(6);
    for (const style of ["spear", "bowlingBash", "crit"] as const)
      for (const goal of ["mvp", "leveling"] as const) expect(findGuideBuild(style, goal)).toBeDefined();
  });

  it.each(GUIDE_BUILDS.map((g) => [g.id, g] as const))("%s loads as a valid plan", (_, g) => {
    const { build, buffs } = applyGuideBuild(DEFAULT_INPUTS, g);
    expect(validatePlan(build, buffs)).toEqual([]);
  });

  it("recognizes a loaded build until it changes", () => {
    const g = findGuideBuild("spear", "mvp")!;
    const { build } = applyGuideBuild(DEFAULT_INPUTS, g);
    expect(matchingGuideBuild(build)).toBe(g);
    expect(matchingGuideBuild({ ...build, stats: { ...build.stats, Luk: 2 } })).toBeUndefined();
    expect(matchingGuideBuild(DEFAULT_INPUTS.build)).toBeUndefined();
  });

  it("keeps the weapon numbers and party buffs, aims MVP builds at the large target", () => {
    const g = findGuideBuild("bowlingBash", "mvp")!;
    const next = applyGuideBuild(DEFAULT_INPUTS, g);
    expect(next.build.weapon).toEqual({ ...DEFAULT_INPUTS.build.weapon, type: "2hSword" });
    expect(next.buffs.blessing).toBe(DEFAULT_INPUTS.buffs.blessing);
    expect(next.buffs.twoHandQuicken).toBe(true);
    expect(next.size).toBe("Large");
  });
});
