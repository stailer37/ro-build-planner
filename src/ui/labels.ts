// Brazilian Portuguese labels for the planner UI.

import type { WeaponType } from "../core/build.ts";
import type { AspdPotion } from "../core/buffs.ts";
import type { Element, Size, StatName } from "../core/data.ts";
import type { PlanIssue } from "../core/plan.ts";
import type { SkillStage } from "../core/skills.ts";

export const STAT_LABELS: Record<StatName, string> = {
  Str: "FOR",
  Agi: "AGI",
  Vit: "VIT",
  Int: "INT",
  Dex: "DES",
  Luk: "SOR",
};

export const WEAPON_LABELS: Record<WeaponType, string> = {
  Fist: "Mãos vazias",
  Dagger: "Adaga",
  "1hSword": "Espada (1 mão)",
  "2hSword": "Espada (2 mãos)",
  "1hSpear": "Lança (1 mão)",
  "2hSpear": "Lança (2 mãos)",
  "1hAxe": "Machado (1 mão)",
  "2hAxe": "Machado (2 mãos)",
  Mace: "Maça",
};

export const ELEMENT_LABELS: Record<Element, string> = {
  Neutral: "Neutro",
  Water: "Água",
  Earth: "Terra",
  Fire: "Fogo",
  Wind: "Vento",
  Poison: "Veneno",
  Holy: "Sagrado",
  Dark: "Sombrio",
  Ghost: "Fantasma",
  Undead: "Maldito",
};

export const SIZE_LABELS: Record<Size, string> = { Small: "Pequeno", Medium: "Médio", Large: "Grande" };

export const RACE_LABELS: Partial<Record<string, string>> = {
  Formless: "Amorfo",
  Undead: "Morto-vivo",
  Brute: "Bruto",
  Plant: "Planta",
  Insect: "Inseto",
  Fish: "Peixe",
  Demon: "Demônio",
  Demihuman: "Humanoide",
  Angel: "Anjo",
  Dragon: "Dragão",
};

export const STAGE_LABELS: Record<SkillStage, string> = {
  novice: "Aprendiz T.",
  swordman: "Espadachim T.",
  lordKnight: "Cavaleiro / Lorde",
};

export const POTION_LABELS: Record<AspdPotion, string> = {
  none: "Nenhuma",
  concentration: "Poção da Concentração",
  awakening: "Poção do Despertar",
  berserk: "Poção da Fúria Selvagem",
};

const SKILL_LABELS: Partial<Record<string, string>> = {
  NV_BASIC: "Habilidades Básicas",
  NV_FIRSTAID: "Primeiros Socorros",
  SM_SWORD: "Perícia com Espada",
  SM_TWOHAND: "Perícia com Espada de Duas Mãos",
  SM_RECOVERY: "Aumentar Recuperação de HP",
  SM_BASH: "Golpe Fulminante",
  SM_PROVOKE: "Provocar",
  SM_MAGNUM: "Impacto Explosivo",
  SM_ENDURE: "Vigor",
  SM_MOVINGRECOVERY: "Recuperação em Movimento",
  SM_FATALBLOW: "Ataque Fatal",
  SM_AUTOBERSERK: "Instinto de Sobrevivência",
  KN_SPEARMASTERY: "Perícia com Lança",
  KN_PIERCE: "Perfurar",
  KN_BRANDISHSPEAR: "Brandir Lança",
  KN_SPEARSTAB: "Estocada",
  KN_SPEARBOOMERANG: "Lança Bumerangue",
  KN_TWOHANDQUICKEN: "Rapidez com Duas Mãos",
  KN_AUTOCOUNTER: "Contra-Ataque",
  KN_BOWLINGBASH: "Impacto de Tyr",
  KN_RIDING: "Montaria",
  KN_CAVALIERMASTERY: "Perícia em Montaria",
  KN_CHARGEATK: "Investida",
  KN_ONEHAND: "Rapidez com Uma Mão",
  LK_AURABLADE: "Lâmina de Aura",
  LK_PARRYING: "Aparar Golpe",
  LK_CONCENTRATION: "Concentração",
  LK_TENSIONRELAX: "Relaxar",
  LK_BERSERK: "Frenesi",
  LK_SPIRALPIERCE: "Perfurar em Espiral",
  LK_HEADCRUSH: "Golpe Traumático",
  LK_JOINTBEAT: "Ataque Vital",
};

export function skillLabel(name: string): string {
  return SKILL_LABELS[name] ?? name;
}

const BUFF_LABELS: Record<string, string> = {
  twoHandQuicken: skillLabel("KN_TWOHANDQUICKEN"),
  concentration: skillLabel("LK_CONCENTRATION"),
  auraBlade: skillLabel("LK_AURABLADE"),
  berserk: skillLabel("LK_BERSERK"),
  blessing: "Bênção",
  increaseAgi: "Aumentar Agilidade",
  impositio: "Impositio Manus",
};

export function issueMessage(issue: PlanIssue): string {
  switch (issue.code) {
    case "baseLevelOutOfRange":
      return `Nível de base deve estar entre ${issue.min} e ${issue.max}.`;
    case "jobLevelOutOfRange":
      return `Nível de classe deve estar entre ${issue.min} e ${issue.max}.`;
    case "statOutOfRange":
      return `${STAT_LABELS[issue.stat]} deve estar entre ${issue.min} e ${issue.max}.`;
    case "notEnoughStatPoints":
      return `Pontos de atributo insuficientes: ${issue.spent} usados de ${issue.available}.`;
    case "unknownSkill":
      return `Habilidade desconhecida: ${issue.skill}.`;
    case "skillLevelOutOfRange":
      return `${skillLabel(issue.skill)} vai até o nível ${issue.max}.`;
    case "missingPrerequisite":
      return `${skillLabel(issue.skill)} requer ${skillLabel(issue.requires)} nível ${issue.level}.`;
    case "notEnoughSkillPoints":
      return `Pontos de habilidade de ${STAGE_LABELS[issue.stage]} insuficientes: ${issue.spent} usados de ${issue.available}.`;
    case "weaponAtkOutOfRange":
      return "O ATK da arma não pode ser negativo.";
    case "weaponLevelOutOfRange":
      return `Nível da arma deve estar entre ${issue.min} e ${issue.max}.`;
    case "refineOutOfRange":
      return `Refino deve estar entre +${issue.min} e +${issue.max}.`;
    case "unknownElement":
      return "Elemento da arma desconhecido.";
    case "ridingNotLearned":
      return `Montar exige ${skillLabel("KN_RIDING")}.`;
    case "buffSkillNotLearned":
      return `${BUFF_LABELS[issue.buff]} exige aprender a habilidade.`;
    case "buffWeaponMismatch":
      return issue.buff === "twoHandQuicken"
        ? `${BUFF_LABELS[issue.buff]} exige espada de duas mãos.`
        : `${BUFF_LABELS[issue.buff]} exige uma arma equipada.`;
    case "buffLevelOutOfRange":
      return `${BUFF_LABELS[issue.buff]} deve estar entre ${issue.min} e ${issue.max}.`;
  }
}
