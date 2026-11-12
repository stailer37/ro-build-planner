// Generic monster target and its derived status (rAthena pre-renewal mob formulas).

import { targetPresets, type Element, type Size } from "./data.ts";

export interface Target {
  level: number;
  /** Hard DEF (mob_db Defense), a percentage reduction capped at 100. */
  def: number;
  vit: number;
  agi: number;
  luk: number;
  size: Size;
  race: string;
  element: Element;
  elementLevel: number;
}

export function presetTarget(size: Size): Target {
  const p = targetPresets.find((t) => t.size === size);
  if (!p) throw new Error(`No preset for ${size}`);
  return {
    level: p.level,
    def: p.def,
    vit: p.vit,
    agi: p.agi,
    luk: p.luk,
    size: p.size,
    race: p.race,
    element: p.element,
    elementLevel: p.elementLevel,
  };
}

/** status_calc_misc for mobs: FLEE = level + AGI, soft DEF = VIT. */
export function targetStatus(t: Target) {
  return { flee: t.level + t.agi, def2: t.vit };
}
