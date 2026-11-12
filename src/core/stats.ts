// Status points, job bonuses and derived status values (rAthena pre-renewal).

import { BASE_STAT_MAX, BASE_STAT_MIN, MAX_BASE_LEVEL, MAX_JOB_LEVEL, type Build, type Stats, type StatusEffects } from "./build.ts";
import { STAT_NAMES, getJob, statPoints, type JobData } from "./data.ts";

/** transcendent_status_points in conf/battle/player.conf. */
export const TRANSCENDENT_STATUS_POINTS = 52;

/** Points to raise a stat from `low` to `low + 1` (PC_STATUS_POINT_COST, pre-renewal). */
export function statPointCost(low: number): number {
  return 1 + Math.floor((low + 9) / 10);
}

/** Points spent to raise a stat from 1 to `value`. */
export function statPointsToReach(value: number): number {
  let total = 0;
  for (let low = BASE_STAT_MIN; low < value; low++) total += statPointCost(low);
  return total;
}

/** Status points a transcendent character has at `baseLevel` with all stats at 1. */
export function availableStatPoints(baseLevel: number): number {
  const table = statPoints[baseLevel - 1];
  if (table === undefined) throw new Error(`No status point entry for base level ${baseLevel}`);
  return table + TRANSCENDENT_STATUS_POINTS;
}

export function spentStatPoints(stats: Stats): number {
  return STAT_NAMES.reduce((sum, s) => sum + statPointsToReach(stats[s]), 0);
}

/** Cumulative job bonus at `jobLevel` (job_bonus[job_level - 1] in status.cpp). */
export function jobBonusStats(job: JobData, jobLevel: number): Stats {
  const out: Stats = { Str: 0, Agi: 0, Vit: 0, Int: 0, Dex: 0, Luk: 0 };
  for (const { level, stats } of job.bonusStats) {
    if (level > jobLevel) continue;
    for (const s of STAT_NAMES) out[s] += stats[s] ?? 0;
  }
  return out;
}

/** Final stats: allocated + job bonus + buffs. */
export function totalStats(build: Build, effects: StatusEffects): Stats {
  const bonus = jobBonusStats(getJob("Lord_Knight"), build.jobLevel);
  const out = { ...build.stats };
  for (const s of STAT_NAMES) out[s] += bonus[s] + (effects.statBonus[s] ?? 0);
  return out;
}

export interface DerivedStatus {
  /** Status ATK from STR/DEX/LUK (status_base_atk). */
  batk: number;
  hit: number;
  flee: number;
  /** Critical rate in tenths of a percent (status->cri). */
  cri: number;
  /** Perfect dodge in tenths of a percent (status->flee2). */
  flee2: number;
  /** DEF from VIT (status->def2). */
  def2: number;
}

/** status_calc_misc + status_base_atk for a player using a melee weapon. */
export function derivedStatus(stats: Stats, baseLevel: number): DerivedStatus {
  const dstr = Math.floor(stats.Str / 10);
  return {
    batk: stats.Str + dstr * dstr + Math.floor(stats.Dex / 5) + Math.floor(stats.Luk / 5),
    hit: baseLevel + stats.Dex,
    flee: baseLevel + stats.Agi,
    cri: 10 + Math.floor((stats.Luk * 10) / 3),
    flee2: stats.Luk + 10,
    def2: stats.Vit,
  };
}

export type StatIssue =
  | { code: "baseLevelOutOfRange"; min: 1; max: number }
  | { code: "jobLevelOutOfRange"; min: 1; max: number }
  | { code: "statOutOfRange"; stat: keyof Stats; min: number; max: number }
  | { code: "notEnoughStatPoints"; spent: number; available: number };

export function validateStats(build: Build): StatIssue[] {
  const issues: StatIssue[] = [];
  const intIn = (v: number, min: number, max: number) => Number.isInteger(v) && v >= min && v <= max;
  if (!intIn(build.baseLevel, 1, MAX_BASE_LEVEL)) {
    issues.push({ code: "baseLevelOutOfRange", min: 1, max: MAX_BASE_LEVEL });
  }
  if (!intIn(build.jobLevel, 1, MAX_JOB_LEVEL)) {
    issues.push({ code: "jobLevelOutOfRange", min: 1, max: MAX_JOB_LEVEL });
  }
  for (const stat of STAT_NAMES) {
    if (!intIn(build.stats[stat], BASE_STAT_MIN, BASE_STAT_MAX)) {
      issues.push({ code: "statOutOfRange", stat, min: BASE_STAT_MIN, max: BASE_STAT_MAX });
    }
  }
  if (issues.length) return issues;
  const spent = spentStatPoints(build.stats);
  const available = availableStatPoints(build.baseLevel);
  if (spent > available) issues.push({ code: "notEnoughStatPoints", spent, available });
  return issues;
}
