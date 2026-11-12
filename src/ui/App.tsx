import { useId, useMemo, useState, type ReactNode } from "react";
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
import { DEFAULT_BUFFS, DEFAULT_BUILD, DEFAULT_TARGET_SIZE } from "./defaults.ts";
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

const num = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const sec = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
const range = (n: number, from = 0) => Array.from({ length: n - from + 1 }, (_, i) => from + i);

interface Inputs {
  build: Build;
  buffs: Buffs;
  size: Size;
}

export function App() {
  const [inputs, setInputs] = useState<Inputs>({ build: DEFAULT_BUILD, buffs: DEFAULT_BUFFS, size: DEFAULT_TARGET_SIZE });
  const [computed, setComputed] = useState<{ inputs: Inputs; outcome: PlanOutcome } | null>(null);
  const { build, buffs, size } = inputs;

  const setBuild = (patch: Partial<Build>) => setInputs((s) => ({ ...s, build: { ...s.build, ...patch } }));
  const setWeapon = (patch: Partial<Weapon>) => setBuild({ weapon: { ...build.weapon, ...patch } });
  const setBuffs = (patch: Partial<Buffs>) => setInputs((s) => ({ ...s, buffs: { ...s.buffs, ...patch } }));

  const onCalculate = () => setComputed({ inputs, outcome: calculate(build, buffs, presetTarget(size)) });
  const stale = computed !== null && computed.inputs !== inputs;

  return (
    <div className="app">
      <header className="header">
        <h1>Planejador de Build — Lorde</h1>
        <p className="muted">
          Pré-renovação · fórmulas do rAthena, commit <code>{meta.rathenaCommit.slice(0, 7)}</code>
        </p>
      </header>
      <main className="layout">
        <div className="form">
          <CharacterCard build={build} buffs={buffs} onChange={setBuild} />
          <Card title="Arma">
            <div className="fields">
              <SelectField label="Tipo" value={build.weapon.type} options={WEAPON_TYPES.map((t) => [t, WEAPON_LABELS[t]])} onChange={(type) => setWeapon({ type })} />
              {build.weapon.type !== "Fist" && (
                <>
                  <NumberField label="ATK" value={build.weapon.atk} min={0} onChange={(atk) => setWeapon({ atk })} />
                  <SelectField label="Nível" value={build.weapon.level} options={range(MAX_WEAPON_LEVEL, 1).map((l) => [l, String(l)])} onChange={(level) => setWeapon({ level })} />
                  <SelectField label="Refino" value={build.weapon.refine} options={range(MAX_REFINE).map((r) => [r, `+${r}`])} onChange={(refine) => setWeapon({ refine })} />
                  <NumberField label="Peso" value={build.weapon.weight} min={0} onChange={(weight) => setWeapon({ weight })} />
                </>
              )}
              <SelectField label="Elemento" value={build.weapon.element} options={ELEMENTS.map((e) => [e, ELEMENT_LABELS[e]])} onChange={(element) => setWeapon({ element })} />
            </div>
          </Card>
          <BuffsCard build={build} buffs={buffs} onChange={setBuffs} />
        </div>
        <aside className="side">
          <TargetCard size={size} onChange={(s) => setInputs((prev) => ({ ...prev, size: s }))} />
          <button type="button" className="primary" onClick={onCalculate}>
            Calcular
          </button>
          {stale && <p className="notice">Os dados mudaram desde o último cálculo. Clique em Calcular para atualizar.</p>}
          {computed && <Results outcome={computed.outcome} size={computed.inputs.size} />}
        </aside>
      </main>
    </div>
  );
}

function Card({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
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

function StatsTable({ build, buffs, onChange }: { build: Build; buffs: Buffs; onChange: (stats: Build["stats"]) => void }) {
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
          return (
            <tr key={s}>
              <th scope="row">{STAT_LABELS[s]}</th>
              <td>
                <input
                  type="number"
                  aria-label={STAT_LABELS[s]}
                  value={Number.isNaN(base) ? "" : base}
                  min={BASE_STAT_MIN}
                  max={BASE_STAT_MAX}
                  onChange={(e) => onChange({ ...build.stats, [s]: e.target.value === "" ? Number.NaN : Number(e.target.value) })}
                />
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

function BuffsCard({ build, buffs, onChange }: { build: Build; buffs: Buffs; onChange: (patch: Partial<Buffs>) => void }) {
  return (
    <Card title="Buffs">
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
    </Card>
  );
}

type CharacterTab = "character" | "skills";

/** Free status points, or null while the base level is not a valid number. */
function freeStatPoints(build: Build): number | null {
  const validLevel = Number.isInteger(build.baseLevel) && build.baseLevel >= 1 && build.baseLevel <= MAX_BASE_LEVEL;
  const spent = spentStatPoints(build.stats);
  return validLevel && !Number.isNaN(spent) ? availableStatPoints(build.baseLevel) - spent : null;
}

function CharacterCard({ build, buffs, onChange }: { build: Build; buffs: Buffs; onChange: (patch: Partial<Build>) => void }) {
  const [tab, setTab] = useState<CharacterTab>("character");
  const id = useId();
  const freeStats = freeStatPoints(build);
  const pools = SKILL_STAGES.map((stage) => ({
    spent: spentSkillPoints(build.skills, stage),
    available: availableSkillPoints(stage, build.jobLevel),
  }));
  const skillSpent = pools.reduce((n, p) => n + p.spent, 0);
  const skillAvailable = pools.reduce((n, p) => n + p.available, 0);
  const tabs: { id: CharacterTab; label: string; hint: string; bad?: boolean }[] = [
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
  ];
  const move = (delta: number) => {
    const next = tabs[(tabs.findIndex((t) => t.id === tab) + delta + tabs.length) % tabs.length];
    if (!next) return;
    setTab(next.id);
    document.getElementById(`${id}-${next.id}-tab`)?.focus();
  };

  return (
    <section className="card wide character">
      <div
        className="card-tabs"
        role="tablist"
        aria-label="Personagem"
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
        {tab === "character" && <CharacterPanel build={build} buffs={buffs} freeStats={freeStats} onChange={onChange} />}
        {tab === "skills" && (
          <>
            <p className="muted small">Subir uma habilidade aprende os pré-requisitos; baixar remove as que dependem dela.</p>
            <SkillTree build={build} onChange={(skills) => onChange({ skills })} />
          </>
        )}
      </div>
    </section>
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
      <StatsTable build={build} buffs={buffs} onChange={(stats) => onChange({ stats })} />
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
          <dl className="kv">
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

function Results({ outcome, size }: { outcome: PlanOutcome; size: Size }) {
  const hp = useMemo(() => targetPresets.find((t) => t.size === size)?.hp, [size]);
  if (!outcome.ok) {
    return (
      <Card title="Corrija antes de calcular">
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
          <strong>{num.format(r.dps)}</strong>
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
        <p className="muted small">
          Atributos finais: {STAT_NAMES.map((s) => `${STAT_LABELS[s]} ${r.stats[s]}`).join(" · ")}
        </p>
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

function SkillResults({ skills, normalDps, sp }: { skills: PlannedSkill[]; normalDps: number; sp: SpStatus }) {
  // Best DPS first; skills the build cannot use go last.
  const sorted = [...skills].sort((a, b) => (b.available ? b.dps : -1) - (a.available ? a.dps : -1));
  return (
    <Card title="Habilidades ofensivas">
      <p className="muted small">
        DPS usando a skill sem parar contra um alvo. SP {sp.max}, recupera {sp.regenPerTick} a cada {SP_REGEN_INTERVAL / 1000} s.
      </p>
      <ul className="skill-results">
        {sorted.map((s) => (
          <li key={s.skill} className={s.available ? "" : "muted"}>
            <div className="skill-result-head">
              <span>
                {skillLabel(s.skill)} <span className="muted">nv. {s.level}</span>
              </span>
              {s.available ? (
                <strong className={s.dps > normalDps ? "better" : ""}>{num.format(s.dps)}</strong>
              ) : (
                <span className="small">{UNAVAILABLE_LABELS[s.reason]}</span>
              )}
            </div>
            {s.available && (
              <div className="muted small">
                {s.damage.min === s.damage.max ? s.damage.min : `${s.damage.min}–${s.damage.max}`}
                {s.hits > 1 && ` (${s.hits} golpes)`} por uso · a cada {sec.format(s.cycle / 1000)} s · acerto {pct.format(s.hitChance)} ·{" "}
                {num.format(s.spPerSecond)} SP/s
              </div>
            )}
            {s.available &&
              (s.sustain.fullSpDuration === Infinity ? (
                <div className="small">A regeneração cobre o custo: sustentável indefinidamente.</div>
              ) : (
                <div className="small">
                  SP cheio dura {num.format(s.sustain.fullSpDuration)} s; depois, <strong>{num.format(s.sustain.sustainedDps)}</strong>{" "}
                  DPS sustentável <span className="muted">({pct.format(s.sustain.sustainedShare)} do tempo na skill)</span>
                </div>
              ))}
          </li>
        ))}
      </ul>
      <p className="muted small">
        DPS em destaque supera o do ataque normal. O sustentável alterna a skill, no ritmo que a regeneração paga, com ataques
        normais, sem poções.
      </p>
    </Card>
  );
}
