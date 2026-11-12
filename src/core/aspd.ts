// Attack speed (rAthena pre-renewal, status_base_amotion_pc + status_calc_aspd_rate).
// amotion is the attack motion in ms; the delay between normal attacks (adelay) is twice that.

import { skillLevel, type Build, type Stats, type StatusEffects } from "./build.ts";
import { getJob } from "./data.ts";

/** max_aspd: 190 in conf/battle/player.conf, as the minimum amotion. */
export const MIN_AMOTION = 100;
/** MIN_ASPD / AMOTION_DIVIDER_PC in status.hpp. */
export const MAX_AMOTION = 4000;
const AMOTION_ZERO_ASPD = 2000;
const AMOTION_DIVIDER_PC = 2;

/** Weapon delay reduced by AGI and DEX, before percentage modifiers. */
export function baseAmotion(build: Build, stats: Stats): number {
  const weaponDelay = getJob("Lord_Knight").baseAspd[build.weapon.type];
  if (weaponDelay === undefined) throw new Error(`Lord Knight cannot use ${build.weapon.type}`);
  return weaponDelay - Math.floor((weaponDelay * (4 * stats.Agi + stats.Dex)) / 1000);
}

/** aspd_rate in per mille (1000 = no change); lower is faster. */
export function aspdRate(build: Build, effects: StatusEffects): number {
  let rate = 1000;
  // Passive: riding penalty, offset by Cavalier Mastery (status_calc_pc).
  if (build.riding) rate += 500 - 100 * skillLevel(build, "KN_CAVALIERMASTERY");
  // Only the strongest quicken-type buff applies.
  rate -= effects.quickenRate;
  if (effects.berserk) rate -= 300;
  rate -= effects.potionRate;
  return Math.max(rate, 0);
}

export interface AttackSpeed {
  amotion: number;
  /** Delay between normal attacks, in ms. */
  adelay: number;
  /** ASPD as shown by the client. */
  aspd: number;
  attacksPerSecond: number;
}

export function attackSpeed(build: Build, stats: Stats, effects: StatusEffects): AttackSpeed {
  const raw = Math.floor((baseAmotion(build, stats) * aspdRate(build, effects)) / 1000);
  const amotion = Math.min(Math.max(raw, MIN_AMOTION), MAX_AMOTION);
  const adelay = AMOTION_DIVIDER_PC * amotion;
  return {
    amotion,
    adelay,
    aspd: (AMOTION_ZERO_ASPD - amotion) / 10,
    attacksPerSecond: 1000 / adelay,
  };
}
