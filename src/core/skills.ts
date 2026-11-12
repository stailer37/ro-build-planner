// Skill allocation for the Lord Knight line: skill points per job stage and prerequisites.

import type { Build } from "./build.ts";
import { skills, skillTree, type JobName, type SkillTreeEntry } from "./data.ts";

/**
 * Skill point pools. A transcendent character changes job at the maximum job level of
 * High Novice (10) and High Swordman (50); Knight and Lord Knight skills share the
 * Lord Knight job level. Each job level after the first grants one point.
 */
export type SkillStage = "novice" | "swordman" | "lordKnight";
export const SKILL_STAGES: readonly SkillStage[] = ["novice", "swordman", "lordKnight"];

const STAGE_OF_JOB: Record<JobName, SkillStage> = {
  Novice_High: "novice",
  Swordman_High: "swordman",
  Knight: "lordKnight",
  Lord_Knight: "lordKnight",
};

/** Skills a regular character cannot learn (wedding skills). */
const HIDDEN_SKILLS = new Set(["WE_CALLBABY"]);

export interface PlannerSkill extends SkillTreeEntry {
  job: JobName;
  stage: SkillStage;
  /** Quest skills are learned from NPCs and cost no skill points. */
  isQuest: boolean;
}

export const PLANNER_SKILLS: readonly PlannerSkill[] = skillTree.flatMap(({ job, skills: entries }) =>
  entries
    .filter((e) => !HIDDEN_SKILLS.has(e.name))
    .map((e) => ({ ...e, job, stage: STAGE_OF_JOB[job], isQuest: skills.find((s) => s.name === e.name)?.isQuest ?? false })),
);

const byName = new Map(PLANNER_SKILLS.map((s) => [s.name, s]));

export function getPlannerSkill(name: string): PlannerSkill {
  const s = byName.get(name);
  if (!s) throw new Error(`Unknown skill ${name}`);
  return s;
}

export function availableSkillPoints(stage: SkillStage, jobLevel: number): number {
  switch (stage) {
    case "novice":
      return 9;
    case "swordman":
      return 49;
    case "lordKnight":
      return jobLevel - 1;
  }
}

export function spentSkillPoints(learned: Build["skills"], stage: SkillStage): number {
  let total = 0;
  for (const s of PLANNER_SKILLS) if (s.stage === stage && !s.isQuest) total += learned[s.name] ?? 0;
  return total;
}

export type SkillIssue =
  | { code: "unknownSkill"; skill: string }
  | { code: "skillLevelOutOfRange"; skill: string; max: number }
  | { code: "missingPrerequisite"; skill: string; requires: string; level: number }
  | { code: "notEnoughSkillPoints"; stage: SkillStage; spent: number; available: number };

export function validateSkills(build: Build): SkillIssue[] {
  const issues: SkillIssue[] = [];
  for (const [name, level = 0] of Object.entries(build.skills)) {
    const s = byName.get(name);
    if (!s) {
      issues.push({ code: "unknownSkill", skill: name });
      continue;
    }
    if (!Number.isInteger(level) || level < 0 || level > s.maxLevel) {
      issues.push({ code: "skillLevelOutOfRange", skill: name, max: s.maxLevel });
    }
    if (level === 0) continue;
    for (const r of s.requires) {
      if ((build.skills[r.name] ?? 0) < r.level) {
        issues.push({ code: "missingPrerequisite", skill: name, requires: r.name, level: r.level });
      }
    }
  }
  for (const stage of SKILL_STAGES) {
    const spent = spentSkillPoints(build.skills, stage);
    const available = availableSkillPoints(stage, build.jobLevel);
    if (spent > available) issues.push({ code: "notEnoughSkillPoints", stage, spent, available });
  }
  return issues;
}

/**
 * Sets a skill level the way a player would get there: raising a skill also raises its
 * prerequisites, and lowering one drops the skills that no longer meet their requirements.
 */
export function setSkillLevel(learned: Build["skills"], name: string, level: number): Build["skills"] {
  const out = { ...learned };
  const raise = (skill: string, lv: number) => {
    if ((out[skill] ?? 0) >= lv) return;
    out[skill] = lv;
    for (const r of getPlannerSkill(skill).requires) raise(r.name, r.level);
  };
  const s = getPlannerSkill(name);
  const target = Math.min(Math.max(level, 0), s.maxLevel);
  if (target >= (out[name] ?? 0)) {
    raise(name, target);
    return out;
  }
  out[name] = target;
  // Lowering can break other skills, which in turn can break more; repeat until stable.
  for (let changed = true; changed; ) {
    changed = false;
    for (const d of PLANNER_SKILLS) {
      if ((out[d.name] ?? 0) > 0 && d.requires.some((r) => (out[r.name] ?? 0) < r.level)) {
        out[d.name] = 0;
        changed = true;
      }
    }
  }
  for (const k of Object.keys(out)) if (out[k] === 0) delete out[k];
  return out;
}
