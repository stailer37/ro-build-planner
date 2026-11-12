// Downloads rAthena pre-renewal databases at a pinned commit and writes the JSON
// consumed by src/core. Run with `npm run extract`; output is committed.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import {
  EXTRA_SKILLS,
  PRESET_LEVEL_RANGE,
  buildAttrFix,
  buildJobs,
  buildRefine,
  buildSizeFix,
  buildSkillTree,
  buildSkills,
  buildStatPoints,
  buildTargetPresets,
  filterPresetMobs,
} from "./rathena/transform.ts";

// Bump deliberately: formulas in src/core are checked against this revision.
export const RATHENA_COMMIT = "1ca3e7700939ea40120cb51a777f8681ba5e84ae";

const FILES = [
  "attr_fix",
  "job_aspd",
  "job_stats",
  "mob_db",
  "refine",
  "size_fix",
  "skill_db",
  "skill_tree",
  "statpoint",
] as const;
type DbFile = (typeof FILES)[number];

// Files whose db/ base layer has content of its own; the others only import db/pre-re.
const BASE_FILES = ["size_fix"] as const;

const CACHE_DIR = join(".cache", "rathena", RATHENA_COMMIT);
const OUT_DIR = join("src", "data");

async function load(file: string, layer: "pre-re" | "base" = "pre-re"): Promise<unknown> {
  const path = join(CACHE_DIR, layer === "base" ? `base_${file}.yml` : `${file}.yml`);
  if (!existsSync(path)) {
    const dir = layer === "base" ? "db" : "db/pre-re";
    const url = `https://raw.githubusercontent.com/rathena/rathena/${RATHENA_COMMIT}/${dir}/${file}.yml`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
    await writeFile(path, await res.text());
  }
  return parse(await readFile(path, "utf8"), { maxAliasCount: -1 });
}

async function write(name: string, data: unknown) {
  await writeFile(join(OUT_DIR, `${name}.json`), JSON.stringify(data, null, 2) + "\n");
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });
  await mkdir(OUT_DIR, { recursive: true });
  const db = Object.fromEntries(
    await Promise.all(FILES.map(async (f) => [f, await load(f)] as const)),
  ) as Record<DbFile, unknown>;
  const baseSizeFix = await load(BASE_FILES[0], "base");

  const tree = buildSkillTree(db.skill_tree);
  const skillNames = new Set<string>([
    ...tree.flatMap((t) => t.skills.map((s) => s.name)),
    ...EXTRA_SKILLS,
  ]);
  const mobs = filterPresetMobs(db.mob_db);
  const presets = buildTargetPresets(mobs);

  await write("jobs", buildJobs(db.job_aspd, db.job_stats));
  await write("statPoints", buildStatPoints(db.statpoint));
  await write("skillTree", tree);
  await write("skills", buildSkills(db.skill_db, skillNames));
  await write("sizeFix", buildSizeFix(baseSizeFix, db.size_fix));
  await write("attrFix", buildAttrFix(db.attr_fix));
  await write("refine", buildRefine(db.refine));
  await write("targetPresets", presets);
  await write("meta", {
    rathenaCommit: RATHENA_COMMIT,
    ruleset: "pre-re",
    sourceFiles: [...BASE_FILES.map((f) => `db/${f}.yml`), ...FILES.map((f) => `db/pre-re/${f}.yml`)],
    presetFilter: {
      levelRange: PRESET_LEVEL_RANGE,
      excludes: "Boss/Guardian/Battlefield class, MVP, Treasure, Ignore* modes, E_/G_/C?_/MD_/I_ copies",
    },
  });

  console.log(`skills: ${skillNames.size}, preset mobs: ${mobs.length}`);
  for (const p of presets) console.log(`  ${p.size}: n=${p.sampleSize} lv=${p.level} def=${p.def} vit=${p.vit} agi=${p.agi} ${p.element}${p.elementLevel} ${p.race}`);
}

await main();
