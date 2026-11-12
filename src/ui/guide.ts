// Ready-made Lord Knight builds from the "Builds RO Classic Idle" guide (skills, stats and
// reasoning from the RO Classic Idle wiki), loadable into the planner to measure them.

import type { Build, Stats, WeaponType } from "../core/build.ts";
import type { StatName } from "../core/data.ts";
import data from "../data/guideBuilds.json";
import type { Inputs } from "./share.ts";

export type GuideStyle = "spear" | "bowlingBash" | "crit";
export type GuideGoal = "mvp" | "leveling";

export interface GuideBuild {
  id: string;
  style: GuideStyle;
  goal: GuideGoal;
  title: string;
  summary: string;
  weaponType: WeaponType;
  riding: boolean;
  /** The guide's end-game weapon and cards, as text: the planner has no item data. */
  weapon: string;
  stats: Stats;
  /** Why the guide picks each stat value. */
  statNotes: Record<StatName, string>;
  skills: Record<string, number>;
}

export const GUIDE_BUILDS = data as GuideBuild[];

export const STYLE_LABELS: Record<GuideStyle, string> = { spear: "Lança", bowlingBash: "Impacto de Tyr", crit: "Crítico" };
export const GOAL_LABELS: Record<GuideGoal, string> = { mvp: "MVP", leveling: "Leveling" };

/** The guide's levels for a Lord Knight: base 99, job 70. */
const GUIDE_LEVELS = { baseLevel: 99, jobLevel: 70 };

export const findGuideBuild = (style: GuideStyle, goal: GuideGoal) =>
  GUIDE_BUILDS.find((g) => g.style === style && g.goal === goal);

/**
 * Inputs with a guide build loaded. Weapon ATK, level and refine stay as they were (the guide names
 * items, not numbers); self buffs follow the build, party buffs are kept. MVPs are mostly large,
 * so the MVP builds aim at the large target.
 */
export function applyGuideBuild(inputs: Inputs, g: GuideBuild): Inputs {
  return {
    build: {
      ...inputs.build,
      ...GUIDE_LEVELS,
      stats: { ...g.stats },
      skills: { ...g.skills },
      weapon: { ...inputs.build.weapon, type: g.weaponType },
      riding: g.riding,
    },
    buffs: {
      ...inputs.buffs,
      twoHandQuicken: g.weaponType === "2hSword" && (g.skills.KN_TWOHANDQUICKEN ?? 0) > 0,
      concentration: (g.skills.LK_CONCENTRATION ?? 0) > 0,
      auraBlade: (g.skills.LK_AURABLADE ?? 0) > 0,
      // Only the leveling crit build plays around Frenzy; it blocks every skill.
      berserk: g.style === "crit" && g.goal === "leveling",
    },
    size: g.goal === "mvp" ? "Large" : "Medium",
  };
}

const sameSkills = (a: Build["skills"], b: Record<string, number>) => {
  const learned = (s: Build["skills"]) =>
    Object.entries(s)
      .filter(([, l]) => (l ?? 0) > 0)
      .sort(([x], [y]) => x.localeCompare(y))
      .join("|");
  return learned(a) === learned(b);
};

/** Which parts of a guide build the planner build still has. */
export function guideOverlap(build: Build, g: GuideBuild) {
  return {
    stats: (Object.keys(g.stats) as StatName[]).every((s) => g.stats[s] === build.stats[s]),
    skills: sameSkills(build.skills, g.skills),
    weapon: g.weaponType === build.weapon.type,
  };
}

/** The guide build the planner build is, unchanged: same stats, skills and weapon type. */
export function matchingGuideBuild(build: Build): GuideBuild | undefined {
  return GUIDE_BUILDS.find((g) => {
    const o = guideOverlap(build, g);
    return o.stats && o.skills && o.weapon;
  });
}
