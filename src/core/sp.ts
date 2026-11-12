// Max SP, natural SP regeneration and how long skills can be kept up on it
// (rAthena pre-renewal: JobDatabase::calc_basesp, status_calc_maxsp_pc,
// status_calc_regen and status_natural_heal).

import type { Stats, StatusEffects } from "./build.ts";
import { getJob, type JobData } from "./data.ts";

/** natural_healsp_interval in conf/battle/player.conf: standing SP regen tick, in ms. */
export const SP_REGEN_INTERVAL = 8000;
/** Transcendent classes get 25% more max SP. */
const UPPER_SP_RATE = 1.25;

/** Base SP at a base level before INT (calc_basesp, no class exceptions on this line). */
export function baseSp(job: JobData, baseLevel: number): number {
  let sp = 10 + Math.floor(baseLevel * (job.spIncrease / 100));
  for (let i = 2; i <= baseLevel; i++) sp += Math.floor((job.spFactor / 100) * i + 0.5);
  return sp;
}

/** Max SP of a Lord Knight without equipment (status_calc_maxsp_pc). */
export function maxSp(baseLevel: number, int: number): number {
  let sp = baseSp(getJob("Lord_Knight"), baseLevel);
  if (int > 0) sp *= 1 + int * 0.01;
  sp *= UPPER_SP_RATE;
  return Math.max(Math.trunc(sp), 1);
}

export interface SpStatus {
  max: number;
  /** SP recovered every SP_REGEN_INTERVAL while standing; 0 when regen is blocked. */
  regenPerTick: number;
  regenPerSecond: number;
}

/** SP pool and standing regen. Attacking does not stop regen; Frenzy (SC_BERSERK) does. */
export function spStatus(stats: Stats, baseLevel: number, effects: StatusEffects): SpStatus {
  const max = maxSp(baseLevel, stats.Int);
  let tick = 1 + Math.trunc(stats.Int / 6) + Math.trunc(max / 100);
  if (stats.Int >= 120) tick += Math.trunc((stats.Int - 120) / 2) + 4;
  if (effects.berserk) tick = 0;
  return { max, regenPerTick: tick, regenPerSecond: (tick * 1000) / SP_REGEN_INTERVAL };
}

export interface SkillSustain {
  /** Seconds of nonstop use from full SP; Infinity when regen covers the cost. */
  fullSpDuration: number;
  /** Share of the time spent on the skill that regen can pay for indefinitely, 0..1. */
  sustainedShare: number;
  /** Long-fight DPS: the skill for its sustainable share, normal attacks the rest of the time. */
  sustainedDps: number;
}

export function skillSustain(skillDps: number, spPerSecond: number, normalDps: number, sp: SpStatus): SkillSustain {
  const deficit = spPerSecond - sp.regenPerSecond;
  const share = spPerSecond > 0 ? Math.min(sp.regenPerSecond / spPerSecond, 1) : 1;
  return {
    fullSpDuration: deficit > 0 ? sp.max / deficit : Number.POSITIVE_INFINITY,
    sustainedShare: share,
    sustainedDps: share * skillDps + (1 - share) * normalDps,
  };
}
