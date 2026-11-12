import { describe, expect, it } from "vitest";
import { DEFAULT_INPUTS, decodeInputs, encodeInputs, hashFor, inputsFromHash } from "./share.ts";

describe("encodeInputs / decodeInputs", () => {
  it("round-trips the inputs", () => {
    expect(decodeInputs(encodeInputs(DEFAULT_INPUTS))).toEqual(DEFAULT_INPUTS);
  });

  it("keeps an emptied numeric field as NaN", () => {
    const inputs = { ...DEFAULT_INPUTS, build: { ...DEFAULT_INPUTS.build, baseLevel: Number.NaN } };
    expect(decodeInputs(encodeInputs(inputs))?.build.baseLevel).toBeNaN();
  });

  it("falls back to defaults for malformed fields and drops unknown skills", () => {
    const code = btoa(
      JSON.stringify({
        build: { baseLevel: "99", weapon: { type: "Laser", atk: 200 }, skills: { KN_PIERCE: 3, FAKE_SKILL: 5, SM_BASH: -1 } },
        size: "Huge",
      }),
    );
    const inputs = decodeInputs(code);
    expect(inputs?.build.baseLevel).toBe(DEFAULT_INPUTS.build.baseLevel);
    expect(inputs?.build.weapon.type).toBe(DEFAULT_INPUTS.build.weapon.type);
    expect(inputs?.build.weapon.atk).toBe(200);
    expect(inputs?.build.skills).toEqual({ KN_PIERCE: 3 });
    expect(inputs?.size).toBe(DEFAULT_INPUTS.size);
    expect(inputs?.buffs).toEqual(DEFAULT_INPUTS.buffs);
  });

  it("returns null for text that is not an encoded build", () => {
    expect(decodeInputs("%%%")).toBeNull();
    expect(decodeInputs(btoa("[1, 2]"))).toBeNull();
  });
});

describe("inputsFromHash", () => {
  it("reads the hash written by hashFor and ignores other hashes", () => {
    expect(inputsFromHash(hashFor(DEFAULT_INPUTS))).toEqual(DEFAULT_INPUTS);
    expect(inputsFromHash("#resultados")).toBeNull();
    expect(inputsFromHash("")).toBeNull();
  });
});
