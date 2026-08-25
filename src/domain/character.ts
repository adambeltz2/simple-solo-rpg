// Core character domain model + 2024-rules derived math.
export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export const ABILITY_KEYS: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export const ABILITY_LABELS: Record<AbilityKey, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};

export type Abilities = Record<AbilityKey, number>;

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  weight?: number;
  equipped?: boolean;
  isArmor?: boolean;
  isShield?: boolean;
  armorBase?: number;
  armorDexBonus?: boolean;
  armorMaxBonus?: number;
  notes?: string;
}

export interface SpellSlotTrack {
  max: number;
  used: number;
}

export interface FeatureNote {
  id: string;
  name: string;
  source: string;
  description: string;
}

export interface JournalEntry {
  id: string;
  timestamp: number;
  title: string;
  text: string;
  tag?: 'scene' | 'oracle' | 'combat' | 'note';
}

export interface RollLogEntry {
  id: string;
  timestamp: number;
  label: string;
  formula: string;
  rolls: number[];
  total: number;
  advantage?: 'advantage' | 'disadvantage' | null;
  isNat20?: boolean;
  isNat1?: boolean;
}

export interface CombatantRef {
  id: string;
  name: string;
  isPC: boolean;
  isSidekick?: boolean;
  monsterIndex?: string;
  initiative: number;
  maxHp: number;
  currentHp: number;
  tempHp: number;
  ac: number;
  conditions: string[];
  notes?: string;
}

export interface EncounterState {
  id: string;
  name: string;
  round: number;
  activeIndex: number;
  combatants: CombatantRef[];
  active: boolean;
}

export interface Character {
  id: string;
  name: string;
  playerNote?: string;
  speciesIndex: string;
  subspeciesIndex?: string;
  classIndex: string;
  subclassIndex?: string;
  backgroundIndex: string;
  alignmentIndex?: string;
  level: number;
  xp: number;

  abilities: Abilities;
  backgroundAbilityBonuses: Partial<Record<AbilityKey, number>>;

  skillProficiencies: string[];
  skillExpertise: string[];
  savingThrowProficiencies: string[];
  toolProficiencies: string[];
  languages: string[];
  feats: string[];

  maxHp: number;
  currentHp: number;
  tempHp: number;
  hitDiceUsed: number;
  deathSaveSuccesses: number;
  deathSaveFailures: number;

  acOverride: number | null;
  initiativeBonus: number;
  speedOverride: number | null;

  inspiration: boolean;
  conditions: string[];

  spellsKnown: string[];
  spellsPrepared: string[];
  spellSlots: Record<number, SpellSlotTrack>;

  inventory: InventoryItem[];
  gold: number;

  featureNotes: FeatureNote[];
  notes: string;

  journal: JournalEntry[];
  rollLog: RollLogEntry[];
  encounter: EncounterState | null;
  chaosFactor: number;

  createdAt: number;
  updatedAt: number;
}

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function proficiencyBonus(level: number): number {
  return 2 + Math.floor((Math.max(1, level) - 1) / 4);
}

export function effectiveAbility(character: Character, key: AbilityKey): number {
  return character.abilities[key] + (character.backgroundAbilityBonuses[key] ?? 0);
}

export function skillModifier(character: Character, skillIndex: string, skillAbility: AbilityKey): number {
  const base = abilityModifier(effectiveAbility(character, skillAbility));
  const pb = proficiencyBonus(character.level);
  if (character.skillExpertise.includes(skillIndex)) return base + pb * 2;
  if (character.skillProficiencies.includes(skillIndex)) return base + pb;
  return base;
}

export function savingThrowModifier(character: Character, key: AbilityKey): number {
  const base = abilityModifier(effectiveAbility(character, key));
  const pb = proficiencyBonus(character.level);
  return character.savingThrowProficiencies.includes(key) ? base + pb : base;
}

export function passivePerception(character: Character, perceptionProficient: boolean, perceptionExpertise: boolean): number {
  const base = abilityModifier(effectiveAbility(character, 'wis'));
  const pb = proficiencyBonus(character.level);
  const bonus = perceptionExpertise ? pb * 2 : perceptionProficient ? pb : 0;
  return 10 + base + bonus;
}

export function computeArmorClass(character: Character): number {
  if (character.acOverride !== null) return character.acOverride;
  const dexMod = abilityModifier(effectiveAbility(character, 'dex'));
  const armor = character.inventory.find((i) => i.equipped && i.isArmor);
  const shieldBonus = character.inventory.some((i) => i.equipped && i.isShield) ? 2 : 0;
  if (!armor) return 10 + dexMod + shieldBonus;
  const base = armor.armorBase ?? 10;
  if (!armor.armorDexBonus) return base + shieldBonus;
  const cap = armor.armorMaxBonus ?? Infinity;
  return base + Math.min(dexMod, cap) + shieldBonus;
}

export function hitDiceRemaining(character: Character): number {
  return Math.max(0, character.level - character.hitDiceUsed);
}

export function xpForNextLevel(level: number): number {
  const table = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
  return table[Math.min(level, table.length - 1)] ?? table[table.length - 1];
}

export function createId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
