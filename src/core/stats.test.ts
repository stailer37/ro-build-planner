import { describe, expect, it } from "vitest";
import { NO_EFFECTS, type Build } from "./build.ts";
import type { JobData } from "./data.ts";
import {
  availableStatPoints,
  derivedStatus,
  jobBonusStats,
  spentStatPoints,
  statPointCost,
  statPointsToReach,
  totalStats,
  validateStats,
} from "./stats.ts";

const build = (o: Partial<Build> = {}): Build => ({
  baseLevel: 99,
  jobLevel: 70,
  stats: { Str: 1, Agi: 1, Vit: 1, Int: 1, Dex: 1, Luk: 1 },
  skills: {},
  weapon: { type: "2hSword" },
  riding: false,
  ...o,
});

describe("status point cost", () => {
  it.each([
    [1, 2],
    [10, 2],
    [11, 3],
    [90, 10],
    [91, 11],
    [98, 11],
  ])("costs %i -> +1 = %i", (low, cost) => {
    expect(statPointCost(low)).toBe(cost);
  });

  it("costs 628 points to raise a stat from 1 to 99", () => {
    expect(statPointsToReach(99)).toBe(628);
    expect(statPointsToReach(1)).toBe(0);
  });

  it("gives a transcendent level 99 character 1273 + 52 points", () => {
    expect(availableStatPoints(99)).toBe(1325);
    expect(availableStatPoints(1)).toBe(100);
  });
});

describe("job bonus", () => {
  const job: JobData = {
    job: "Lord_Knight",
    baseAspd: {},
    bonusStats: [
      { level: 1, stats: { Str: 1 } },
      { level: 3, stats: { Str: 1, Agi: 1 } },
      { level: 5, stats: { Dex: 1 } },
    ],
  };

  it("accumulates bonuses up to and including the job level", () => {
    expect(jobBonusStats(job, 3)).toEqual({ Str: 2, Agi: 1, Vit: 0, Int: 0, Dex: 0, Luk: 0 });
  });

  it("matches the rAthena Lord Knight table at job level 70", () => {
    const stats = totalStats(build(), NO_EFFECTS);
    expect(stats).toEqual({ Str: 16, Agi: 9, Vit: 9, Int: 3, Dex: 10, Luk: 4 });
  });

  it("adds buff stat bonuses on top", () => {
    const stats = totalStats(build(), { ...NO_EFFECTS, statBonus: { Str: 10, Agi: 12 } });
    expect(stats.Str).toBe(26);
    expect(stats.Agi).toBe(21);
  });
});

describe("derived status", () => {
  it("follows the pre-renewal status_calc_misc formulas", () => {
    const d = derivedStatus({ Str: 99, Agi: 90, Vit: 30, Int: 1, Dex: 47, Luk: 31 }, 99);
    expect(d).toEqual({
      batk: 99 + 81 + 9 + 6, // STR + (STR/10)^2 + DEX/5 + LUK/5
      hit: 99 + 47,
      flee: 99 + 90,
      cri: 10 + 103, // 10 + LUK*10/3, truncated
      flee2: 31 + 10,
      def2: 30,
    });
  });
});

describe("validateStats", () => {
  it("accepts a build within the point budget", () => {
    expect(validateStats(build({ stats: { Str: 99, Agi: 1, Vit: 1, Int: 1, Dex: 1, Luk: 1 } }))).toEqual([]);
  });

  it("rejects spending more points than available", () => {
    const stats = { Str: 99, Agi: 99, Vit: 1, Int: 1, Dex: 1, Luk: 1 };
    expect(spentStatPoints(stats)).toBe(1256);
    expect(validateStats(build({ baseLevel: 90, stats }))).toEqual([
      { code: "notEnoughStatPoints", spent: 1256, available: availableStatPoints(90) },
    ]);
  });

  it("rejects stats and levels out of range", () => {
    const issues = validateStats(build({ baseLevel: 100, jobLevel: 0, stats: { Str: 100, Agi: 0, Vit: 1, Int: 1, Dex: 1, Luk: 1 } }));
    expect(issues.map((i) => i.code)).toEqual([
      "baseLevelOutOfRange",
      "jobLevelOutOfRange",
      "statOutOfRange",
      "statOutOfRange",
    ]);
  });
});
