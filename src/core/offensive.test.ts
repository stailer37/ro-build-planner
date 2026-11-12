import { describe, expect, it } from "vitest";
import { NO_EFFECTS, type Build, type StatusEffects } from "./build.ts";
import { getSkillData } from "./data.ts";
import { hitChance } from "./damage.ts";
import { castTime, skillAttack, skillCycle, skillDamagePercent, spiralPierceBase, type SkillAttackStats } from "./offensive.ts";
import { build, stats, target } from "./testing.ts";

// DEX high enough that the weapon roll is fixed at ATK: 2hSpear 100 ATK, batk = 50 + 25 + 40 = 115.
// Allocated stats bypass the stat point check, which skillAttack does not run.
const spearman = (o: Partial<Build> = {}): Build =>
  build({
    stats: stats({ Str: 35, Dex: 191 }), // + Lord Knight job 70 bonus: STR 50, DEX 200
    weapon: { type: "2hSpear", atk: 100, level: 1, refine: 0, weight: 250, element: "Neutral" },
    ...o,
  });

function use(b: Build, skill: string, level: number, t = target(), fx: StatusEffects = NO_EFFECTS): SkillAttackStats {
  const r = skillAttack({ ...b, skills: { ...b.skills, [skill]: level } }, fx, t, skill);
  if (!r.available) throw new Error(`${skill} unavailable: ${r.reason}`);
  return r;
}

describe("skill damage", () => {
  // 2hSpear vs Medium: 100 * 75% = 75; + 115 = 190 before the skill ratio.
  it("applies the skill ratio to the weapon attack", () => {
    expect(use(spearman(), "SM_BASH", 10).damage).toEqual({ min: 760, max: 760, mean: 760 }); // 400%
    expect(use(spearman(), "KN_BOWLINGBASH", 10).damage.mean).toBe(950); // 500%
    expect(use(spearman(), "LK_JOINTBEAT", 10).damage.mean).toBe(285); // 100 + 100 - 50 = 150%
  });

  it("hits Pierce once per size step", () => {
    expect(use(spearman(), "KN_PIERCE", 10, target({ size: "Small" })).hits).toBe(1);
    expect(use(spearman(), "KN_PIERCE", 10).damage.mean).toBe(380 * 2);
    // Large: 100 * 100% + 115 = 215; * 200% = 430; 3 hits
    expect(use(spearman(), "KN_PIERCE", 10, target({ size: "Large" })).damage.mean).toBe(1290);
  });

  it("uses the skill element for Magnum Break", () => {
    // 190 * 300% = 570; Fire vs Earth 1 = 150%
    expect(use(spearman(), "SM_MAGNUM", 10, target({ element: "Earth" })).damage.mean).toBe(855);
  });

  it("adds Brandish Spear's area bonuses for the nearest target", () => {
    // ratio 300: 200 + 150 + 75 + 37 = 462 -> 562%; 190 * 562% = 1067
    expect(use(spearman({ riding: true, skills: { KN_RIDING: 1 } }), "KN_BRANDISHSPEAR", 10).damage.mean).toBe(1067);
  });

  it("computes Spiral Pierce from weapon weight, ignoring DEF, masteries, ATK% and Aura Blade", () => {
    // 250 weight -> 200; + 250% = 700; + 5^2 = 725; Small 125% -> 906
    expect(spiralPierceBase(250, 50, 5, target())).toBe(725);
    expect(spiralPierceBase(250, 50, 5, target({ size: "Small" }))).toBe(906);
    const fx = { ...NO_EFFECTS, atkPercent: 25, auraBladeAtk: 100 };
    const b = spearman({ skills: { KN_SPEARMASTERY: 10 } });
    expect(use(b, "LK_SPIRALPIERCE", 5, target({ def: 50, vit: 60 }), fx).damage.mean).toBe(725 * 5);
  });

  it("still applies the refine bonus to Spiral Pierce", () => {
    const b = spearman();
    const refined = { ...b, weapon: { ...b.weapon, level: 4, refine: 4 } }; // +7 ATK per refine at level 4
    expect(use(refined, "LK_SPIRALPIERCE", 5).damage.mean).toBe((725 + 28) * 5);
  });
});

describe("skillDamagePercent", () => {
  it("returns the skill ratio for weapon-scaled skills only", () => {
    expect(skillDamagePercent("SM_BASH", 10)).toBe(400);
    expect(skillDamagePercent("LK_JOINTBEAT", 1)).toBe(60);
    expect(skillDamagePercent("LK_SPIRALPIERCE", 5)).toBeUndefined();
    expect(skillDamagePercent("SM_SWORD", 10)).toBeUndefined();
  });
});

describe("availability", () => {
  it("requires the skill's weapon type", () => {
    const b = build({ skills: { KN_PIERCE: 10 } });
    expect(skillAttack(b, NO_EFFECTS, target(), "KN_PIERCE")).toEqual({ available: false, skill: "KN_PIERCE", level: 10, reason: "weapon" });
  });

  it("blocks every skill under Frenzy", () => {
    const b = build({ skills: { SM_BASH: 10 } });
    expect(skillAttack(b, { ...NO_EFFECTS, berserk: true }, target(), "SM_BASH")).toMatchObject({ available: false, reason: "berserk" });
  });

  it("requires riding for Brandish Spear", () => {
    const b = spearman({ skills: { KN_BRANDISHSPEAR: 10 } });
    expect(skillAttack(b, NO_EFFECTS, target(), "KN_BRANDISHSPEAR")).toMatchObject({ available: false, reason: "riding" });
  });
});

describe("timing", () => {
  it("reduces cast time linearly with DEX down to 0 at 150", () => {
    const bb = getSkillData("KN_BOWLINGBASH");
    expect(castTime(bb, 10, 59)).toBe(424); // 700 * 91 / 150
    expect(castTime(bb, 10, 150)).toBe(0);
  });

  it("waits for the longer of cast + after-cast delay and amotion + 100 ms", () => {
    expect(skillCycle(424, 0, 157)).toBe(424);
    expect(skillCycle(0, 0, 157)).toBe(257);
    expect(skillCycle(300, 1200, 157)).toBe(1500);
  });

  it("derives DPS and SP per second from the cycle", () => {
    const r = use(spearman(), "LK_SPIRALPIERCE", 5);
    expect(r.cycle).toBe(2000); // 1000 cast at DEX 200 -> 0, + 2000 delay
    expect(r.dps).toBeCloseTo((r.hitChance * r.damage.mean * 1000) / 2000);
    expect(r.spPerSecond).toBeCloseTo(15);
  });
});

describe("skill hit bonus", () => {
  it("raises the hit rate by a percentage of itself before the cap", () => {
    const s = stats({ Dex: 50 }); // HIT 149
    const t = target({ level: 80, agi: 100 }); // FLEE 180 -> rate 49
    expect(hitChance(s, 99, NO_EFFECTS, t)).toBeCloseTo(0.49);
    expect(hitChance(s, 99, NO_EFFECTS, t, 50)).toBeCloseTo(0.73); // 49 + 24
  });
});
