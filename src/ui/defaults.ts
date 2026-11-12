// Starting point shown when the planner opens: a two-handed sword Lord Knight at 99/70.

import type { Build } from "../core/build.ts";
import { NO_BUFFS, type Buffs } from "../core/buffs.ts";
import type { Size } from "../core/data.ts";

export const DEFAULT_BUILD: Build = {
  baseLevel: 99,
  jobLevel: 70,
  stats: { Str: 95, Agi: 85, Vit: 30, Int: 1, Dex: 40, Luk: 10 },
  skills: {
    NV_BASIC: 9,
    // Swordman: 49 points.
    SM_SWORD: 1,
    SM_TWOHAND: 10,
    SM_RECOVERY: 10,
    SM_BASH: 10,
    SM_PROVOKE: 5,
    SM_MAGNUM: 5,
    SM_ENDURE: 8,
    // Knight and Lord Knight: 68 of 69 points.
    KN_TWOHANDQUICKEN: 10,
    KN_AUTOCOUNTER: 5,
    KN_BOWLINGBASH: 10,
    KN_RIDING: 1,
    KN_CAVALIERMASTERY: 5,
    KN_SPEARMASTERY: 5,
    KN_PIERCE: 10,
    LK_AURABLADE: 5,
    LK_CONCENTRATION: 5,
    LK_BERSERK: 1,
    LK_PARRYING: 10,
    LK_TENSIONRELAX: 1,
  },
  weapon: { type: "2hSword", atk: 180, level: 3, refine: 7, weight: 250, element: "Neutral" },
  riding: false,
};

export const DEFAULT_BUFFS: Buffs = {
  ...NO_BUFFS,
  twoHandQuicken: true,
  concentration: true,
  auraBlade: true,
  blessing: 10,
  increaseAgi: 10,
  aspdPotion: "awakening",
};

export const DEFAULT_TARGET_SIZE: Size = "Medium";
