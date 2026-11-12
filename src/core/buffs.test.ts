import { describe, expect, it } from "vitest";
import { NO_EFFECTS } from "./build.ts";
import { NO_BUFFS, resolveEffects, validateBuffs, type Buffs } from "./buffs.ts";
import { build } from "./testing.ts";

const allSkills = { KN_TWOHANDQUICKEN: 10, LK_CONCENTRATION: 5, LK_AURABLADE: 3, LK_BERSERK: 1 };
const buffs = (o: Partial<Buffs> = {}): Buffs => ({ ...NO_BUFFS, ...o });

describe("resolveEffects", () => {
  it("has no effect without buffs", () => {
    expect(resolveEffects(build({ skills: allSkills }), NO_BUFFS)).toEqual(NO_EFFECTS);
  });

  it("uses the learned level for own skills", () => {
    const fx = resolveEffects(
      build({ skills: allSkills }),
      buffs({ twoHandQuicken: true, concentration: true, auraBlade: true, berserk: true }),
    );
    expect(fx).toEqual({
      ...NO_EFFECTS,
      quickenRate: 300,
      berserk: true,
      atkPercent: 25,
      hit: 50,
      auraBladeAtk: 60,
    });
  });

  it("applies party buffs and ASPD potions by level", () => {
    const fx = resolveEffects(
      build(),
      buffs({ blessing: 10, increaseAgi: 10, impositio: 5, gloria: true, aspdPotion: "awakening" }),
    );
    expect(fx.statBonus).toEqual({ Str: 10, Int: 10, Dex: 10, Agi: 12, Luk: 30 });
    expect(fx.watk).toBe(25);
    expect(fx.potionRate).toBe(150);
  });
});

describe("validateBuffs", () => {
  it("accepts own buffs that are learned and fit the weapon", () => {
    const all = buffs({ twoHandQuicken: true, concentration: true, auraBlade: true, berserk: true, blessing: 10 });
    expect(validateBuffs(build({ skills: allSkills }), all)).toEqual([]);
  });

  it("rejects own buffs that are not learned", () => {
    expect(validateBuffs(build({ skills: { LK_CONCENTRATION: 1 } }), buffs({ concentration: true, berserk: true }))).toEqual([
      { code: "buffSkillNotLearned", buff: "berserk", skill: "LK_BERSERK" },
    ]);
  });

  it("requires a two-handed sword for Two-Hand Quicken and a weapon for Aura Blade", () => {
    const b = build({ skills: allSkills });
    const spear = { ...b, weapon: { ...b.weapon, type: "2hSpear" as const } };
    const fist = { ...b, weapon: { ...b.weapon, type: "Fist" as const } };
    expect(validateBuffs(spear, buffs({ twoHandQuicken: true, auraBlade: true })).map((i) => i.code)).toEqual([
      "buffWeaponMismatch",
    ]);
    expect(validateBuffs(fist, buffs({ auraBlade: true }))).toEqual([{ code: "buffWeaponMismatch", buff: "auraBlade" }]);
  });

  it("rejects party buff levels out of range", () => {
    expect(validateBuffs(build(), buffs({ blessing: 11, impositio: -1 })).map((i) => i.code)).toEqual([
      "buffLevelOutOfRange",
      "buffLevelOutOfRange",
    ]);
  });
});
