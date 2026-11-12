// Buffs the user toggles in the planner, resolved into rAthena status change values
// (status_change_start val1..val4 and their use in status.cpp / battle.cpp, pre-renewal).

import { NO_EFFECTS, skillLevel, type Build, type Stats, type StatusEffects } from "./build.ts";

export const ASPD_POTIONS = ["none", "concentration", "awakening", "berserk"] as const;
export type AspdPotion = (typeof ASPD_POTIONS)[number];

/** aspd_rate reduction of SC_ASPDPOTION0..2: val2 = 50 * (2 + n). */
const POTION_RATE: Record<AspdPotion, number> = { none: 0, concentration: 100, awakening: 150, berserk: 200 };

export interface Buffs {
  // Own skills, cast at the learned level.
  twoHandQuicken: boolean;
  concentration: boolean;
  auraBlade: boolean;
  berserk: boolean;
  // Party buffs by skill level; 0 means not active.
  blessing: number;
  increaseAgi: number;
  impositio: number;
  gloria: boolean;
  aspdPotion: AspdPotion;
}

export const NO_BUFFS: Buffs = {
  twoHandQuicken: false,
  concentration: false,
  auraBlade: false,
  berserk: false,
  blessing: 0,
  increaseAgi: 0,
  impositio: 0,
  gloria: false,
  aspdPotion: "none",
};

export const MAX_BLESSING = 10;
export const MAX_INCREASE_AGI = 10;
export const MAX_IMPOSITIO = 5;

/** Own buffs and the skill that grants each. */
export const SELF_BUFF_SKILLS = {
  twoHandQuicken: "KN_TWOHANDQUICKEN",
  concentration: "LK_CONCENTRATION",
  auraBlade: "LK_AURABLADE",
  berserk: "LK_BERSERK",
} as const;
export type SelfBuff = keyof typeof SELF_BUFF_SKILLS;

export type BuffIssue =
  | { code: "buffSkillNotLearned"; buff: SelfBuff; skill: string }
  | { code: "buffWeaponMismatch"; buff: SelfBuff }
  | { code: "buffLevelOutOfRange"; buff: "blessing" | "increaseAgi" | "impositio"; min: 0; max: number };

export function validateBuffs(build: Build, buffs: Buffs): BuffIssue[] {
  const issues: BuffIssue[] = [];
  for (const [buff, skill] of Object.entries(SELF_BUFF_SKILLS) as [SelfBuff, string][]) {
    if (buffs[buff] && skillLevel(build, skill) === 0) issues.push({ code: "buffSkillNotLearned", buff, skill });
  }
  // KN_TWOHANDQUICKEN needs a two-handed sword; LK_AURABLADE any weapon (skill_db RequiredWeapons).
  if (buffs.twoHandQuicken && build.weapon.type !== "2hSword") {
    issues.push({ code: "buffWeaponMismatch", buff: "twoHandQuicken" });
  }
  if (buffs.auraBlade && build.weapon.type === "Fist") issues.push({ code: "buffWeaponMismatch", buff: "auraBlade" });
  const levels = [
    ["blessing", MAX_BLESSING],
    ["increaseAgi", MAX_INCREASE_AGI],
    ["impositio", MAX_IMPOSITIO],
  ] as const;
  for (const [buff, max] of levels) {
    const v = buffs[buff];
    if (!Number.isInteger(v) || v < 0 || v > max) issues.push({ code: "buffLevelOutOfRange", buff, min: 0, max });
  }
  return issues;
}

/** Status effects of the active buffs. Expects buffs that pass validateBuffs. */
export function resolveEffects(build: Build, buffs: Buffs): StatusEffects {
  const fx: StatusEffects = { ...NO_EFFECTS, statBonus: {} };
  const stat: Partial<Stats> = fx.statBonus;

  // SC_TWOHANDQUICKEN: val2 = 300 at any level (the crit/HIT bonus is renewal only).
  if (buffs.twoHandQuicken) fx.quickenRate = 300;
  // SC_CONCENTRATION: val2 = 5 * lv ATK%, val3 = 10 * lv HIT.
  if (buffs.concentration) {
    const lv = skillLevel(build, SELF_BUFF_SKILLS.concentration);
    fx.atkPercent = 5 * lv;
    fx.hit = 10 * lv;
  }
  // SC_AURABLADE: 20 * lv after DEF.
  if (buffs.auraBlade) fx.auraBladeAtk = 20 * skillLevel(build, SELF_BUFF_SKILLS.auraBlade);
  fx.berserk = buffs.berserk;

  // SC_BLESSING on a player: val2 = lv to STR, INT and DEX (the HIT bonus is renewal only).
  if (buffs.blessing > 0) stat.Str = stat.Int = stat.Dex = buffs.blessing;
  // SC_INCREASEAGI: val2 = 2 + lv.
  if (buffs.increaseAgi > 0) stat.Agi = 2 + buffs.increaseAgi;
  if (buffs.gloria) stat.Luk = 30;
  // SC_IMPOSITIO: val2 = 5 * lv weapon ATK.
  fx.watk = 5 * buffs.impositio;
  fx.potionRate = POTION_RATE[buffs.aspdPotion];
  return fx;
}
