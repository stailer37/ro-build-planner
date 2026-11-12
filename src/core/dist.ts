// Exact discrete probability distributions over integers. Damage formulas mix
// random terms with truncating divisions, so the mean is computed by carrying the
// whole distribution through each step instead of plugging in average values.

export type Dist = ReadonlyMap<number, number>;

export function constant(value: number): Dist {
  return new Map([[value, 1]]);
}

/** Uniform over the integers min..max (inclusive). */
export function uniform(min: number, max: number): Dist {
  if (max < min) throw new Error(`Empty range ${min}..${max}`);
  const p = 1 / (max - min + 1);
  const out = new Map<number, number>();
  for (let v = min; v <= max; v++) out.set(v, p);
  return out;
}

export function map(d: Dist, f: (value: number) => number): Dist {
  const out = new Map<number, number>();
  for (const [v, p] of d) {
    const r = f(v);
    out.set(r, (out.get(r) ?? 0) + p);
  }
  return out;
}

/** Distribution of the sum of two independent variables. */
export function add(a: Dist, b: Dist): Dist {
  const out = new Map<number, number>();
  for (const [va, pa] of a) {
    for (const [vb, pb] of b) out.set(va + vb, (out.get(va + vb) ?? 0) + pa * pb);
  }
  return out;
}

/** Distribution of a - b for independent variables. */
export function sub(a: Dist, b: Dist): Dist {
  return add(a, map(b, (v) => -v));
}

export function mean(d: Dist): number {
  let total = 0;
  for (const [v, p] of d) total += v * p;
  return total;
}

export function min(d: Dist): number {
  return Math.min(...d.keys());
}

export function max(d: Dist): number {
  return Math.max(...d.keys());
}
