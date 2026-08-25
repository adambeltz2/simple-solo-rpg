import type { Abilities, AbilityKey, Character } from './character';
import { abilityModifier, createId } from './character';
import { classByIndex } from '../data/srd';

export interface NewCharacterInput {
  name: string;
  speciesIndex: string;
  subspeciesIndex?: string;
  classIndex: string;
  subclassIndex?: string;
  backgroundIndex: string;
  alignmentIndex?: string;
  abilities: Abilities;
  backgroundAbilityBonuses: Partial<Record<AbilityKey, number>>;
  skillProficiencies: string[];
  toolProficiencies: string[];
  languages: string[];
  feats: string[];
  gold: number;
}

export function buildCharacter(input: NewCharacterInput): Character {
  const klass = classByIndex(input.classIndex);
  const conScore = input.abilities.con + (input.backgroundAbilityBonuses.con ?? 0);
  const conMod = abilityModifier(conScore);
  const hitDie = klass?.hit_die ?? 8;
  const maxHp = hitDie + conMod;

  const now = Date.now();
  return {
    id: createId(),
    name: input.name || 'Unnamed Adventurer',
    speciesIndex: input.speciesIndex,
    subspeciesIndex: input.subspeciesIndex,
    classIndex: input.classIndex,
    subclassIndex: input.subclassIndex,
    backgroundIndex: input.backgroundIndex,
    alignmentIndex: input.alignmentIndex,
    level: 1,
    xp: 0,

    abilities: input.abilities,
    backgroundAbilityBonuses: input.backgroundAbilityBonuses,

    skillProficiencies: input.skillProficiencies,
    skillExpertise: [],
    savingThrowProficiencies: klass?.saving_throws ?? [],
    toolProficiencies: input.toolProficiencies,
    languages: input.languages,
    feats: input.feats,

    maxHp: Math.max(1, maxHp),
    currentHp: Math.max(1, maxHp),
    tempHp: 0,
    hitDiceUsed: 0,
    deathSaveSuccesses: 0,
    deathSaveFailures: 0,

    acOverride: null,
    initiativeBonus: 0,
    speedOverride: null,

    inspiration: false,
    conditions: [],

    spellsKnown: [],
    spellsPrepared: [],
    spellSlots: {},

    inventory: [],
    gold: input.gold,

    featureNotes: [],
    notes: '',

    journal: [],
    rollLog: [],
    encounter: null,
    chaosFactor: 5,

    createdAt: now,
    updatedAt: now,
  };
}
