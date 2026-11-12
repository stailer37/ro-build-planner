// Entry point for the planner: validate the whole build, then compute normal attack and skill DPS.

import { skillLevel, validateWeapon, type Build, type Stats, type StatusEffects, type WeaponIssue } from "./build.ts";
import { resolveEffects, validateBuffs, type BuffIssue, type Buffs } from "./buffs.ts";
import { normalAttack, type NormalAttackResult } from "./damage.ts";
import { learnedSkillAttacks, type SkillAttackResult, type SkillAttackStats } from "./offensive.ts";
import { skillSustain, spStatus, type SkillSustain, type SpStatus } from "./sp.ts";
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

/** An offensive skill result; usable ones also say how long SP keeps them up. */
export type PlannedSkill = (SkillAttackStats & { sustain: SkillSustain }) | Exclude<SkillAttackResult, SkillAttackStats>;

export interface PlanResult extends NormalAttackResult {
  stats: Stats;
  effects: StatusEffects;
  sp: SpStatus;
  /** Learned offensive skills, in skill tree order. */
  skills: PlannedSkill[];
}

export type PlanOutcome = { ok: true; result: PlanResult } | { ok: false; issues: PlanIssue[] };

export function calculate(build: Build, buffs: Buffs, target: Target): PlanOutcome {
  const issues = validatePlan(build, buffs);
  if (issues.length) return { ok: false, issues };
  const effects = resolveEffects(build, buffs);
  const stats = totalStats(build, effects);
  const normal = normalAttack(build, effects, target);
  const sp = spStatus(stats, build.baseLevel, effects);
  const skills = learnedSkillAttacks(build, effects, target).map((s) =>
    s.available ? { ...s, sustain: skillSustain(s.dps, s.spPerSecond, normal.dps, sp) } : s,
  );
  return { ok: true, result: { ...normal, stats, effects, sp, skills } };
}
