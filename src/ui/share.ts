// Planner inputs in the URL hash, so a build survives a reload and can be shared as a link.

import { WEAPON_TYPES, type Build } from "../core/build.ts";
import { ASPD_POTIONS, type Buffs } from "../core/buffs.ts";
import { ELEMENTS, SIZES, STAT_NAMES, type Size } from "../core/data.ts";
import { PLANNER_SKILLS } from "../core/skills.ts";
import { DEFAULT_BUFFS, DEFAULT_BUILD, DEFAULT_TARGET_SIZE } from "./defaults.ts";

export interface Inputs {
  build: Build;
  buffs: Buffs;
  size: Size;
}

export const DEFAULT_INPUTS: Inputs = { build: DEFAULT_BUILD, buffs: DEFAULT_BUFFS, size: DEFAULT_TARGET_SIZE };

const HASH_KEY = "b=";
const SKILL_NAMES = new Set(PLANNER_SKILLS.map((s) => s.name));

/** URL-safe base64 of the inputs as JSON. NaN (an emptied field) is stored as null. */
export function encodeInputs(inputs: Inputs): string {
  const bytes = new TextEncoder().encode(JSON.stringify(inputs));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Inputs from encodeInputs output. Every field is checked against the defaults' shape: a missing
 * or malformed one (old link, hand-edited URL) falls back to its default instead of breaking the page.
 */
export function decodeInputs(code: string): Inputs | null {
  let raw: unknown;
  try {
    const binary = atob(code.replace(/-/g, "+").replace(/_/g, "/"));
    raw = JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))));
  } catch {
    return null;
  }
  if (!isRecord(raw)) return null;
  const build = isRecord(raw.build) ? raw.build : {};
  const weapon = isRecord(build.weapon) ? build.weapon : {};
  const stats = isRecord(build.stats) ? build.stats : {};
  const skills = isRecord(build.skills) ? build.skills : {};
  const buffs = isRecord(raw.buffs) ? raw.buffs : {};
  const d = DEFAULT_BUILD;
  return {
    build: {
      baseLevel: number(build.baseLevel, d.baseLevel),
      jobLevel: number(build.jobLevel, d.jobLevel),
      stats: Object.fromEntries(STAT_NAMES.map((s) => [s, number(stats[s], d.stats[s])])) as Build["stats"],
      skills: Object.fromEntries(
        Object.entries(skills).filter(
          (e): e is [string, number] => SKILL_NAMES.has(e[0]) && typeof e[1] === "number" && Number.isInteger(e[1]) && e[1] > 0,
        ),
      ),
      weapon: {
        type: oneOf(weapon.type, WEAPON_TYPES, d.weapon.type),
        atk: number(weapon.atk, d.weapon.atk),
        level: number(weapon.level, d.weapon.level),
        refine: number(weapon.refine, d.weapon.refine),
        weight: number(weapon.weight, d.weapon.weight),
        element: oneOf(weapon.element, ELEMENTS, d.weapon.element),
      },
      riding: bool(build.riding, d.riding),
    },
    buffs: {
      twoHandQuicken: bool(buffs.twoHandQuicken, DEFAULT_BUFFS.twoHandQuicken),
      concentration: bool(buffs.concentration, DEFAULT_BUFFS.concentration),
      auraBlade: bool(buffs.auraBlade, DEFAULT_BUFFS.auraBlade),
      berserk: bool(buffs.berserk, DEFAULT_BUFFS.berserk),
      blessing: number(buffs.blessing, DEFAULT_BUFFS.blessing),
      increaseAgi: number(buffs.increaseAgi, DEFAULT_BUFFS.increaseAgi),
      impositio: number(buffs.impositio, DEFAULT_BUFFS.impositio),
      gloria: bool(buffs.gloria, DEFAULT_BUFFS.gloria),
      aspdPotion: oneOf(buffs.aspdPotion, ASPD_POTIONS, DEFAULT_BUFFS.aspdPotion),
    },
    size: oneOf(raw.size, SIZES, DEFAULT_TARGET_SIZE),
  };
}

/** Inputs in a location hash such as "#b=…", or null when there are none or they do not decode. */
export function inputsFromHash(hash: string): Inputs | null {
  const body = hash.replace(/^#/, "");
  return body.startsWith(HASH_KEY) ? decodeInputs(body.slice(HASH_KEY.length)) : null;
}

export const hashFor = (inputs: Inputs) => `#${HASH_KEY}${encodeInputs(inputs)}`;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
// null is an emptied numeric field: kept as NaN so validation reports it, as when it was saved.
const number = (v: unknown, fallback: number) => (v === null ? Number.NaN : typeof v === "number" ? v : fallback);
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
  options.includes(v as T) ? (v as T) : fallback;
