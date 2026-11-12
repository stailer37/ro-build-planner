// Skill allocation as a dependency tree per job, with a detail panel for the selected skill.

import { useMemo, useState } from "react";
import { skillLevel, type Build } from "../core/build.ts";
import { getSkillData, type JobName } from "../core/data.ts";
import { OFFENSIVE_SKILLS, skillDamagePercent } from "../core/offensive.ts";
import {
  PLANNER_SKILLS,
  availableSkillPoints,
  getPlannerSkill,
  setSkillLevel,
  spentSkillPoints,
  type SkillStage,
} from "../core/skills.ts";
import { skillLabel } from "./labels.ts";
import { layoutJobTree, type TreeLayout, type TreeNode } from "./skillTreeLayout.ts";

const TABS: { job: JobName; short: string; label: string; stage: SkillStage }[] = [
  { job: "Novice_High", short: "Apr", label: "Aprendiz T.", stage: "novice" },
  { job: "Swordman_High", short: "Esp", label: "Espadachim T.", stage: "swordman" },
  { job: "Knight", short: "Cav", label: "Cavaleiro", stage: "lordKnight" },
  { job: "Lord_Knight", short: "Lor", label: "Lorde", stage: "lordKnight" },
];

const JOB_LABELS = Object.fromEntries(TABS.map((t) => [t.job, t.label])) as Record<JobName, string>;

// Grid geometry in px; nodes are centered in their cell, edges join tile edges.
const COL_W = 156;
const ROW_H = 158;
const TILE = 52;
const TILE_TOP = 6;
const EDGE_LANE = 14;
/** Empty band at the bottom of each row, used by edges that skip columns. */
const ROW_GAP = 16;
const JUMP_OFFSET = 6;

const OFFENSIVE = new Set(OFFENSIVE_SKILLS.map((s) => s.name));
const STOPWORDS = new Set(["com", "de", "em", "da", "do", "e"]);

/** Tile text from the pt-BR name: initials of up to three significant words, or two letters of one. */
function initials(name: string): string {
  const words = skillLabel(name)
    .split(/\s+/)
    .filter((w) => !STOPWORDS.has(w.toLowerCase()));
  const text = words.length > 1 ? words.slice(0, 3).map((w) => w[0]).join("") : (words[0] ?? "?").slice(0, 2);
  return text.toUpperCase();
}

const requirementsMet = (build: Build, name: string) =>
  getPlannerSkill(name).requires.every((r) => skillLevel(build, r.name) >= r.level);

export function SkillTree({ build, onChange }: { build: Build; onChange: (skills: Build["skills"]) => void }) {
  const [tab, setTab] = useState<JobName>("Knight");
  const layout = useMemo(() => layoutJobTree(tab), [tab]);
  const [selected, setSelected] = useState<string>("KN_TWOHANDQUICKEN");
  const current = layout.nodes.some((n) => n.skill.name === selected) ? selected : layout.nodes[0]?.skill.name;
  const set = (name: string, level: number) => onChange(setSkillLevel(build.skills, name, level));
  const stage = TABS.find((t) => t.job === tab)?.stage ?? "lordKnight";

  return (
    <div className="tree">
      <nav className="tree-tabs" aria-label="Classe">
        {TABS.map((t) => (
          <button
            key={t.job}
            type="button"
            className={t.job === tab ? "active" : ""}
            aria-pressed={t.job === tab}
            onClick={() => setTab(t.job)}
          >
            <span className="tree-tab-short">{t.short}</span>
            <span className="tree-tab-label">{t.label}</span>
            <PointsBadge build={build} stage={t.stage} />
          </button>
        ))}
      </nav>
      <div className="tree-canvas-scroll">
        <TreeCanvas build={build} layout={layout} selected={current} onSelect={setSelected} onSet={set} />
      </div>
      {current && <SkillDetail build={build} name={current} stage={stage} onSet={set} onSelect={setSelected} />}
      <footer className="tree-footer">
        <button
          type="button"
          className="ghost"
          onClick={() => {
            let skills = build.skills;
            for (const n of layout.nodes) skills = setSkillLevel(skills, n.skill.name, 0);
            onChange(skills);
          }}
        >
          Zerar {JOB_LABELS[tab]}
        </button>
      </footer>
    </div>
  );
}

function PointsBadge({ build, stage }: { build: Build; stage: SkillStage }) {
  const spent = spentSkillPoints(build.skills, stage);
  const available = availableSkillPoints(stage, build.jobLevel);
  return (
    <span className={spent > available ? "badge bad" : "badge"}>
      {spent}/{Number.isNaN(available) ? "—" : available}
    </span>
  );
}

const center = (n: TreeNode) => ({ x: n.col * COL_W + COL_W / 2, y: n.row * ROW_H + TILE_TOP + TILE / 2 });

function TreeCanvas({
  build,
  layout,
  selected,
  onSelect,
  onSet,
}: {
  build: Build;
  layout: TreeLayout;
  selected: string | undefined;
  onSelect: (name: string) => void;
  onSet: (name: string, level: number) => void;
}) {
  const byName = new Map(layout.nodes.map((n) => [n.skill.name, n]));
  const width = layout.cols * COL_W;
  const height = layout.rows * ROW_H;
  return (
    <div className="tree-canvas" style={{ width, height }}>
      <svg className="tree-edges" width={width} height={height} aria-hidden="true">
        <defs>
          <marker id="tree-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto">
            <path d="M0 0 L8 4 L0 8 z" className="tree-arrow" />
          </marker>
        </defs>
        {layout.edges.map((e) => {
          const from = byName.get(e.from);
          const to = byName.get(e.to);
          if (!from || !to) return null;
          // Spread several incoming edges vertically so their labels do not overlap.
          const incoming = layout.edges.filter((x) => x.to === e.to);
          const lane = incoming.indexOf(e) - (incoming.length - 1) / 2;
          const a = center(from);
          const b = center(to);
          const x1 = a.x + TILE / 2;
          const x2 = b.x - TILE / 2 - 2;
          const y2 = b.y + lane * EDGE_LANE;
          // Vertical runs use the column boundaries, which node names never reach.
          const xChild = to.col * COL_W;
          let d: string;
          if (to.col - from.col === 1) {
            d = `M${x1} ${a.y} H${xChild} V${y2} H${x2}`;
          } else {
            // Longer jumps travel in the gap under a row, so they do not cross other skills, and
            // run their vertical parts a few px off the boundaries used by adjacent edges.
            const xParent = (from.col + 1) * COL_W - JUMP_OFFSET;
            const xEnter = xChild - JUMP_OFFSET;
            const channel = (Math.min(from.row, to.row) + 1) * ROW_H - ROW_GAP / 2;
            d = `M${x1} ${a.y} H${xParent} V${channel} H${xEnter} V${y2} H${x2}`;
          }
          const met = skillLevel(build, e.from) >= e.level;
          return (
            <g key={`${e.from}-${e.to}`} className={met ? "tree-edge met" : "tree-edge"}>
              <path d={d} markerEnd="url(#tree-arrow)" />
              <g transform={`translate(${x2 - 22} ${y2})`}>
                <rect x={-18} y={-8} width={36} height={16} rx={8} />
                <text textAnchor="middle" dominantBaseline="central">
                  Nv. {e.level}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
      {layout.nodes.map((n) => (
        <SkillNode key={n.skill.name} build={build} node={n} selected={n.skill.name === selected} onSelect={onSelect} onSet={onSet} />
      ))}
    </div>
  );
}

function SkillNode({
  build,
  node,
  selected,
  onSelect,
  onSet,
}: {
  build: Build;
  node: TreeNode;
  selected: boolean;
  onSelect: (name: string) => void;
  onSet: (name: string, level: number) => void;
}) {
  const { skill } = node;
  const level = skillLevel(build, skill.name);
  const locked = level === 0 && !requirementsMet(build, skill.name);
  const externalMet = node.external.every((r) => skillLevel(build, r.name) >= r.level);
  const classes = [
    "skill-tile",
    OFFENSIVE.has(skill.name) ? "offensive" : "",
    level > 0 ? "learned" : "",
    locked ? "locked" : "",
    selected ? "selected" : "",
  ].join(" ");
  return (
    <div className="skill-node" style={{ left: node.col * COL_W, top: node.row * ROW_H, width: COL_W }}>
      <button type="button" className={classes} onClick={() => onSelect(skill.name)} aria-pressed={selected} aria-label={skillLabel(skill.name)}>
        {initials(skill.name)}
        {node.external.length > 0 && (
          <span
            className={externalMet ? "skill-ext met" : "skill-ext"}
            title={`Requer: ${node.external.map((r) => `${skillLabel(r.name)} nv. ${r.level}`).join(", ")}`}
          >
            +{node.external.length}
          </span>
        )}
        <span className="skill-pips" aria-hidden="true">
          <span style={{ width: `${(100 * level) / skill.maxLevel}%` }} />
        </span>
      </button>
      <span className={selected ? "skill-name selected" : "skill-name"}>{skillLabel(skill.name)}</span>
      {skill.isQuest && <span className="tag">missão</span>}
      <span className="stepper">
        <button type="button" aria-label={`Diminuir ${skillLabel(skill.name)}`} disabled={level === 0} onClick={() => onSet(skill.name, level - 1)}>
          ‹
        </button>
        <span>
          {level}/{skill.maxLevel}
        </span>
        <button
          type="button"
          aria-label={`Aumentar ${skillLabel(skill.name)}`}
          disabled={level === skill.maxLevel}
          title={locked ? "Aprende os pré-requisitos automaticamente" : undefined}
          onClick={() => onSet(skill.name, level + 1)}
        >
          ›
        </button>
      </span>
    </div>
  );
}

function freePoints(n: number): string {
  const free = Math.max(n, 0);
  return free === 1 ? "1 ponto livre" : `${free} pontos livres`;
}

const ms = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

function SkillDetail({
  build,
  name,
  stage,
  onSet,
  onSelect,
}: {
  build: Build;
  name: string;
  stage: SkillStage;
  onSet: (name: string, level: number) => void;
  onSelect: (name: string) => void;
}) {
  const skill = getPlannerSkill(name);
  const data = getSkillData(name);
  const level = skillLevel(build, name);
  const dependents = PLANNER_SKILLS.flatMap((s) => s.requires.filter((r) => r.name === name).map((r) => ({ name: s.name, level: r.level })));
  const levels = Array.from({ length: skill.maxLevel }, (_, i) => i + 1);
  const damage = levels.map((l) => skillDamagePercent(name, l));
  const cast = levels.map((l) => data.castTime[l - 1] ?? 0);
  const delay = levels.map((l) => data.afterCastActDelay[l - 1] ?? 0);
  const sp = levels.map((l) => data.spCost[l - 1] ?? 0);
  const show = {
    damage: damage.some((d) => d !== undefined),
    cast: cast.some((c) => c > 0),
    delay: delay.some((d) => d > 0),
    sp: sp.some((c) => c > 0),
  };
  const spent = spentSkillPoints(build.skills, stage);
  const available = availableSkillPoints(stage, build.jobLevel);

  return (
    <aside className="skill-detail" aria-label="Detalhes da habilidade">
      <header>
        <h3>
          {skillLabel(name)}
          {skill.isQuest && <span className="tag">missão</span>}
        </h3>
        <p className="muted small">
          {JOB_LABELS[skill.job]} · nível {level}/{skill.maxLevel}
          {skill.isQuest ? " · não gasta pontos" : ` · ${freePoints(available - spent)}`}
        </p>
        <div className="detail-actions">
          <button type="button" className="ghost" disabled={level === 0} onClick={() => onSet(name, level - 1)}>
            −
          </button>
          <button type="button" className="ghost" disabled={level === skill.maxLevel} onClick={() => onSet(name, level + 1)}>
            +
          </button>
          <button type="button" className="ghost" disabled={level === skill.maxLevel} onClick={() => onSet(name, skill.maxLevel)}>
            Máx
          </button>
          <button type="button" className="ghost" disabled={level === 0} onClick={() => onSet(name, 0)}>
            Zerar
          </button>
        </div>
      </header>

      <section>
        <h4>Pré-requisitos</h4>
        {skill.requires.length === 0 ? (
          <p className="muted small">Nenhum.</p>
        ) : (
          <ul className="req-list">
            {skill.requires.map((r) => {
              const have = skillLevel(build, r.name);
              return (
                <li key={r.name} className={have >= r.level ? "ok" : "bad"}>
                  <span aria-hidden="true">{have >= r.level ? "✓" : "✗"}</span>
                  <button type="button" className="link" onClick={() => onSelect(r.name)}>
                    {skillLabel(r.name)} nv. {r.level}
                  </button>
                  <span className="muted">(você: {have})</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {dependents.length > 0 && (
        <section>
          <h4>Libera</h4>
          <ul className="req-list">
            {dependents.map((d) => (
              <li key={d.name}>
                <span className="muted">nv. {d.level} →</span>
                <button type="button" className="link" onClick={() => onSelect(d.name)}>
                  {skillLabel(d.name)}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(show.damage || show.cast || show.delay || show.sp || name === "LK_SPIRALPIERCE") && (
        <section>
          <h4>Por nível</h4>
          {name === "LK_SPIRALPIERCE" && <p className="muted small">Dano pelo peso da arma: +50% por nível, 5 golpes, ignora DEF.</p>}
          <table className="level-table">
            <thead>
              <tr>
                <th>Nv.</th>
                {show.damage && <th>Dano</th>}
                {show.sp && <th>SP</th>}
                {show.cast && <th>Conj.</th>}
                {show.delay && <th>Pós</th>}
              </tr>
            </thead>
            <tbody>
              {levels.map((l, i) => (
                <tr key={l} className={l === level ? "current" : ""}>
                  <td>{l}</td>
                  {show.damage && <td>{damage[i] !== undefined ? `${damage[i]}%` : "—"}</td>}
                  {show.sp && <td>{sp[i]}</td>}
                  {show.cast && <td>{ms.format((cast[i] ?? 0) / 1000)} s</td>}
                  {show.delay && <td>{ms.format((delay[i] ?? 0) / 1000)} s</td>}
                </tr>
              ))}
            </tbody>
          </table>
          {show.cast && <p className="muted small">Conjuração antes da redução por DES.</p>}
        </section>
      )}
    </aside>
  );
}
