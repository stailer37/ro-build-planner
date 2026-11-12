// Offensive Lord Knight line skills against a single target (rAthena pre-renewal:
// src/map/skills/swordman/*.cpp, battle_calc_weapon_attack, skill_castfix, skill_delayfix
// and unit_set_attackdelay).

import { attackSpeed } from "./aspd.ts";
import { skillLevel, type Build, type Stats, type StatusEffects } from "./build.ts";
import { ELEMENTS, SIZES, getSkillData, type Element, type SkillData } from "./data.ts";
import { constant, mean } from "./dist.ts";
import { hitChance, normalAttackSpec, range, weaponAttackDamage, type AttackSpec, type DamageRange } from "./damage.ts";
import { totalStats } from "./stats.ts";
import type { Target } from "./target.ts";

/** castrate_dex_scale in conf/battle/skill.conf: cast time reaches 0 at this DEX. */
const CASTRATE_DEX_SCALE = 150;
/** pc_maxaspd / AMOTION_DIVIDER_PC: fixed part of the act delay set when a cast begins. */
const CASTBEGIN_ACT_DELAY = 100;

interface OffensiveSkillDef {
  name: string;
  /** Percent added to the 100% skill ratio at a level. */
  ratio: (level: number) => number;
  /** Percent increase of the hit rate (modifyHitRate). */
  hitBonus?: (level: number) => number;
  /** Hits per use when they depend on the target instead of skill_db. */
  hits?: (target: Target) => number;
  requiresRiding?: boolean;
}

export const OFFENSIVE_SKILLS: readonly OffensiveSkillDef[] = [
  { name: "SM_BASH", ratio: (lv) => 30 * lv, hitBonus: (lv) => 5 * lv },
  // Inner 3x3 area, where an adjacent target stands.
  { name: "SM_MAGNUM", ratio: (lv) => 20 * lv, hitBonus: (lv) => 10 * lv },
  { name: "KN_PIERCE", ratio: (lv) => 10 * lv, hitBonus: (lv) => 5 * lv, hits: (t) => SIZES.indexOf(t.size) + 1 },
  { name: "KN_SPEARSTAB", ratio: (lv) => 20 * lv },
  { name: "KN_BRANDISHSPEAR", ratio: brandishRatio, requiresRiding: true },
  { name: "KN_SPEARBOOMERANG", ratio: (lv) => 50 * lv },
  // A lone target: no chain collisions, so a single hit.
  { name: "KN_BOWLINGBASH", ratio: (lv) => 40 * lv },
  { name: "LK_SPIRALPIERCE", ratio: () => 0 },
  { name: "LK_HEADCRUSH", ratio: (lv) => 40 * lv },
  // Without the doubled damage of a broken neck.
  { name: "LK_JOINTBEAT", ratio: (lv) => 10 * lv - 50 },
];

/** Brandish Spear against a target in the area nearest the caster (miscflag 0). */
function brandishRatio(lv: number): number {
  const ratio = 100 + 20 * lv;
  let out = ratio - 100;
  if (lv > 3) out += Math.trunc(ratio / 2);
  if (lv > 6) out += Math.trunc(ratio / 4);
  if (lv > 9) out += Math.trunc(ratio / 8);
  return out;
}

/**
 * Spiral Pierce base damage (pre-renewal battle_calc_skill_base_damage): 80% of the
 * item_db weight (tenths of the in-game weight) plus 50% per level, the STR bonus
 * of the status ATK, and its own size modifier instead of size_fix.
 */
export function spiralPierceBase(weight: number, str: number, level: number, target: Target): number {
  let dmg = Math.trunc((weight * 10 * 8) / 100);
  dmg += Math.trunc((dmg * 50 * level) / 100);
  dmg += Math.trunc(str / 10) ** 2;
  if (target.size === "Small") dmg = Math.trunc((dmg * 125) / 100);
  if (target.size === "Large") dmg = Math.trunc((dmg * 75) / 100);
  return dmg;
}

/** Cast time after the pre-renewal DEX reduction (skill_castfix). */
export function castTime(data: SkillData, level: number, dex: number): number {
  const base = data.castTime[level - 1] ?? 0;
  if (data.castTimeFlags.includes("IgnoreDex")) return base;
  const scale = CASTRATE_DEX_SCALE - dex;
  return scale > 0 ? Math.trunc((base * scale) / CASTRATE_DEX_SCALE) : 0;
}

/**
 * Time between two uses of a skill. A cast begin blocks actions for amotion + 100 ms;
 * the cast end sets the after-cast delay from there (skill_delayfix, no DEX/AGI scaling).
 */
export function skillCycle(cast: number, delay: number, amotion: number): number {
  return Math.max(cast + delay, amotion + CASTBEGIN_ACT_DELAY);
}

/** Why a skill cannot be used: wrong weapon, not mounted, or Frenzy (NoCast in status.yml). */
export type SkillUnavailable = "weapon" | "riding" | "berserk";

export interface SkillAttackStats {
  available: true;
  skill: string;
  level: number;
  hits: number;
  hitChance: number;
  /** Damage per use that connects, all hits included. */
  damage: DamageRange;
  /** Cast time in ms after DEX. */
  castTime: number;
  /** After-cast delay in ms. */
  delay: number;
  /** Time between uses in ms. */
  cycle: number;
  dps: number;
  spCost: number;
  spPerSecond: number;
}

export type SkillAttackResult =
  | SkillAttackStats
  | { available: false; skill: string; level: number; reason: SkillUnavailable };

function attackSpec(build: Build, stats: Stats, def: OffensiveSkillDef, data: SkillData, level: number, target: Target): AttackSpec {
  const spec: AttackSpec = {
    ...normalAttackSpec(build, false),
    skillRatio: 100 + def.ratio(level),
    ignoresDef: data.damageFlags.includes("IgnoreDefense"),
    hits: def.hits?.(target) ?? data.hitCount[level - 1] ?? 1,
  };
  if (data.element && data.element !== "Weapon") {
    if (!(ELEMENTS as readonly string[]).includes(data.element)) throw new Error(`Unknown element ${data.element}`);
    spec.element = data.element as Element;
  }
  if (def.name === "LK_SPIRALPIERCE") {
    // Only the refine bonus stacks; no masteries, ATK% or Aura Blade.
    spec.base = constant(spiralPierceBase(build.weapon.weight, stats.Str, level, target));
    spec.stacksBonuses = false;
    spec.auraBlade = false;
  }
  return spec;
}

export function skillAttack(build: Build, effects: StatusEffects, target: Target, skill: string): SkillAttackResult {
  const def = OFFENSIVE_SKILLS.find((s) => s.name === skill);
  if (!def) throw new Error(`${skill} is not an offensive skill`);
  const level = skillLevel(build, skill);
  const data = getSkillData(skill);
  if (data.requiredWeapons.length > 0 && !data.requiredWeapons.includes(build.weapon.type)) {
    return { available: false, skill, level, reason: "weapon" };
  }
  if (def.requiresRiding && !build.riding) return { available: false, skill, level, reason: "riding" };
  if (effects.berserk) return { available: false, skill, level, reason: "berserk" };

  const stats = totalStats(build, effects);
  const spec = attackSpec(build, stats, def, data, level, target);
  const dmg = weaponAttackDamage(build, stats, effects, target, spec);
  const pHit = hitChance(stats, build.baseLevel, effects, target, def.hitBonus?.(level) ?? 0);
  const cast = castTime(data, level, stats.Dex);
  const delay = data.afterCastActDelay[level - 1] ?? 0;
  const cycle = skillCycle(cast, delay, attackSpeed(build, stats, effects).amotion);
  const spCost = data.spCost[level - 1] ?? 0;
  return {
    available: true,
    skill,
    level,
    hits: spec.hits,
    hitChance: pHit,
    damage: range(dmg),
    castTime: cast,
    delay,
    cycle,
    dps: (pHit * mean(dmg) * 1000) / cycle,
    spCost,
    spPerSecond: (spCost * 1000) / cycle,
  };
}

/** Every learned offensive skill, in skill tree order. */
export function learnedSkillAttacks(build: Build, effects: StatusEffects, target: Target): SkillAttackResult[] {
  return OFFENSIVE_SKILLS.filter((s) => skillLevel(build, s.name) > 0).map((s) => skillAttack(build, effects, target, s.name));
}
