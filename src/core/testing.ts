// Shared fixtures for core unit tests.

import type { Build, Stats } from "./build.ts";
import type { Target } from "./target.ts";

export const stats = (o: Partial<Stats> = {}): Stats => ({ Str: 1, Agi: 1, Vit: 1, Int: 1, Dex: 1, Luk: 1, ...o });

export const build = (o: Partial<Build> = {}): Build => ({
  baseLevel: 99,
  jobLevel: 70,
  stats: stats(),
  skills: {},
  weapon: { type: "2hSword", atk: 100, level: 4, refine: 0, weight: 100, element: "Neutral" },
  riding: false,
  ...o,
});

export const target = (o: Partial<Target> = {}): Target => ({
  level: 80,
  def: 0,
  vit: 0,
  agi: 0,
  luk: 0,
  size: "Medium",
  race: "Formless",
  element: "Neutral",
  elementLevel: 1,
  ...o,
});
