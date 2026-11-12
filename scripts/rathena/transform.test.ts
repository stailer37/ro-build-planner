import { describe, expect, it } from "vitest";
import {
  buildJobs,
  buildRefine,
  buildSizeFix,
  buildSkillTree,
  buildTargetPresets,
  filterPresetMobs,
  levelArray,
  type Mob,
} from "./transform.ts";

describe("buildJobs", () => {
  const aspd = { Body: ["Novice_High", "Swordman_High", "Knight", "Lord_Knight"].map((j) => ({ Jobs: { [j]: true }, BaseASPD: { Fist: 400 } })) };

  it("exports SP growth with rAthena defaults for omitted fields", () => {
    const stats = { Body: [{ Jobs: { Lord_Knight: true }, SpIncrease: 300, BonusStats: [{ Level: 1, Str: 1 }] }] };
    const jobs = buildJobs(aspd, stats);
    expect(jobs.find((j) => j.job === "Lord_Knight")).toMatchObject({ spIncrease: 300, spFactor: 0 });
    expect(jobs.find((j) => j.job === "Knight")).toMatchObject({ spIncrease: 100, spFactor: 0, bonusStats: [] });
  });
});

describe("levelArray", () => {
  it("fills a scalar across all levels", () => {
    expect(levelArray(7, 3, "Amount")).toEqual([7, 7, 7]);
  });

  it("maps per-level entries and leaves gaps at 0", () => {
    const field = [
      { Level: 1, Time: 300 },
      { Level: 3, Time: 700 },
    ];
    expect(levelArray(field, 4, "Time")).toEqual([300, 0, 700, 0]);
  });

  it("returns zeros when the field is absent", () => {
    expect(levelArray(undefined, 2, "Time")).toEqual([0, 0]);
  });
});

describe("buildSizeFix", () => {
  it("defaults omitted sizes to 100", () => {
    const base = { Body: [{ Weapon: "Fist" }, { Weapon: "Dagger", Medium: 75, Large: 50 }] };
    expect(buildSizeFix(base, { Body: [] })).toEqual({
      Fist: { Small: 100, Medium: 100, Large: 100 },
      Dagger: { Small: 100, Medium: 75, Large: 50 },
    });
  });

  it("lets the pre-renewal layer override only the sizes it lists", () => {
    const base = { Body: [{ Weapon: "Whip", Small: 75 }] };
    const preRe = { Body: [{ Weapon: "Whip", Large: 50 }, { Weapon: "Knuckle", Medium: 75 }] };
    expect(buildSizeFix(base, preRe)).toEqual({
      Whip: { Small: 75, Medium: 100, Large: 50 },
      Knuckle: { Small: 100, Medium: 75, Large: 100 },
    });
  });
});

describe("buildRefine", () => {
  it("converts bonuses from hundredths and starts at +0", () => {
    const doc = {
      Body: [
        {
          Group: "Weapon",
          Levels: [{ Level: 1, RefineLevels: [{ Level: 1, Bonus: 200 }, { Level: 2, Bonus: 400, RandomBonus: 300 }] }],
        },
      ],
    };
    expect(buildRefine(doc, 2)["1"]).toEqual([
      { bonus: 0, randomBonus: 0 },
      { bonus: 2, randomBonus: 0 },
      { bonus: 4, randomBonus: 3 },
    ]);
  });
});

describe("buildSkillTree", () => {
  it("maps transcendent first jobs to the regular trees and drops excluded skills", () => {
    const doc = {
      Body: [
        { Job: "Novice", Tree: [{ Name: "NV_BASIC", MaxLevel: 9 }, { Name: "NV_TRICKDEAD", MaxLevel: 1, Exclude: true }] },
        { Job: "Swordman", Tree: [{ Name: "SM_TWOHAND", MaxLevel: 10, Requires: [{ Name: "SM_SWORD", Level: 1 }] }] },
        { Job: "Knight", Tree: [] },
        { Job: "Lord_Knight", Tree: [{ Name: "LK_BERSERK", MaxLevel: 1, JobLevel: 50 }] },
      ],
    };
    const [novice, swordman, , lordKnight] = buildSkillTree(doc);
    expect(novice?.skills.map((s) => s.name)).toEqual(["NV_BASIC"]);
    expect(swordman?.skills[0]?.requires).toEqual([{ name: "SM_SWORD", level: 1 }]);
    expect(lordKnight?.skills[0]?.jobLevel).toBe(50);
  });
});

describe("filterPresetMobs", () => {
  const base = { AegisName: "X", Level: 80, Size: "Medium" };

  it("keeps normal monsters inside the level range", () => {
    expect(filterPresetMobs({ Body: [base] })).toHaveLength(1);
  });

  it.each([
    ["boss class", { Class: "Boss" }],
    ["MVP mode", { Modes: { Mvp: true } }],
    ["plant", { Modes: { IgnoreMelee: true } }],
    ["event copy", { AegisName: "E_X" }],
    ["below range", { Level: 69 }],
    ["above range", { Level: 100 }],
    ["small below its range", { Size: "Small", Level: 49 }],
  ])("drops %s", (_, override) => {
    expect(filterPresetMobs({ Body: [{ ...base, ...override }] })).toHaveLength(0);
  });

  it("uses a lower minimum level for small monsters", () => {
    expect(filterPresetMobs({ Body: [{ ...base, Size: "Small", Level: 50 }] })).toHaveLength(1);
  });
});

describe("buildTargetPresets", () => {
  const mob = (o: Partial<Mob>): Mob => ({
    aegisName: "X", level: 80, hp: 1000, def: 10, vit: 10, agi: 10, luk: 10,
    size: "Small", race: "Brute", element: "Neutral", elementLevel: 1, ...o,
  });

  it("averages numbers and takes the most common categorical values per size", () => {
    const mobs = [
      mob({ def: 10, race: "Brute" }),
      mob({ def: 21, race: "Demon", element: "Dark", elementLevel: 2 }),
      mob({ def: 30, race: "Demon", element: "Dark", elementLevel: 2 }),
      mob({ size: "Medium" }),
      mob({ size: "Large" }),
    ];
    const small = buildTargetPresets(mobs)[0];
    expect(small).toMatchObject({ size: "Small", sampleSize: 3, def: 20, race: "Demon", element: "Dark", elementLevel: 2 });
  });
});
