import { describe, expect, it } from "vitest";
import { aspdRate, attackSpeed, baseAmotion } from "./aspd.ts";
import { NO_EFFECTS, type Build, type Stats } from "./build.ts";

const build = (o: Partial<Build> = {}): Build => ({
  baseLevel: 99,
  jobLevel: 70,
  stats: { Str: 1, Agi: 1, Vit: 1, Int: 1, Dex: 1, Luk: 1 },
  skills: {},
  weapon: { type: "2hSword" },
  riding: false,
  ...o,
});
const stats = (agi: number, dex: number): Stats => ({ Str: 1, Agi: agi, Vit: 1, Int: 1, Dex: dex, Luk: 1 });

describe("baseAmotion", () => {
  it("reduces the Lord Knight weapon delay by (4*AGI + DEX) per mille, truncated", () => {
    // 2hSword base 550: 550 - floor(550 * 446 / 1000) = 550 - 245
    expect(baseAmotion(build(), stats(99, 50))).toBe(305);
    // 1hSpear base 600: 600 - floor(600 * 126 / 1000) = 600 - 75
    expect(baseAmotion(build({ weapon: { type: "1hSpear" } }), stats(30, 6))).toBe(525);
  });

  it("is the raw weapon delay with 0 AGI and DEX", () => {
    expect(baseAmotion(build({ weapon: { type: "Fist" } }), stats(0, 0))).toBe(400);
  });
});

describe("aspdRate", () => {
  it("penalizes riding by 50% minus 10% per Cavalier Mastery level", () => {
    expect(aspdRate(build({ riding: true }), NO_EFFECTS)).toBe(1500);
    expect(aspdRate(build({ riding: true, skills: { KN_CAVALIERMASTERY: 3 } }), NO_EFFECTS)).toBe(1200);
    expect(aspdRate(build({ riding: true, skills: { KN_CAVALIERMASTERY: 5 } }), NO_EFFECTS)).toBe(1000);
  });

  it("stacks quicken, berserk and potion reductions", () => {
    expect(aspdRate(build(), { ...NO_EFFECTS, quickenRate: 300, berserk: true, potionRate: 200 })).toBe(200);
  });
});

describe("attackSpeed", () => {
  it("converts amotion to client ASPD and attacks per second", () => {
    const s = attackSpeed(build(), stats(99, 50), NO_EFFECTS);
    expect(s).toEqual({ amotion: 305, adelay: 610, aspd: 169.5, attacksPerSecond: 1000 / 610 });
  });

  it("applies percentage modifiers after the stat reduction, truncated", () => {
    // 305 * 700 / 1000 = 213.5 -> 213
    const s = attackSpeed(build(), stats(99, 50), { ...NO_EFFECTS, quickenRate: 300 });
    expect(s.amotion).toBe(213);
    expect(s.aspd).toBe(178.7);
  });

  it("caps at ASPD 190", () => {
    const s = attackSpeed(build(), stats(99, 99), { ...NO_EFFECTS, quickenRate: 300, berserk: true, potionRate: 200 });
    expect(s).toMatchObject({ amotion: 100, adelay: 200, aspd: 190, attacksPerSecond: 5 });
  });
});
