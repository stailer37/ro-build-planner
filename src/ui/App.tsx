import { useMemo, useState, type ReactNode } from "react";
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
import { calculate, type PlanOutcome } from "../core/plan.ts";
import {
  PLANNER_SKILLS,
  SKILL_STAGES,
  availableSkillPoints,
  setSkillLevel,
  spentSkillPoints,
} from "../core/skills.ts";
import { availableStatPoints, jobBonusStats, spentStatPoints, statPointCost } from "../core/stats.ts";
import { presetTarget } from "../core/target.ts";
import meta from "../data/meta.json";
import { DEFAULT_BUFFS, DEFAULT_BUILD, DEFAULT_TARGET_SIZE } from "./defaults.ts";
import {
  ELEMENT_LABELS,
  POTION_LABELS,
  RACE_LABELS,
  SIZE_LABELS,
  STAGE_LABELS,
  STAT_LABELS,
  WEAPON_LABELS,
  issueMessage,
  skillLabel,
} from "./labels.ts";

const num = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
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
          <Card title="Personagem">
            <div className="fields">
              <NumberField label="Nível de base" value={build.baseLevel} min={1} max={MAX_BASE_LEVEL} onChange={(v) => setBuild({ baseLevel: v })} />
              <NumberField label="Nível de classe" value={build.jobLevel} min={1} max={MAX_JOB_LEVEL} onChange={(v) => setBuild({ jobLevel: v })} />
              <label className="check">
                <input
                  type="checkbox"
                  checked={build.riding}
                  disabled={!build.riding && skillLevel(build, "KN_RIDING") === 0}
                  onChange={(e) => setBuild({ riding: e.target.checked })}
                />
                Montado no Peco Peco
              </label>
            </div>
          </Card>
          <StatsCard build={build} buffs={buffs} onChange={(stats) => setBuild({ stats })} />
          <Card title="Arma">
            <div className="fields">
              <SelectField label="Tipo" value={build.weapon.type} options={WEAPON_TYPES.map((t) => [t, WEAPON_LABELS[t]])} onChange={(type) => setWeapon({ type })} />
              {build.weapon.type !== "Fist" && (
                <>
                  <NumberField label="ATK" value={build.weapon.atk} min={0} onChange={(atk) => setWeapon({ atk })} />
                  <SelectField label="Nível" value={build.weapon.level} options={range(MAX_WEAPON_LEVEL, 1).map((l) => [l, String(l)])} onChange={(level) => setWeapon({ level })} />
                  <SelectField label="Refino" value={build.weapon.refine} options={range(MAX_REFINE).map((r) => [r, `+${r}`])} onChange={(refine) => setWeapon({ refine })} />
                </>
              )}
              <SelectField label="Elemento" value={build.weapon.element} options={ELEMENTS.map((e) => [e, ELEMENT_LABELS[e]])} onChange={(element) => setWeapon({ element })} />
            </div>
          </Card>
          <BuffsCard build={build} buffs={buffs} onChange={setBuffs} />
          <SkillsCard build={build} onChange={(skills) => setBuild({ skills })} />
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

function Card({ title, aside, wide, children }: { title: string; aside?: ReactNode; wide?: boolean; children: ReactNode }) {
  return (
    <section className={wide ? "card wide" : "card"}>
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

function StatsCard({ build, buffs, onChange }: { build: Build; buffs: Buffs; onChange: (stats: Build["stats"]) => void }) {
  const jobBonus = jobBonusStats(getJob("Lord_Knight"), build.jobLevel);
  const buffBonus = resolveEffects(build, buffs).statBonus;
  const validLevel = Number.isInteger(build.baseLevel) && build.baseLevel >= 1 && build.baseLevel <= MAX_BASE_LEVEL;
  const available = validLevel ? availableStatPoints(build.baseLevel) : null;
  const spent = spentStatPoints(build.stats);
  const left = available === null || Number.isNaN(spent) ? null : available - spent;
  return (
    <Card title="Atributos" aside={left !== null && <span className={left < 0 ? "badge bad" : "badge"}>{left} pontos livres</span>}>
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
    </Card>
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

function SkillsCard({ build, onChange }: { build: Build; onChange: (skills: Build["skills"]) => void }) {
  return (
    <Card title="Habilidades" wide>
      <p className="muted small">Subir uma habilidade aprende os pré-requisitos; baixar remove as que dependem dela.</p>
      <div className="skill-stages">
        {SKILL_STAGES.map((stage) => {
          const spent = spentSkillPoints(build.skills, stage);
          const available = availableSkillPoints(stage, build.jobLevel);
          return (
            <div key={stage} className="skill-stage">
              <h3>
                {STAGE_LABELS[stage]}
                <span className={spent > available ? "badge bad" : "badge"}>
                  {spent}/{Number.isNaN(available) ? "—" : available}
                </span>
              </h3>
              <ul className="skills">
                {PLANNER_SKILLS.filter((s) => s.stage === stage).map((s) => (
                  <li key={s.name}>
                    <span>
                      {skillLabel(s.name)}
                      {s.isQuest && <span className="tag">missão</span>}
                    </span>
                    <select
                      aria-label={skillLabel(s.name)}
                      value={skillLevel(build, s.name)}
                      onChange={(e) => onChange(setSkillLevel(build.skills, s.name, Number(e.target.value)))}
                    >
                      {range(s.maxLevel).map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </Card>
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
    <Card title="Resultado">
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
  );
}
