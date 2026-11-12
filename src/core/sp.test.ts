import { describe, expect, it } from "vitest";
import { NO_EFFECTS } from "./build.ts";
import { getJob, type JobData } from "./data.ts";
import { baseSp, maxSp, skillSustain, spStatus, type SpStatus } from "./sp.ts";
import { stats } from "./testing.ts";

describe("baseSp", () => {
  it("grows by SpIncrease / 100 per level for the Lord Knight", () => {
    expect(baseSp(getJob("Lord_Knight"), 99)).toBe(307); // 10 + 99 * 3
  });

  it("adds the rounded SpFactor term from level 2", () => {
    const job: JobData = { ...getJob("Lord_Knight"), spIncrease: 100, spFactor: 50 };
    expect(baseSp(job, 3)).toBe(16); // 10 + 3 + round(1) + round(1.5)
  });
});

describe("maxSp", () => {
  it("scales base SP by 1% per INT and by 125% for transcendents, truncated", () => {
    expect(maxSp(99, 0)).toBe(383); // 307 * 1.25 = 383.75
    expect(maxSp(99, 13)).toBe(433); // 307 * 1.13 * 1.25 = 433.64
  });
});

describe("spStatus", () => {
  it("regenerates 1 + INT/6 + MaxSP/100 every 8 seconds", () => {
    const sp = spStatus(stats({ Int: 13 }), 99, NO_EFFECTS);
    expect(sp).toEqual({ max: 433, regenPerTick: 7, regenPerSecond: 0.875 });
  });

  it("adds the high INT bonus from 120 INT", () => {
    // max = 307 * 2.3 * 1.25 = 882; 1 + 21 + 8 + (5 + 4)
    expect(spStatus(stats({ Int: 130 }), 99, NO_EFFECTS).regenPerTick).toBe(39);
  });

  it("stops regen under Frenzy", () => {
    expect(spStatus(stats({ Int: 13 }), 99, { ...NO_EFFECTS, berserk: true }).regenPerSecond).toBe(0);
  });
});

describe("skillSustain", () => {
  const sp: SpStatus = { max: 400, regenPerTick: 8, regenPerSecond: 1 };

  it("lasts MaxSP / (cost - regen) and mixes in normal attacks for the rest", () => {
    const r = skillSustain(5000, 50, 1000, sp);
    expect(r.fullSpDuration).toBeCloseTo(400 / 49);
    expect(r.sustainedShare).toBeCloseTo(0.02);
    expect(r.sustainedDps).toBeCloseTo(0.02 * 5000 + 0.98 * 1000);
  });

  it("keeps the skill up indefinitely when regen covers the cost", () => {
    expect(skillSustain(800, 0.5, 1000, sp)).toEqual({ fullSpDuration: Infinity, sustainedShare: 1, sustainedDps: 800 });
  });
});
