import { describe, expect, it } from "vitest";
import { NO_EFFECTS, type Build, type Stats } from "./build.ts";
import { critChance, hitChance, masteryBonus, normalAttack, normalAttackDamage } from "./damage.ts";
import { mean } from "./dist.ts";
import { presetTarget, type Target } from "./target.ts";
import { build, stats, target } from "./testing.ts";

describe("normalAttackDamage, deterministic case", () => {
  // DEX high enough that the minimum roll equals weapon ATK, no over-refine and no VIT DEF.
  const b = build({
    weapon: { type: "1hSword", atk: 100, level: 1, refine: 0, element: "Fire" },
    skills: { SM_SWORD: 10 },
  });
  const s = stats({ Str: 50, Dex: 100 });
  const t = target({ size: "Small", def: 50, element: "Water", elementLevel: 1 });

  it("applies size fix, status ATK, hard DEF, mastery and element in order", () => {
    // batk = 50 + 5^2 + 100/5 + 1/5 = 95
    // 100 * 75% (1hSword vs Small) = 75; + 95 = 170; * (100 - 50)% = 85
    // + Sword Mastery 40 = 125; Fire vs Water 1 = 50% -> 62
    expect([...normalAttackDamage(b, s, t, false)]).toEqual([[62, 1]]);
  });

  it("ignores DEF on critical hits", () => {
    // 75 + 95 = 170; + 40 = 210; * 50% = 105
    expect([...normalAttackDamage(b, s, t, true)]).toEqual([[105, 1]]);
  });

});

describe("normalAttackDamage, random terms", () => {
  const b = build({
    weapon: { type: "2hSword", atk: 160, level: 4, refine: 7, element: "Neutral" },
    skills: { SM_TWOHAND: 10 },
  });
  const s = stats({ Str: 100, Dex: 50, Luk: 10 }); // batk = 100 + 100 + 10 + 2 = 212
  const t = target({ def: 30, vit: 40 }); // VIT DEF = 40 + rnd(0..3)

  // Straightforward re-implementation by enumeration, to cross-check the distribution plumbing.
  function bruteForceMean(): number {
    let total = 0;
    let n = 0;
    for (let roll = 80; roll <= 159; roll++) {
      for (let over = 1; over <= 39; over++) {
        for (let vit = 40; vit <= 43; vit++) {
          const base = Math.trunc((roll * 75) / 100) + 212 + over;
          const afterDef = Math.trunc((base * 70) / 100) - vit;
          total += Math.max(Math.max(afterDef + 49, 1) + 40, 1);
          n++;
        }
      }
    }
    return total / n;
  }

  it("rolls weapon ATK from DEX * (80 + 20 * weapon level)% up to ATK - 1", () => {
    const d = normalAttackDamage(b, s, t, false);
    // min: 80 * 75% = 60 + 212 + 1 = 273 -> 191 - 43 = 148 + 49 + 40 = 237
    // max: 159 * 75% = 119 + 212 + 39 = 370 -> 259 - 40 = 219 + 49 + 40 = 308
    expect(Math.min(...d.keys())).toBe(237);
    expect(Math.max(...d.keys())).toBe(308);
    expect(mean(d)).toBeCloseTo(bruteForceMean(), 9);
  });

  it("uses max weapon ATK plus the over-refine roll on criticals", () => {
    const d = normalAttackDamage(b, s, t, true);
    // 160 * 75% = 120 + 212 + (1..39) + 49 + 40
    expect(Math.min(...d.keys())).toBe(422);
    expect(Math.max(...d.keys())).toBe(460);
    expect(mean(d)).toBeCloseTo(441);
  });
});

describe("masteryBonus", () => {
  it.each<[Build["weapon"]["type"], Partial<Build>, number]>([
    ["Dagger", { skills: { SM_SWORD: 10 } }, 40],
    ["2hSword", { skills: { SM_SWORD: 10, SM_TWOHAND: 5 } }, 20],
    ["1hSpear", { skills: { KN_SPEARMASTERY: 10 } }, 40],
    ["2hSpear", { skills: { KN_SPEARMASTERY: 10 }, riding: true }, 50],
    ["1hAxe", { skills: { SM_SWORD: 10 } }, 0],
  ])("%s", (type, o, expected) => {
    const b = build(o);
    expect(masteryBonus({ ...b, weapon: { ...b.weapon, type } })).toBe(expected);
  });
});

describe("hit and critical chance", () => {
  const s: Stats = stats({ Dex: 50, Luk: 30 });

  it("uses 80 + HIT - (target level + AGI), clamped to 5..100", () => {
    expect(hitChance(s, 99, target({ level: 80, agi: 60 }))).toBeCloseTo(0.89); // 80 + 149 - 140
    expect(hitChance(s, 99, target({ level: 99, agi: 200 }))).toBeCloseTo(0.05);
    expect(hitChance(s, 99, target({ level: 1, agi: 1 }))).toBe(1);
  });


  it("uses CRI - 2 * target LUK in tenths of a percent", () => {
    // CRI = 10 + 30 * 10 / 3 = 110
    expect(critChance(s, 99, target({ luk: 5 }))).toBeCloseTo(0.1);
    expect(critChance(s, 99, target({ luk: 80 }))).toBe(0);
  });
});

describe("normalAttack", () => {
  it("combines crit, hit, damage and attack speed into DPS", () => {
    const b = build({
      stats: stats({ Str: 90, Agi: 80, Dex: 40, Luk: 20 }),
      weapon: { type: "2hSword", atk: 160, level: 4, refine: 7, element: "Neutral" },
      skills: { SM_TWOHAND: 10 },
    });
    const t: Target = presetTarget("Medium");
    const r = normalAttack(b, NO_EFFECTS, t);
    const expected = r.critChance * r.critical.mean + (1 - r.critChance) * r.hitChance * r.normal.mean;
    expect(r.meanPerAttack).toBeCloseTo(expected);
    expect(r.dps).toBeCloseTo(expected * r.attackSpeed.attacksPerSecond);
    expect(r.normal.mean).toBeLessThan(r.critical.mean);
  });
});
