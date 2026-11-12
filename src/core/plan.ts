// Entry point for the planner: validate the whole build, then compute normal attack and skill DPS.

import { skillLevel, validateWeapon, type Build, type Stats, type StatusEffects, type WeaponIssue } from "./build.ts";
import { resolveEffects, validateBuffs, type BuffIssue, type Buffs } from "./buffs.ts";
import { normalAttack, type NormalAttackResult } from "./damage.ts";
import { learnedSkillAttacks, type SkillAttackResult } from "./offensive.ts";
import { validateSkills, type SkillIssue } from "./skills.ts";
import { totalStats, validateStats, type StatIssue } from "./stats.ts";
import type { Target } from "./target.ts";

export type PlanIssue = StatIssue | SkillIssue | WeaponIssue | BuffIssue | { code: "ridingNotLearned" };

export function validatePlan(build: Build, buffs: Buffs): PlanIssue[] {
  const issues: PlanIssue[] = [...validateStats(build), ...validateSkills(build), ...validateWeapon(build.weapon)];
  if (build.riding && skillLevel(build, "KN_RIDING") === 0) issues.push({ code: "ridingNotLearned" });
  issues.push(...validateBuffs(build, buffs));
  return issues;
}

export interface PlanResult extends NormalAttackResult {
  stats: Stats;
  effects: StatusEffects;
  /** Learned offensive skills, in skill tree order. */
  skills: SkillAttackResult[];
}

export type PlanOutcome = { ok: true; result: PlanResult } | { ok: false; issues: PlanIssue[] };

export function calculate(build: Build, buffs: Buffs, target: Target): PlanOutcome {
  const issues = validatePlan(build, buffs);
  if (issues.length) return { ok: false, issues };
  const effects = resolveEffects(build, buffs);
  return {
    ok: true,
    result: {
      ...normalAttack(build, effects, target),
      stats: totalStats(build, effects),
      effects,
      skills: learnedSkillAttacks(build, effects, target),
    },
  };
}
