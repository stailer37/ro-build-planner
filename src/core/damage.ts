// Normal attack damage of a player against a monster (rAthena pre-renewal,
// battle_calc_weapon_attack with skill_id 0 and a single right-hand weapon).

import { attackSpeed, type AttackSpeed } from "./aspd.ts";
import { skillLevel, type Build, type Stats, type StatusEffects } from "./build.ts";
import { attrFix, refine, sizeFix } from "./data.ts";
import { add, constant, map, max, mean, min, sub, uniform, type Dist } from "./dist.ts";
import { derivedStatus, totalStats } from "./stats.ts";
import { targetStatus, type Target } from "./target.ts";

// conf/battle/battle.conf
const MIN_HITRATE = 5;
const MAX_HITRATE = 100;

/** Flat ATK from weapon masteries (battle_addmastery). */
export function masteryBonus(build: Build): number {
  switch (build.weapon.type) {
    case "Dagger":
    case "1hSword":
      return 4 * skillLevel(build, "SM_SWORD");
    case "2hSword":
      return 4 * skillLevel(build, "SM_TWOHAND");
    case "1hSpear":
    case "2hSpear":
      return (build.riding ? 5 : 4) * skillLevel(build, "KN_SPEARMASTERY");
    default:
      return 0;
  }
}

function refineRow(build: Build) {
  if (build.weapon.type === "Fist") return { bonus: 0, randomBonus: 0 };
  const row = refine[String(build.weapon.level)]?.[build.weapon.refine];
  if (!row) throw new Error(`No refine data for level ${build.weapon.level} +${build.weapon.refine}`);
  return row;
}

/** Element modifier in percent for the weapon element against the target. */
export function elementModifier(build: Build, target: Target): number {
  const ratio = attrFix[String(target.elementLevel)]?.[build.weapon.element]?.[target.element];
  if (ratio === undefined) throw new Error(`No attr_fix for ${build.weapon.element} vs ${target.element} ${target.elementLevel}`);
  return ratio;
}

/**
 * Damage distribution of one normal attack that connects.
 * Critical hits use the maximum weapon ATK and ignore DEF and VIT DEF.
 */
export function normalAttackDamage(build: Build, stats: Stats, target: Target, critical: boolean): Dist {
  const hasWeapon = build.weapon.type !== "Fist";
  const atkMax = hasWeapon ? build.weapon.atk : 0;
  const { bonus: refineAtk, randomBonus: overrefine } = refineRow(build);

  // battle_calc_base_damage: weapon ATK roll, size fix, status ATK, over-refine.
  let dmg: Dist;
  if (critical) {
    dmg = constant(atkMax);
  } else {
    let atkMin = hasWeapon ? Math.trunc((stats.Dex * (80 + build.weapon.level * 20)) / 100) : stats.Dex;
    atkMin = Math.min(atkMin, atkMax);
    // rnd() % (max - min) + min never rolls the maximum itself.
    dmg = atkMax > atkMin ? uniform(atkMin, atkMax - 1) : constant(atkMin);
  }
  const sizeMod = sizeFix[build.weapon.type]?.[target.size] ?? 100;
  const { batk } = derivedStatus(stats, build.baseLevel);
  dmg = map(dmg, (v) => Math.trunc((v * sizeMod) / 100) + batk);
  if (overrefine > 0) dmg = add(dmg, uniform(1, overrefine));

  // battle_calc_defense_reduction: hard DEF as a percentage, then VIT DEF.
  if (!critical) {
    const def1 = Math.min(target.def, 100);
    const { def2 } = targetStatus(target);
    const spread = Math.trunc(def2 / 20) ** 2;
    const vitDef = spread > 0 ? uniform(def2, def2 + spread - 1) : constant(def2);
    dmg = sub(map(dmg, (v) => Math.trunc((v * (100 - def1)) / 100)), vitDef);
  }

  // battle_calc_attack_post_defense: refine ATK, floor at 1, masteries, floor at 1.
  const mastery = masteryBonus(build);
  dmg = map(dmg, (v) => Math.max(Math.max(v + refineAtk, 1) + mastery, 1));

  // battle_calc_element_damage. Negative ratios heal the target; count them as 0 damage.
  const ratio = elementModifier(build, target);
  return map(dmg, (v) => Math.max(Math.trunc((v * ratio) / 100), 0));
}

/** Chance to land a critical hit (is_attack_critical). */
export function critChance(stats: Stats, baseLevel: number, target: Target): number {
  const cri = derivedStatus(stats, baseLevel).cri - 2 * target.luk;
  return Math.min(Math.max(cri, 0), 1000) / 1000;
}

/** Chance for a non-critical attack to hit (is_attack_hitting). */
export function hitChance(stats: Stats, baseLevel: number, target: Target): number {
  const rate = 80 + derivedStatus(stats, baseLevel).hit - targetStatus(target).flee;
  return Math.min(Math.max(rate, MIN_HITRATE), MAX_HITRATE) / 100;
}

export interface DamageRange {
  min: number;
  max: number;
  mean: number;
}

const range = (d: Dist): DamageRange => ({ min: min(d), max: max(d), mean: mean(d) });

export interface NormalAttackResult {
  attackSpeed: AttackSpeed;
  critChance: number;
  /** Hit chance of non-critical attacks; critical attacks always hit. */
  hitChance: number;
  normal: DamageRange;
  critical: DamageRange;
  /** Expected damage per attack swing, including misses and criticals. */
  meanPerAttack: number;
  dps: number;
}

export function normalAttack(build: Build, effects: StatusEffects, target: Target): NormalAttackResult {
  const stats = totalStats(build, effects);
  const speed = attackSpeed(build, stats, effects);
  const pCrit = critChance(stats, build.baseLevel, target);
  const pHit = hitChance(stats, build.baseLevel, target);
  const normal = range(normalAttackDamage(build, stats, target, false));
  const critical = range(normalAttackDamage(build, stats, target, true));
  const meanPerAttack = pCrit * critical.mean + (1 - pCrit) * pHit * normal.mean;
  return {
    attackSpeed: speed,
    critChance: pCrit,
    hitChance: pHit,
    normal,
    critical,
    meanPerAttack,
    dps: meanPerAttack * speed.attacksPerSecond,
  };
}
