import { useEffect, useId, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  MAX_BASE_LEVEL,
  MAX_JOB_LEVEL,
  MAX_REFINE,
  MAX_WEAPON_LEVEL,
  BASE_STAT_MAX,
  BASE_STAT_MIN,
  WEAPON_TYPES,
  skillLevel,
  type Build,
  type Weapon,
} from "../core/build.ts";
import {
  ASPD_POTIONS,
  MAX_BLESSING,
  MAX_IMPOSITIO,
  MAX_INCREASE_AGI,
  SELF_BUFF_SKILLS,
  resolveEffects,
  type Buffs,
  type SelfBuff,
} from "../core/buffs.ts";
import { ELEMENTS, SIZES, STAT_NAMES, getJob, targetPresets, type Size } from "../core/data.ts";
import type { SkillUnavailable } from "../core/offensive.ts";
import { calculate, type PlanOutcome, type PlannedSkill } from "../core/plan.ts";
import { SP_REGEN_INTERVAL, type SpStatus } from "../core/sp.ts";
import { SKILL_STAGES, availableSkillPoints, spentSkillPoints } from "../core/skills.ts";
import { availableStatPoints, jobBonusStats, spentStatPoints, statPointCost } from "../core/stats.ts";
import { presetTarget } from "../core/target.ts";
import meta from "../data/meta.json";
import {
  GOAL_LABELS,
  STYLE_LABELS,
  applyGuideBuild,
  findGuideBuild,
  guideOverlap,
  matchingGuideBuild,
  type GuideBuild,
  type GuideGoal,
  type GuideStyle,
} from "./guide.ts";
import { edit, initHistory, redo, undo } from "./history.ts";
import { SkillTree } from "./SkillTree.tsx";
import {
  ELEMENT_LABELS,
  POTION_LABELS,
  RACE_LABELS,
  SIZE_LABELS,
  STAT_LABELS,
  WEAPON_LABELS,
  issueMessage,
  skillLabel,
} from "./labels.ts";
import { DEFAULT_INPUTS, hashFor, inputsFromHash, type Inputs } from "./share.ts";

const num = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const sec = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
const signedPct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0, signDisplay: "exceptZero" });
const range = (n: number, from = 0) => Array.from({ length: n - from + 1 }, (_, i) => from + i);

export function App() {
  const [hist, setHist] = useState(() => initHistory(inputsFromHash(location.hash) ?? DEFAULT_INPUTS));
  const inputs = hist.present;
  const { build, buffs, size } = inputs;
  const setInputs = (update: (s: Inputs) => Inputs) => setHist((h) => edit(h, update(h.present), performance.now()));
  useUrlSync(inputs, (loaded) => setInputs(() => loaded));
  useUndoKeys(() => setHist(undo), () => setHist(redo));
  // Recalculated on every change, so each tweak shows its effect right away.
  const outcome = useMemo(() => calculate(build, buffs, presetTarget(size)), [build, buffs, size]);
  const delta = useDpsDelta(outcome);

  const setBuild = (patch: Partial<Build>) => setInputs((s) => ({ ...s, build: { ...s.build, ...patch } }));
  const setWeapon = (patch: Partial<Weapon>) => setBuild({ weapon: { ...build.weapon, ...patch } });
  const setBuffs = (patch: Partial<Buffs>) => setInputs((s) => ({ ...s, buffs: { ...s.buffs, ...patch } }));

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Planejador de Build — Lorde</h1>
          <p className="muted">
            Pré-renovação · fórmulas do rAthena, commit <code>{meta.rathenaCommit.slice(0, 7)}</code>
          </p>
        </div>
        <Toolbar
          canUndo={hist.past.length > 0}
          canRedo={hist.future.length > 0}
          isDefault={inputs === DEFAULT_INPUTS}
          onUndo={() => setHist(undo)}
          onRedo={() => setHist(redo)}
          onReset={() => setInputs(() => DEFAULT_INPUTS)}
        />
      </header>
      <main className="layout">
        <div className="form">
          <GuideCard build={build} onLoad={(g) => setInputs((s) => applyGuideBuild(s, g))} />
          <CharacterCard build={build} buffs={buffs} onChange={setBuild} />
          <EquipCard build={build} buffs={buffs} onWeapon={setWeapon} onBuffs={setBuffs} />
          <TargetCard size={size} onChange={(s) => setInputs((prev) => ({ ...prev, size: s }))} />
        </div>
        <aside className="side" aria-label="Resultados">
          <div id="resultados" className="results">
            <Results outcome={outcome} size={size} delta={delta} />
          </div>
        </aside>
      </main>
      <Hud outcome={outcome} delta={delta} />
    </div>
  );
}

/**
 * Keeps the inputs in the URL hash (a reload or a copied link restores the build) and loads
 * a build pasted into the address bar of an open tab.
 */
function useUrlSync(inputs: Inputs, onLoad: (inputs: Inputs) => void) {
  useEffect(() => {
    history.replaceState(null, "", hashFor(inputs));
  }, [inputs]);
  useEffect(() => {
    const onHashChange = () => {
      const loaded = inputsFromHash(location.hash);
      if (loaded) onLoad(loaded);
    };
    addEventListener("hashchange", onHashChange);
    return () => removeEventListener("hashchange", onHashChange);
  });
}

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? "⌘" : "Ctrl";

/** Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y, except while typing in a field, which keeps its own undo. */
function useUndoKeys(onUndo: () => void, onRedo: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(isMac ? e.metaKey : e.ctrlKey) || e.altKey) return;
      if (e.target instanceof HTMLElement && e.target.matches("input:not([type=checkbox]), textarea, select")) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) onUndo();
      else if ((key === "z" && e.shiftKey) || key === "y") onRedo();
      else return;
      e.preventDefault();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });
}

function Toolbar({
  canUndo,
  canRedo,
  isDefault,
  onUndo,
  onRedo,
  onReset,
}: {
  canUndo: boolean;
  canRedo: boolean;
  isDefault: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
}) {
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(t);
  }, [copied]);
  const copy = () =>
    navigator.clipboard.writeText(location.href).then(
      () => setCopied("ok"),
      () => setCopied("fail"),
    );
  return (
    <div className="toolbar" role="toolbar" aria-label="Build">
      <button type="button" className="ghost" disabled={!canUndo} onClick={onUndo} title={`Desfazer (${MOD}+Z)`}>
        ↶ Desfazer
      </button>
      <button type="button" className="ghost" disabled={!canRedo} onClick={onRedo} title={`Refazer (${MOD}+Shift+Z)`}>
        ↷ Refazer
      </button>
      <button type="button" className="ghost" disabled={isDefault} onClick={onReset} title="Volta à build inicial; dá para desfazer">
        Build inicial
      </button>
      <button type="button" className="ghost share" onClick={copy}>
        {copied === "ok" ? "✓ Link copiado" : copied === "fail" ? "Copie o endereço da página" : "Copiar link da build"}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied === "ok" ? "Link copiado" : ""}
      </span>
    </div>
  );
}

/** Change in normal-attack DPS caused by the latest edit that produced a valid build. */
function useDpsDelta(outcome: PlanOutcome): number {
  const dps = outcome.ok ? outcome.result.dps : null;
  const [track, setTrack] = useState({ dps, delta: 0 });
  if (dps !== null && dps !== track.dps) {
    const next = { dps, delta: track.dps === null ? 0 : dps - track.dps };
    setTrack(next);
    return next.delta;
  }
  return track.delta;
}

function DeltaChip({ value }: { value: number }) {
  // Rounded like the DPS itself, so a change too small to show is not flagged.
  if (num.format(Math.abs(value)) === "0") return null;
  const up = value > 0;
  return (
    <span className={up ? "delta up" : "delta down"} title="Variação causada pela última alteração">
      {up ? "▲ +" : "▼ −"}
      {num.format(Math.abs(value))}
    </span>
  );
}

/** Bottom bar on narrow screens, where the results sit below the form: DPS at a glance. */
function Hud({ outcome, delta }: { outcome: PlanOutcome; delta: number }) {
  return (
    <button
      type="button"
      className={outcome.ok ? "hud" : "hud bad"}
      onClick={() => document.getElementById("resultados")?.scrollIntoView({ behavior: "smooth" })}
    >
      {outcome.ok ? (
        <>
          <span className="muted small">DPS</span>
          <strong>{num.format(outcome.result.dps)}</strong>
          <DeltaChip key={outcome.result.dps} value={delta} />
          <span className="hud-more small">Ver resultados ↓</span>
        </>
      ) : (
        <span>
          {outcome.issues.length === 1 ? "1 problema na build" : `${outcome.issues.length} problemas na build`} · ver ↓
        </span>
      )}
    </button>
  );
}

function Card({ title, aside, className, children }: { title: string; aside?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={className ? `card ${className}` : "card"}>
      <div className="card-head">
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min?: number; max?: number; onChange: (v: number) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        value={Number.isNaN(value) ? "" : value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value === "" ? Number.NaN : Number(e.target.value))}
      />
    </label>
  );
}

function SelectField<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={String(value)} onChange={(e) => onChange(options.find(([v]) => String(v) === e.target.value)![0])}>
        {options.map(([v, text]) => (
          <option key={String(v)} value={String(v)}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Stat after pressing + `steps` times, as in game: stops at the cap and when the free points
 * (null while unknown) no longer pay for the next point.
 */
function raiseStat(base: number, steps: number, free: number | null): number {
  let value = base;
  let left = free ?? Infinity;
  for (let i = 0; i < steps && value < BASE_STAT_MAX && statPointCost(value) <= left; i++) {
    left -= statPointCost(value);
    value++;
  }
  return value;
}

function StatsTable({
  build,
  buffs,
  freeStats,
  onChange,
}: {
  build: Build;
  buffs: Buffs;
  freeStats: number | null;
  onChange: (stats: Build["stats"]) => void;
}) {
  const jobBonus = jobBonusStats(getJob("Lord_Knight"), build.jobLevel);
  const buffBonus = resolveEffects(build, buffs).statBonus;
  return (
    <table className="stats">
      <thead>
        <tr>
          <th />
          <th>Base</th>
          <th>Classe</th>
          <th>Buffs</th>
          <th>Total</th>
          <th title="Pontos para subir 1">Custo</th>
        </tr>
      </thead>
      <tbody>
        {STAT_NAMES.map((s) => {
          const base = build.stats[s];
          const buff = buffBonus[s] ?? 0;
          const set = (value: number) => onChange({ ...build.stats, [s]: value });
          // Shift moves 10 points at a time.
          const steps = (e: { shiftKey: boolean }) => (e.shiftKey ? 10 : 1);
          const canRaise = !Number.isNaN(base) && raiseStat(base, 1, freeStats) > base;
          return (
            <tr key={s}>
              <th scope="row">{STAT_LABELS[s]}</th>
              <td>
                <div className="stat-input">
                  <button
                    type="button"
                    aria-label={`Diminuir ${STAT_LABELS[s]}`}
                    title="Shift: −10"
                    disabled={Number.isNaN(base) || base <= BASE_STAT_MIN}
                    onClick={(e) => set(Math.max(base - steps(e), BASE_STAT_MIN))}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    aria-label={STAT_LABELS[s]}
                    value={Number.isNaN(base) ? "" : base}
                    min={BASE_STAT_MIN}
                    max={BASE_STAT_MAX}
                    onChange={(e) => set(e.target.value === "" ? Number.NaN : Number(e.target.value))}
                  />
                  <button
                    type="button"
                    aria-label={`Aumentar ${STAT_LABELS[s]}`}
                    title={canRaise ? "Shift: +10" : base >= BASE_STAT_MAX ? "No máximo" : "Pontos insuficientes"}
                    disabled={!canRaise}
                    onClick={(e) => set(raiseStat(base, steps(e), freeStats))}
                  >
                    +
                  </button>
                </div>
              </td>
              <td className="num muted">+{jobBonus[s]}</td>
              <td className="num muted">{buff ? `+${buff}` : "—"}</td>
              <td className="num strong">{Number.isNaN(base) ? "—" : base + jobBonus[s] + buff}</td>
              <td className="num muted">{base < BASE_STAT_MAX ? statPointCost(base) : "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const SELF_BUFF_LABELS: Record<SelfBuff, string> = {
  twoHandQuicken: skillLabel(SELF_BUFF_SKILLS.twoHandQuicken),
  concentration: skillLabel(SELF_BUFF_SKILLS.concentration),
  auraBlade: skillLabel(SELF_BUFF_SKILLS.auraBlade),
  berserk: skillLabel(SELF_BUFF_SKILLS.berserk),
};

function BuffsFields({ build, buffs, onChange }: { build: Build; buffs: Buffs; onChange: (patch: Partial<Buffs>) => void }) {
  return (
    <div className="buffs">
      <fieldset>
        <legend>Próprios</legend>
        {(Object.keys(SELF_BUFF_SKILLS) as SelfBuff[]).map((b) => {
          const level = skillLevel(build, SELF_BUFF_SKILLS[b]);
          return (
            <label key={b} className="check">
              <input type="checkbox" checked={buffs[b]} disabled={!buffs[b] && level === 0} onChange={(e) => onChange({ [b]: e.target.checked })} />
              {SELF_BUFF_LABELS[b]}
              <span className="muted">{level > 0 ? ` nv. ${level}` : " (não aprendida)"}</span>
            </label>
          );
        })}
      </fieldset>
      <fieldset>
        <legend>Grupo e consumíveis</legend>
        <div className="fields">
          <SelectField label="Bênção" value={buffs.blessing} options={range(MAX_BLESSING).map((l) => [l, l ? `nv. ${l}` : "—"])} onChange={(blessing) => onChange({ blessing })} />
          <SelectField label="Aumentar Agilidade" value={buffs.increaseAgi} options={range(MAX_INCREASE_AGI).map((l) => [l, l ? `nv. ${l}` : "—"])} onChange={(increaseAgi) => onChange({ increaseAgi })} />
          <SelectField label="Impositio Manus" value={buffs.impositio} options={range(MAX_IMPOSITIO).map((l) => [l, l ? `nv. ${l}` : "—"])} onChange={(impositio) => onChange({ impositio })} />
          <SelectField label="Poção de ASPD" value={buffs.aspdPotion} options={ASPD_POTIONS.map((p) => [p, POTION_LABELS[p]])} onChange={(aspdPotion) => onChange({ aspdPotion })} />
          <label className="check">
            <input type="checkbox" checked={buffs.gloria} onChange={(e) => onChange({ gloria: e.target.checked })} />
            Glória
          </label>
        </div>
      </fieldset>
    </div>
  );
}

/** Buffs switched on: own skills, party buffs with a level, Gloria and an ASPD potion. */
function activeBuffCount(buffs: Buffs): number {
  const self = (Object.keys(SELF_BUFF_SKILLS) as SelfBuff[]).filter((b) => buffs[b]).length;
  const party = [buffs.blessing, buffs.increaseAgi, buffs.impositio].filter((l) => l > 0).length;
  return self + party + (buffs.gloria ? 1 : 0) + (buffs.aspdPotion !== "none" ? 1 : 0);
}

function EquipCard({
  build,
  buffs,
  onWeapon,
  onBuffs,
}: {
  build: Build;
  buffs: Buffs;
  onWeapon: (patch: Partial<Weapon>) => void;
  onBuffs: (patch: Partial<Buffs>) => void;
}) {
  const { weapon } = build;
  const active = activeBuffCount(buffs);
  return (
    <TabbedCard
      label="Arma e buffs"
      tabs={[
        { id: "weapon", label: "Arma", hint: weapon.type === "Fist" ? WEAPON_LABELS.Fist : `${WEAPON_LABELS[weapon.type]} +${weapon.refine}` },
        { id: "buffs", label: "Buffs", hint: active === 1 ? "1 ativo" : `${active} ativos` },
      ]}
    >
      {(tab) =>
        tab === "weapon" ? <WeaponFields weapon={weapon} onChange={onWeapon} /> : <BuffsFields build={build} buffs={buffs} onChange={onBuffs} />
      }
    </TabbedCard>
  );
}

function WeaponFields({ weapon, onChange }: { weapon: Weapon; onChange: (patch: Partial<Weapon>) => void }) {
  return (
    <div className="fields">
      <SelectField label="Tipo" value={weapon.type} options={WEAPON_TYPES.map((t) => [t, WEAPON_LABELS[t]])} onChange={(type) => onChange({ type })} />
      {weapon.type !== "Fist" && (
        <>
          <NumberField label="ATK" value={weapon.atk} min={0} onChange={(atk) => onChange({ atk })} />
          <SelectField label="Nível" value={weapon.level} options={range(MAX_WEAPON_LEVEL, 1).map((l) => [l, String(l)])} onChange={(level) => onChange({ level })} />
          <SelectField label="Refino" value={weapon.refine} options={range(MAX_REFINE).map((r) => [r, `+${r}`])} onChange={(refine) => onChange({ refine })} />
          <NumberField label="Peso" value={weapon.weight} min={0} onChange={(weight) => onChange({ weight })} />
        </>
      )}
      <SelectField label="Elemento" value={weapon.element} options={ELEMENTS.map((e) => [e, ELEMENT_LABELS[e]])} onChange={(element) => onChange({ element })} />
    </div>
  );
}

interface TabSpec<T extends string> {
  id: T;
  label: string;
  /** Short summary shown in a badge next to the label. */
  hint: string;
  bad?: boolean;
}

/** A card whose body switches between tabs (ARIA tabs; arrow keys move between them). */
function TabbedCard<T extends string>({
  label,
  tabs,
  className,
  children,
}: {
  label: string;
  tabs: readonly [TabSpec<T>, ...TabSpec<T>[]];
  className?: string;
  children: (tab: T) => ReactNode;
}) {
  const [tab, setTab] = useState<T>(tabs[0].id);
  const id = useId();
  const move = (delta: number) => {
    const next = tabs[(tabs.findIndex((t) => t.id === tab) + delta + tabs.length) % tabs.length];
    if (!next) return;
    setTab(next.id);
    document.getElementById(`${id}-${next.id}-tab`)?.focus();
  };

  return (
    <section className={className ? `card ${className}` : "card"}>
      <div
        className="card-tabs"
        role="tablist"
        aria-label={label}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") move(1);
          if (e.key === "ArrowLeft") move(-1);
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`${id}-${t.id}-tab`}
            type="button"
            role="tab"
            aria-selected={t.id === tab}
            aria-controls={`${id}-panel`}
            tabIndex={t.id === tab ? 0 : -1}
            className={t.id === tab ? "active" : ""}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            <span className={t.bad ? "badge bad" : "badge"}>{t.hint}</span>
          </button>
        ))}
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}-tab`} className="card-tab-panel">
        {children(tab)}
      </div>
    </section>
  );
}

const GUIDE_STYLES = Object.keys(STYLE_LABELS) as GuideStyle[];
const GUIDE_GOALS = Object.keys(GOAL_LABELS) as GuideGoal[];

/**
 * Loads a build from the guide by style and goal. While the planner build still is that build, or
 * keeps its stats or skills, the card shows the guide's summary, weapon and reasons for each stat.
 */
function GuideCard({ build, onLoad }: { build: Build; onLoad: (g: GuideBuild) => void }) {
  const [last, setLast] = useState<GuideBuild>();
  const match = matchingGuideBuild(build);
  const overlap = last && guideOverlap(build, last);
  const shown = match ?? (overlap && (overlap.stats || overlap.skills) ? last : undefined);
  const load = (style: GuideStyle, goal: GuideGoal) => {
    const g = findGuideBuild(style, goal);
    if (!g) return;
    setLast(g);
    onLoad(g);
  };
  const style = shown?.style ?? "spear";
  const goal = shown?.goal ?? "mvp";
  return (
    <Card title="Builds do guia" className="wide guide">
      <div className="guide-pickers">
        <div className="guide-picker">
          <span className="picker-label">Estilo</span>
          <div className="segmented" role="group" aria-label="Estilo">
            {GUIDE_STYLES.map((s) => (
              <button key={s} type="button" aria-pressed={shown?.style === s} className={shown?.style === s ? "active" : ""} onClick={() => load(s, goal)}>
                {STYLE_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
        <div className="guide-picker">
          <span className="picker-label">Objetivo</span>
          <div className="segmented" role="group" aria-label="Objetivo">
            {GUIDE_GOALS.map((g) => (
              <button key={g} type="button" aria-pressed={shown?.goal === g} className={shown?.goal === g ? "active" : ""} onClick={() => load(style, g)}>
                {GOAL_LABELS[g]}
              </button>
            ))}
          </div>
        </div>
      </div>
      {shown ? (
        <div className="guide-info">
          <p className="guide-title">
            <strong>{shown.title}</strong>
            {match ? (
              <span className="badge ok">como no guia</span>
            ) : (
              <>
                <span className="badge">modificada</span>
                <button type="button" className="ghost" onClick={() => onLoad(shown)}>
                  Recarregar
                </button>
              </>
            )}
          </p>
          <p className="muted small">{shown.summary}</p>
          <p className="small">
            <span className="muted">Arma do guia:</span> {shown.weapon}.{" "}
            <span className="muted">O planner não tem os itens: ajuste ATK, nível e refino na aba Arma.</span>
          </p>
          <details className="stat-notes">
            <summary>Por que esses atributos</summary>
            <ul>
              {STAT_NAMES.map((s) => {
                const same = build.stats[s] === shown.stats[s];
                return (
                  <li key={s}>
                    <b className={same ? "" : "changed"} title={same ? undefined : `Sua build: ${build.stats[s]}`}>
                      {STAT_LABELS[s]} {shown.stats[s]}
                    </b>
                    <span>{shown.statNotes[s]}</span>
                  </li>
                );
              })}
            </ul>
          </details>
        </div>
      ) : (
        <p className="muted small guide-intro">
          Builds de Lorde do guia RO Classic Idle, nível 99/70. Escolha um estilo ou um objetivo para carregar atributos, habilidades e
          buffs; dá para desfazer.
        </p>
      )}
    </Card>
  );
}

/** Free status points, or null while the base level is not a valid number. */
function freeStatPoints(build: Build): number | null {
  const validLevel = Number.isInteger(build.baseLevel) && build.baseLevel >= 1 && build.baseLevel <= MAX_BASE_LEVEL;
  const spent = spentStatPoints(build.stats);
  return validLevel && !Number.isNaN(spent) ? availableStatPoints(build.baseLevel) - spent : null;
}

function CharacterCard({ build, buffs, onChange }: { build: Build; buffs: Buffs; onChange: (patch: Partial<Build>) => void }) {
  const freeStats = freeStatPoints(build);
  const pools = SKILL_STAGES.map((stage) => ({
    spent: spentSkillPoints(build.skills, stage),
    available: availableSkillPoints(stage, build.jobLevel),
  }));
  const skillSpent = pools.reduce((n, p) => n + p.spent, 0);
  const skillAvailable = pools.reduce((n, p) => n + p.available, 0);
  return (
    <TabbedCard
      label="Personagem"
      className="wide character"
      tabs={[
        {
          id: "character",
          label: "Personagem",
          hint: freeStats === null ? "—" : `${freeStats} livres`,
          bad: freeStats !== null && freeStats < 0,
        },
        {
          id: "skills",
          label: "Habilidades",
          hint: Number.isNaN(skillAvailable) ? `${skillSpent}` : `${skillSpent}/${skillAvailable}`,
          bad: pools.some((p) => p.spent > p.available),
        },
      ]}
    >
      {(tab) =>
        tab === "character" ? (
          <CharacterPanel build={build} buffs={buffs} freeStats={freeStats} onChange={onChange} />
        ) : (
          <>
            <p className="muted small">Subir uma habilidade aprende os pré-requisitos; baixar remove as que dependem dela.</p>
            <SkillTree build={build} onChange={(skills) => onChange({ skills })} />
          </>
        )
      }
    </TabbedCard>
  );
}

function CharacterPanel({
  build,
  buffs,
  freeStats,
  onChange,
}: {
  build: Build;
  buffs: Buffs;
  freeStats: number | null;
  onChange: (patch: Partial<Build>) => void;
}) {
  return (
    <div className="character-panel">
      <div className="character-levels">
        <NumberField label="Nível de base" value={build.baseLevel} min={1} max={MAX_BASE_LEVEL} onChange={(v) => onChange({ baseLevel: v })} />
        <NumberField label="Nível de classe" value={build.jobLevel} min={1} max={MAX_JOB_LEVEL} onChange={(v) => onChange({ jobLevel: v })} />
        <label className="check">
          <input
            type="checkbox"
            checked={build.riding}
            disabled={!build.riding && skillLevel(build, "KN_RIDING") === 0}
            onChange={(e) => onChange({ riding: e.target.checked })}
          />
          Montado no Peco Peco
        </label>
        {freeStats !== null && (
          <p className={freeStats < 0 ? "points bad" : "points"}>
            <strong>{freeStats}</strong> {Math.abs(freeStats) === 1 ? "ponto de atributo livre" : "pontos de atributo livres"}
          </p>
        )}
      </div>
      <StatsTable build={build} buffs={buffs} freeStats={freeStats} onChange={(stats) => onChange({ stats })} />
    </div>
  );
}

function TargetCard({ size, onChange }: { size: Size; onChange: (s: Size) => void }) {
  const preset = targetPresets.find((t) => t.size === size);
  return (
    <Card title="Alvo">
      <div className="segmented" role="radiogroup" aria-label="Tamanho do alvo">
        {SIZES.map((s) => (
          <button key={s} type="button" role="radio" aria-checked={s === size} className={s === size ? "active" : ""} onClick={() => onChange(s)}>
            {SIZE_LABELS[s]}
          </button>
        ))}
      </div>
      {preset && (
        <>
          <p className="muted small">Média de {preset.sampleSize} monstros comuns.</p>
          <dl className="kv kv-pairs">
            <dt>Nível</dt>
            <dd>{preset.level}</dd>
            <dt>HP</dt>
            <dd>{num.format(preset.hp)}</dd>
            <dt>DEF / VIT</dt>
            <dd>
              {preset.def} / {preset.vit}
            </dd>
            <dt>AGI / SOR</dt>
            <dd>
              {preset.agi} / {preset.luk}
            </dd>
            <dt>Raça</dt>
            <dd>{RACE_LABELS[preset.race] ?? preset.race}</dd>
            <dt>Elemento</dt>
            <dd>
              {ELEMENT_LABELS[preset.element]} {preset.elementLevel}
            </dd>
          </dl>
        </>
      )}
    </Card>
  );
}

function Results({ outcome, size, delta }: { outcome: PlanOutcome; size: Size; delta: number }) {
  const hp = targetPresets.find((t) => t.size === size)?.hp;
  if (!outcome.ok) {
    return (
      <Card title="Corrija para calcular">
        <ul className="issues">
          {outcome.issues.map((i, k) => (
            <li key={k}>{issueMessage(i)}</li>
          ))}
        </ul>
      </Card>
    );
  }
  const r = outcome.result;
  return (
    <>
      <Card title="Ataque normal">
        <div className="dps">
          <span className="muted">Dano por segundo</span>
          <span className="dps-value">
            <strong>{num.format(r.dps)}</strong>
            <DeltaChip key={r.dps} value={delta} />
          </span>
          {hp !== undefined && r.dps > 0 && <span className="muted small">≈ {num.format(hp / r.dps)} s para derrotar o alvo médio</span>}
        </div>
        <dl className="kv">
          <dt>ASPD</dt>
          <dd>
            {num.format(r.attackSpeed.aspd)} <span className="muted">({num.format(r.attackSpeed.attacksPerSecond)} golpes/s)</span>
          </dd>
          <dt>Chance de acerto</dt>
          <dd>{pct.format(r.hitChance)}</dd>
          <dt>Chance de crítico</dt>
          <dd>{pct.format(r.critChance)}</dd>
          <dt>Dano normal</dt>
          <dd>
            {r.normal.min}–{r.normal.max} <span className="muted">(média {num.format(r.normal.mean)})</span>
          </dd>
          <dt>Dano crítico</dt>
          <dd>
            {r.critical.min}–{r.critical.max} <span className="muted">(média {num.format(r.critical.mean)})</span>
          </dd>
          <dt>Média por golpe</dt>
          <dd>{num.format(r.meanPerAttack)}</dd>
        </dl>
      </Card>
      {r.skills.length > 0 && <SkillResults skills={r.skills} normalDps={r.dps} sp={r.sp} />}
    </>
  );
}

const UNAVAILABLE_LABELS: Record<SkillUnavailable, string> = {
  weapon: "arma incompatível",
  riding: "requer montaria",
  berserk: "bloqueada pelo Frenesi",
};

/** Sustained DPS against the normal attack, as "+4%"; null when they round to the same. */
function versusNormal(dps: number, normalDps: number): string | null {
  const diff = normalDps > 0 ? dps / normalDps - 1 : 0;
  return Math.abs(diff) < 0.005 ? null : signedPct.format(diff);
}

function SkillResults({ skills, normalDps, sp }: { skills: PlannedSkill[]; normalDps: number; sp: SpStatus }) {
  // Ranked by long-fight DPS, the number that holds beyond the first seconds; unusable skills last.
  const sorted = [...skills].sort((a, b) => (b.available ? b.sustain.sustainedDps : -1) - (a.available ? a.sustain.sustainedDps : -1));
  const top = Math.max(normalDps, ...sorted.map((s) => (s.available ? s.sustain.sustainedDps : 0)));
  const share = (dps: number) => `${top > 0 ? (100 * dps) / top : 0}%`;
  return (
    <Card title="Habilidades ofensivas">
      <p className="muted small">
        DPS numa luta longa sem poções: a skill no ritmo que a regeneração paga (SP {sp.max}, +{sp.regenPerTick} a cada{" "}
        {SP_REGEN_INTERVAL / 1000} s) e ataques normais no resto do tempo.
      </p>
      <ul className="skill-results" style={{ "--normal": share(normalDps) } as CSSProperties}>
        {sorted.map((s) => {
          if (!s.available) {
            return (
              <li key={s.skill} className="muted">
                <div className="skill-result-head">
                  <span>
                    {skillLabel(s.skill)} <span className="muted">nv. {s.level}</span>
                  </span>
                  <span className="small">{UNAVAILABLE_LABELS[s.reason]}</span>
                </div>
              </li>
            );
          }
          const { sustain } = s;
          const versus = versusNormal(sustain.sustainedDps, normalDps);
          const better = sustain.sustainedDps > normalDps && versus !== null;
          const limited = sustain.fullSpDuration !== Infinity;
          return (
            <li key={s.skill}>
              <div className="skill-result-head">
                <span>
                  {skillLabel(s.skill)} <span className="muted">nv. {s.level}</span>
                </span>
                <strong className={better ? "better" : ""}>{num.format(sustain.sustainedDps)}</strong>
              </div>
              <div className="dps-bar" aria-hidden="true">
                <span style={{ width: share(sustain.sustainedDps) }} />
              </div>
              <div className="small">
                <span className={better ? "versus up" : "versus"}>
                  {versus === null ? "igual ao ataque normal" : `${versus} em relação ao ataque normal`}
                </span>
              </div>
              <div className="small">
                {s.dps <= normalDps ? (
                  <>
                    Usando sem parar: <strong>{num.format(s.dps)}</strong>, abaixo do ataque normal
                  </>
                ) : limited ? (
                  <>
                    Explosão: <strong>{num.format(s.dps)}</strong> por {num.format(sustain.fullSpDuration)} s com SP cheio, ou sempre com{" "}
                    {num.format(sustain.bluePotionsPerMinute)} poções azuis/min
                  </>
                ) : (
                  "A regeneração cobre o custo: dá para usar sem parar."
                )}
              </div>
              <div className="muted small">
                {s.damage.min === s.damage.max ? s.damage.min : `${s.damage.min}–${s.damage.max}`}
                {s.hits > 1 && ` (${s.hits} golpes)`} por uso · a cada {sec.format(s.cycle / 1000)} s · acerto {pct.format(s.hitChance)}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="bar-legend small muted">
        <span className="swatch normal" aria-hidden="true" /> ataque normal ({num.format(normalDps)})
      </p>
      <p className="muted small">
        Explosão é o DPS usando a skill sem parar, que só se mantém enquanto o SP dura ou tomando poções. Cada Poção Azul devolve{" "}
        {num.format(sp.bluePotionSp)} SP em média.
      </p>
    </Card>
  );
}
