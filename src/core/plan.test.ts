import { describe, expect, it } from "vitest";
import { DEFAULT_BUFFS, DEFAULT_BUILD, DEFAULT_TARGET_SIZE } from "../ui/defaults.ts";
import { NO_BUFFS } from "./buffs.ts";
import { calculate, validatePlan } from "./plan.ts";
import { presetTarget } from "./target.ts";
import { build } from "./testing.ts";

describe("validatePlan", () => {
  it("accepts the planner defaults", () => {
    expect(validatePlan(DEFAULT_BUILD, DEFAULT_BUFFS)).toEqual([]);
  });

  it("requires Peco Peco Riding to ride", () => {
    expect(validatePlan(build({ riding: true }), NO_BUFFS)).toEqual([{ code: "ridingNotLearned" }]);
  });
});

describe("calculate", () => {
  it("returns the issues instead of a result for an invalid build", () => {
    const outcome = calculate(build({ baseLevel: 0 }), NO_BUFFS, presetTarget("Small"));
    expect(outcome.ok).toBe(false);
  });

  it("applies buffs to stats and DPS", () => {
    const t = presetTarget(DEFAULT_TARGET_SIZE);
    const buffed = calculate(DEFAULT_BUILD, DEFAULT_BUFFS, t);
    const bare = calculate(DEFAULT_BUILD, NO_BUFFS, t);
    if (!buffed.ok || !bare.ok) throw new Error("defaults should be valid");
    expect(buffed.result.stats.Agi - bare.result.stats.Agi).toBe(12);
    expect(buffed.result.dps).toBeGreaterThan(bare.result.dps);
  });

  it("lists learned offensive skills, marking those the weapon cannot use", () => {
    const outcome = calculate(DEFAULT_BUILD, DEFAULT_BUFFS, presetTarget(DEFAULT_TARGET_SIZE));
    if (!outcome.ok) throw new Error("defaults should be valid");
    const bySkill = Object.fromEntries(outcome.result.skills.map((s) => [s.skill, s]));
    expect(Object.keys(bySkill)).toEqual(["SM_BASH", "SM_MAGNUM", "KN_PIERCE", "KN_BOWLINGBASH"]);
    expect(bySkill.KN_PIERCE).toMatchObject({ available: false, reason: "weapon" });
    expect(bySkill.KN_BOWLINGBASH).toMatchObject({ available: true });
  });
});
