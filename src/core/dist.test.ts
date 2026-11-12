import { describe, expect, it } from "vitest";
import { add, constant, map, max, mean, min, sub, uniform } from "./dist.ts";

describe("dist", () => {
  it("builds uniform integer ranges", () => {
    const d = uniform(1, 4);
    expect([...d.keys()]).toEqual([1, 2, 3, 4]);
    expect(mean(d)).toBeCloseTo(2.5);
  });

  it("maps values through truncating functions and merges collisions", () => {
    const d = map(uniform(0, 3), (v) => Math.trunc(v / 2));
    expect(d.get(0)).toBeCloseTo(0.5);
    expect(d.get(1)).toBeCloseTo(0.5);
  });

  it("convolves independent sums and differences", () => {
    const two = add(uniform(1, 6), uniform(1, 6));
    expect(two.get(7)).toBeCloseTo(6 / 36);
    expect(mean(sub(constant(10), uniform(1, 3)))).toBeCloseTo(8);
    expect([min(two), max(two)]).toEqual([2, 12]);
  });
});
