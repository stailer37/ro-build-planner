import { describe, expect, it } from "vitest";
import { PLANNER_SKILLS, availableSkillPoints, setSkillLevel, spentSkillPoints, validateSkills } from "./skills.ts";
import { build } from "./testing.ts";

describe("PLANNER_SKILLS", () => {
  it("covers the Lord Knight line without wedding skills", () => {
    const names = PLANNER_SKILLS.map((s) => s.name);
    expect(names).toContain("NV_BASIC");
    expect(names).toContain("KN_TWOHANDQUICKEN");
    expect(names).toContain("LK_SPIRALPIERCE");
    expect(names).not.toContain("WE_CALLBABY");
  });

  it("puts Knight skills in the Lord Knight point pool", () => {
    expect(PLANNER_SKILLS.find((s) => s.name === "KN_PIERCE")?.stage).toBe("lordKnight");
  });
});

describe("skill points", () => {
  it("gives one point per job level after the first", () => {
    expect(availableSkillPoints("novice", 70)).toBe(9);
    expect(availableSkillPoints("swordman", 70)).toBe(49);
    expect(availableSkillPoints("lordKnight", 70)).toBe(69);
  });

  it("does not charge quest skills", () => {
    expect(spentSkillPoints({ SM_SWORD: 10, SM_FATALBLOW: 1, SM_AUTOBERSERK: 1 }, "swordman")).toBe(10);
  });
});

describe("validateSkills", () => {
  it("accepts a consistent build", () => {
    const skills = { NV_BASIC: 9, SM_SWORD: 1, SM_TWOHAND: 10, KN_TWOHANDQUICKEN: 10 };
    expect(validateSkills(build({ skills }))).toEqual([]);
  });

  it("reports missing prerequisites, bad levels and overspent pools", () => {
    const skills = { SM_TWOHAND: 11, KN_SPEARMASTERY: 10, KN_PIERCE: 10, KN_SPEARSTAB: 10, KN_BRANDISHSPEAR: 10 };
    expect(validateSkills(build({ jobLevel: 30, skills }))).toEqual([
      { code: "skillLevelOutOfRange", skill: "SM_TWOHAND", max: 10 },
      { code: "missingPrerequisite", skill: "SM_TWOHAND", requires: "SM_SWORD", level: 1 },
      { code: "missingPrerequisite", skill: "KN_BRANDISHSPEAR", requires: "KN_RIDING", level: 1 },
      { code: "notEnoughSkillPoints", stage: "lordKnight", spent: 40, available: 29 },
    ]);
  });
});

describe("setSkillLevel", () => {
  it("raises prerequisites recursively", () => {
    expect(setSkillLevel({}, "KN_ONEHAND", 1)).toEqual({
      KN_ONEHAND: 1,
      KN_TWOHANDQUICKEN: 10,
      SM_TWOHAND: 1,
      SM_SWORD: 1,
    });
  });

  it("keeps prerequisites that are already high enough", () => {
    expect(setSkillLevel({ SM_SWORD: 10 }, "SM_TWOHAND", 5)).toEqual({ SM_SWORD: 10, SM_TWOHAND: 5 });
  });

  it("drops skills that lose their requirements, transitively", () => {
    const learned = setSkillLevel({}, "KN_ONEHAND", 1);
    expect(setSkillLevel(learned, "SM_SWORD", 0)).toEqual({});
    expect(setSkillLevel(learned, "KN_TWOHANDQUICKEN", 9)).toEqual({ KN_TWOHANDQUICKEN: 9, SM_TWOHAND: 1, SM_SWORD: 1 });
  });

  it("clamps the level to the skill range", () => {
    expect(setSkillLevel({}, "SM_SWORD", 99)).toEqual({ SM_SWORD: 10 });
  });
});
