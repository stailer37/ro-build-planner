import { describe, expect, it } from "vitest";
import { validateWeapon, type Weapon } from "./build.ts";

const weapon = (o: Partial<Weapon> = {}): Weapon => ({ type: "2hSword", atk: 160, level: 4, refine: 7, element: "Neutral", ...o });

describe("validateWeapon", () => {
  it("accepts a valid weapon", () => {
    expect(validateWeapon(weapon())).toEqual([]);
  });

  it("rejects out-of-range level, refine and ATK", () => {
    expect(validateWeapon(weapon({ atk: -1, level: 5, refine: 11 })).map((i) => i.code)).toEqual([
      "weaponAtkOutOfRange",
      "weaponLevelOutOfRange",
      "refineOutOfRange",
    ]);
  });

  it("ignores ATK, level and refine for bare hands", () => {
    expect(validateWeapon(weapon({ type: "Fist", atk: -1, level: 0, refine: 99 }))).toEqual([]);
  });
});
