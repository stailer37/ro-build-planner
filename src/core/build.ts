// The build a user edits in the planner, and the status effects derived from buffs.

import { ELEMENTS, type Element, type StatName } from "./data.ts";

export type Stats = Record<StatName, number>;

/** Weapon types a Knight / Lord Knight can equip, using rAthena's names. */
export const WEAPON_TYPES = [
  "Fist",
  "Dagger",
  "1hSword",
  "2hSword",
  "1hSpear",
  "2hSpear",
  "1hAxe",
  "2hAxe",
  "Mace",
] as const;
export type WeaponType = (typeof WEAPON_TYPES)[number];

export interface Weapon {
  type: WeaponType;
  /** Weapon ATK from the item description; ignored for Fist. */
  atk: number;
  /** Weapon level 1..4; ignored for Fist. */
  level: number;
  /** Refine +0..+10; ignored for Fist. */
  refine: number;
  element: Element;
}

export const MAX_WEAPON_LEVEL = 4;
export const MAX_REFINE = 10;

export interface Build {
  baseLevel: number;
  jobLevel: number;
  /** Base stats the player allocated (1..99), without job bonuses or buffs. */
  stats: Stats;
  /** Learned skill levels by rAthena skill name; absent means 0. */
  skills: Partial<Record<string, number>>;
  weapon: Weapon;
  /** Mounted on a Peco Peco (requires KN_RIDING). */
  riding: boolean;
}

/**
 * Status changes active on the character, already resolved from buffs.
 * Fields mirror the rAthena status change values used in status.cpp.
 */
export interface StatusEffects {
  statBonus: Partial<Stats>;
  /** Largest "quicken" style aspd_rate reduction, per mille (Two-Hand Quicken = 300). */
  quickenRate: number;
  /** SC_BERSERK: flat 300 aspd_rate reduction. */
  berserk: boolean;
  /** ASPD potion aspd_rate reduction, per mille (val2 of SC_ASPDPOTION*). */
  potionRate: number;
}

export const NO_EFFECTS: StatusEffects = { statBonus: {}, quickenRate: 0, berserk: false, potionRate: 0 };

export const BASE_STAT_MIN = 1;
/** max_trans_parameter in conf/battle/player.conf. */
export const BASE_STAT_MAX = 99;
export const MAX_BASE_LEVEL = 99;
export const MAX_JOB_LEVEL = 70;

export function skillLevel(build: Build, skill: string): number {
  return build.skills[skill] ?? 0;
}

export type WeaponIssue =
  | { code: "weaponAtkOutOfRange"; min: 0 }
  | { code: "weaponLevelOutOfRange"; min: 1; max: number }
  | { code: "refineOutOfRange"; min: 0; max: number }
  | { code: "unknownElement" };

export function validateWeapon(weapon: Weapon): WeaponIssue[] {
  const issues: WeaponIssue[] = [];
  const intIn = (v: number, min: number, max: number) => Number.isInteger(v) && v >= min && v <= max;
  if (!ELEMENTS.includes(weapon.element)) issues.push({ code: "unknownElement" });
  if (weapon.type === "Fist") return issues;
  if (!intIn(weapon.atk, 0, Number.MAX_SAFE_INTEGER)) issues.push({ code: "weaponAtkOutOfRange", min: 0 });
  if (!intIn(weapon.level, 1, MAX_WEAPON_LEVEL)) {
    issues.push({ code: "weaponLevelOutOfRange", min: 1, max: MAX_WEAPON_LEVEL });
  }
  if (!intIn(weapon.refine, 0, MAX_REFINE)) issues.push({ code: "refineOutOfRange", min: 0, max: MAX_REFINE });
  return issues;
}
