// Pure transforms from parsed rAthena pre-renewal YAML into the JSON shapes used by src/core.
// Kept free of IO so they can be unit tested.

export type Size = "Small" | "Medium" | "Large";
export const SIZES: readonly Size[] = ["Small", "Medium", "Large"];

// Jobs of the prototype's class line, in progression order.
export const PLANNER_JOBS = ["Novice_High", "Swordman_High", "Knight", "Lord_Knight"] as const;
export type PlannerJob = (typeof PLANNER_JOBS)[number];

// External buffs the planner offers, besides the skills in the class line's tree.
export const EXTRA_SKILLS = ["AL_BLESSING", "AL_INCAGI", "PR_IMPOSITIO"] as const;

// Target presets average common monsters a Lord Knight usually hunts. Few small
// monsters exist at 70+, so that size starts lower to keep a meaningful sample.
export const PRESET_LEVEL_RANGE: Record<Size, { min: number; max: number }> = {
  Small: { min: 50, max: 99 },
  Medium: { min: 70, max: 99 },
  Large: { min: 70, max: 99 },
};

type Yaml = Record<string, unknown>;

function body(doc: unknown): Yaml[] {
  const b = (doc as { Body?: unknown }).Body;
  if (!Array.isArray(b)) throw new Error("YAML document has no Body list");
  return b as Yaml[];
}

/**
 * Expands a rAthena per-level field into an array indexed by (level - 1).
 * The field is either a scalar applied to all levels or a list of
 * `{ Level, <key> }` entries; missing levels default to 0.
 */
export function levelArray(field: unknown, maxLevel: number, key: string): number[] {
  const out = new Array<number>(maxLevel).fill(0);
  if (field === undefined || field === null) return out;
  if (typeof field === "number") return out.fill(field);
  if (!Array.isArray(field)) throw new Error(`Unexpected per-level field: ${JSON.stringify(field)}`);
  for (const entry of field as Yaml[]) {
    const level = entry.Level as number;
    if (level >= 1 && level <= maxLevel) out[level - 1] = entry[key] as number;
  }
  return out;
}

function trueKeys(field: unknown): string[] {
  if (!field || typeof field !== "object") return [];
  return Object.entries(field as Yaml)
    .filter(([, v]) => v === true)
    .map(([k]) => k);
}

// ---------- job_aspd.yml / job_stats.yml ----------

export interface JobData {
  job: PlannerJob;
  /** Base attack motion (amotion) per weapon type, in ms; ASPD = 200 - amotion / 10. */
  baseAspd: Record<string, number>;
  /** Stat bonus granted at each job level (non-cumulative), indexed by job level. */
  bonusStats: { level: number; stats: Record<string, number> }[];
  /** Base SP growth per base level, in hundredths (SpIncrease; rAthena default 100). */
  spIncrease: number;
  /** Base SP added per level times the level, in hundredths (SpFactor; default 0). */
  spFactor: number;
}

function findJobEntry(entries: Yaml[], job: string): Yaml | undefined {
  return entries.find((e) => (e.Jobs as Yaml | undefined)?.[job] === true);
}

export function buildJobs(jobAspdDoc: unknown, jobStatsDoc: unknown): JobData[] {
  const aspdEntries = body(jobAspdDoc);
  const statEntries = body(jobStatsDoc);
  return PLANNER_JOBS.map((job) => {
    const aspd = findJobEntry(aspdEntries, job);
    if (!aspd) throw new Error(`job_aspd has no entry for ${job}`);
    const stats = findJobEntry(statEntries, job);
    const bonus = ((stats?.BonusStats as Yaml[] | undefined) ?? []).map((b) => {
      const { Level, ...rest } = b;
      return { level: Level as number, stats: rest as Record<string, number> };
    });
    // Explicit BaseSp tables would override the SpIncrease/SpFactor formula; none of the
    // planner jobs has one, so only the formula inputs are exported.
    if (stats?.BaseSp) throw new Error(`job_stats has an explicit BaseSp table for ${job}`);
    return {
      job,
      baseAspd: aspd.BaseASPD as Record<string, number>,
      bonusStats: bonus,
      spIncrease: (stats?.SpIncrease as number | undefined) ?? 100,
      spFactor: (stats?.SpFactor as number | undefined) ?? 0,
    };
  });
}

// ---------- statpoint.yml ----------

/** Cumulative status points by base level (index = level - 1). */
export function buildStatPoints(doc: unknown, maxLevel = 99): number[] {
  const out = levelArray(body(doc), maxLevel, "Points");
  if (out.some((p) => p === 0)) throw new Error("statpoint.yml has gaps below the max level");
  return out;
}

// ---------- skill_tree.yml ----------

export interface TreeSkill {
  name: string;
  maxLevel: number;
  requires: { name: string; level: number }[];
  jobLevel?: number;
}

export interface JobTree {
  job: PlannerJob;
  /** Skills this job adds to the tree (inherited ones belong to earlier jobs). */
  skills: TreeSkill[];
}

// The transcendent first jobs reuse the regular trees through Inherit.
const TREE_SOURCE: Record<PlannerJob, string> = {
  Novice_High: "Novice",
  Swordman_High: "Swordman",
  Knight: "Knight",
  Lord_Knight: "Lord_Knight",
};

export function buildSkillTree(doc: unknown): JobTree[] {
  const entries = body(doc);
  return PLANNER_JOBS.map((job) => {
    const source = entries.find((e) => e.Job === TREE_SOURCE[job]);
    if (!source) throw new Error(`skill_tree has no entry for ${TREE_SOURCE[job]}`);
    const skills = ((source.Tree as Yaml[] | undefined) ?? [])
      .filter((s) => s.Exclude !== true)
      .map((s): TreeSkill => {
        const skill: TreeSkill = {
          name: s.Name as string,
          maxLevel: s.MaxLevel as number,
          requires: ((s.Requires as Yaml[] | undefined) ?? []).map((r) => ({
            name: r.Name as string,
            level: r.Level as number,
          })),
        };
        if (typeof s.JobLevel === "number") skill.jobLevel = s.JobLevel;
        return skill;
      });
    return { job, skills };
  });
}

// ---------- skill_db.yml ----------

export interface SkillData {
  id: number;
  name: string;
  description: string;
  maxLevel: number;
  type: string | null;
  targetType: string | null;
  hit: string | null;
  element: string | null;
  isQuest: boolean;
  damageFlags: string[];
  castTimeFlags: string[];
  castDelayFlags: string[];
  requiredWeapons: string[];
  // Per-level values, index = level - 1.
  hitCount: number[];
  castTime: number[];
  afterCastActDelay: number[];
  afterCastWalkDelay: number[];
  cooldown: number[];
  duration1: number[];
  duration2: number[];
  spCost: number[];
}

export function buildSkills(doc: unknown, names: ReadonlySet<string>): SkillData[] {
  const found = body(doc).filter((s) => names.has(s.Name as string));
  const missing = [...names].filter((n) => !found.some((s) => s.Name === n));
  if (missing.length) throw new Error(`skill_db is missing: ${missing.join(", ")}`);
  return found.map((s) => {
    const max = s.MaxLevel as number;
    const req = (s.Requires as Yaml | undefined) ?? {};
    return {
      id: s.Id as number,
      name: s.Name as string,
      description: s.Description as string,
      maxLevel: max,
      type: (s.Type as string | undefined) ?? null,
      targetType: (s.TargetType as string | undefined) ?? null,
      hit: (s.Hit as string | undefined) ?? null,
      element: (s.Element as string | undefined) ?? null,
      isQuest: (s.Flags as Yaml | undefined)?.IsQuest === true,
      damageFlags: trueKeys(s.DamageFlags),
      castTimeFlags: trueKeys(s.CastTimeFlags),
      castDelayFlags: trueKeys(s.CastDelayFlags),
      requiredWeapons: trueKeys(req.Weapon),
      hitCount: levelArray(s.HitCount ?? 1, max, "Count"),
      castTime: levelArray(s.CastTime, max, "Time"),
      afterCastActDelay: levelArray(s.AfterCastActDelay, max, "Time"),
      afterCastWalkDelay: levelArray(s.AfterCastWalkDelay, max, "Time"),
      cooldown: levelArray(s.Cooldown, max, "Time"),
      duration1: levelArray(s.Duration1, max, "Time"),
      duration2: levelArray(s.Duration2, max, "Time"),
      spCost: levelArray(req.SpCost, max, "Amount"),
    };
  });
}

// ---------- size_fix.yml ----------

/**
 * Damage % by weapon type and target size. rAthena loads db/size_fix.yml and then
 * db/pre-re/size_fix.yml on top: an override only replaces the sizes it lists,
 * and sizes never listed default to 100.
 */
export function buildSizeFix(baseDoc: unknown, overrideDoc: unknown): Record<string, Record<Size, number>> {
  const out: Record<string, Record<Size, number>> = {};
  for (const e of [...body(baseDoc), ...body(overrideDoc)]) {
    const weapon = e.Weapon as string;
    const current = out[weapon] ?? { Small: 100, Medium: 100, Large: 100 };
    for (const size of SIZES) if (typeof e[size] === "number") current[size] = e[size];
    out[weapon] = current;
  }
  return out;
}

// ---------- attr_fix.yml ----------

/** Element damage %: [defElementLevel 1..4][attackElement][defenseElement]. */
export function buildAttrFix(doc: unknown): Record<string, Record<string, Record<string, number>>> {
  const out: Record<string, Record<string, Record<string, number>>> = {};
  for (const e of body(doc)) {
    const { Level, ...table } = e;
    out[String(Level)] = table as Record<string, Record<string, number>>;
  }
  return out;
}

// ---------- refine.yml ----------

export interface RefineLevel {
  /** Flat ATK added by the refine (rAthena stores it * 100). */
  bonus: number;
  /** Upper bound of the random over-refine ATK (0..randomBonus). */
  randomBonus: number;
}

/** Weapon refine bonuses: [weaponLevel 1..4][refine 0..maxRefine]. */
export function buildRefine(doc: unknown, maxRefine = 10): Record<string, RefineLevel[]> {
  const weapon = body(doc).find((g) => g.Group === "Weapon");
  if (!weapon) throw new Error("refine.yml has no Weapon group");
  const out: Record<string, RefineLevel[]> = {};
  for (const lv of weapon.Levels as Yaml[]) {
    const table: RefineLevel[] = [{ bonus: 0, randomBonus: 0 }];
    const byLevel = new Map((lv.RefineLevels as Yaml[]).map((r) => [r.Level as number, r]));
    for (let r = 1; r <= maxRefine; r++) {
      const e = byLevel.get(r);
      table.push({
        bonus: ((e?.Bonus as number | undefined) ?? 0) / 100,
        randomBonus: ((e?.RandomBonus as number | undefined) ?? 0) / 100,
      });
    }
    out[String(lv.Level)] = table;
  }
  return out;
}

// ---------- mob_db.yml ----------

export interface Mob {
  aegisName: string;
  level: number;
  hp: number;
  def: number;
  vit: number;
  agi: number;
  luk: number;
  size: Size;
  race: string;
  element: string;
  elementLevel: number;
}

// Event copies, guardian/slave copies and instance variants duplicate regular monsters.
const DUPLICATE_PREFIX = /^(E_|G_|C\d_|MD_|I_)/;
const IGNORE_MODES = ["Mvp", "Treasure", "IgnoreMelee", "IgnoreMagic", "IgnoreRanged", "IgnoreMisc"];

/** Normal-class monsters in their size's level range, excluding MVPs, plants, treasure and copies. */
export function filterPresetMobs(doc: unknown): Mob[] {
  return body(doc)
    .filter((m) => {
      const cls = (m.Class as string | undefined) ?? "Normal";
      const modes = (m.Modes as Yaml | undefined) ?? {};
      const level = (m.Level as number | undefined) ?? 1;
      const range = PRESET_LEVEL_RANGE[(m.Size as Size | undefined) ?? "Small"];
      return (
        cls === "Normal" &&
        !IGNORE_MODES.some((k) => modes[k] === true) &&
        !DUPLICATE_PREFIX.test(m.AegisName as string) &&
        level >= range.min &&
        level <= range.max
      );
    })
    .map((m) => ({
      aegisName: m.AegisName as string,
      level: (m.Level as number | undefined) ?? 1,
      hp: (m.Hp as number | undefined) ?? 1,
      def: (m.Defense as number | undefined) ?? 0,
      vit: (m.Vit as number | undefined) ?? 1,
      agi: (m.Agi as number | undefined) ?? 1,
      luk: (m.Luk as number | undefined) ?? 1,
      size: ((m.Size as Size | undefined) ?? "Small"),
      race: (m.Race as string | undefined) ?? "Formless",
      element: (m.Element as string | undefined) ?? "Neutral",
      elementLevel: (m.ElementLevel as number | undefined) ?? 1,
    }));
}

export interface TargetPreset {
  size: Size;
  sampleSize: number;
  level: number;
  hp: number;
  def: number;
  vit: number;
  agi: number;
  luk: number;
  race: string;
  element: string;
  elementLevel: number;
}

function mode<T>(values: T[]): T {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T | undefined;
  let bestCount = -1;
  // Ties resolve to the first value seen, keeping output deterministic for a given input order.
  for (const [v, c] of counts) if (c > bestCount) [best, bestCount] = [v, c];
  if (best === undefined) throw new Error("mode of empty list");
  return best;
}

const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);

export function buildTargetPresets(mobs: Mob[]): TargetPreset[] {
  return SIZES.map((size) => {
    const group = mobs.filter((m) => m.size === size);
    if (!group.length) throw new Error(`No monsters for size ${size}`);
    const element = mode(group.map((m) => `${m.element}:${m.elementLevel}`)).split(":");
    return {
      size,
      sampleSize: group.length,
      level: avg(group.map((m) => m.level)),
      hp: avg(group.map((m) => m.hp)),
      def: avg(group.map((m) => m.def)),
      vit: avg(group.map((m) => m.vit)),
      agi: avg(group.map((m) => m.agi)),
      luk: avg(group.map((m) => m.luk)),
      race: mode(group.map((m) => m.race)),
      element: element[0]!,
      elementLevel: Number(element[1]),
    };
  });
}
