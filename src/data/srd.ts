import abilityScoresJson from './srd/ability-scores.json';
import skillsJson from './srd/skills.json';
import alignmentsJson from './srd/alignments.json';
import languagesJson from './srd/languages.json';
import damageTypesJson from './srd/damage-types.json';
import conditionsJson from './srd/conditions.json';
import traitsJson from './srd/traits.json';
import speciesJson from './srd/species.json';
import backgroundsJson from './srd/backgrounds.json';
import featsJson from './srd/feats.json';
import featuresJson from './srd/features.json';
import classesJson from './srd/classes.json';
import subclassesJson from './srd/subclasses.json';
import levelsJson from './srd/levels.json';
import equipmentJson from './srd/equipment.json';
import magicItemsJson from './srd/magic-items.json';
import monstersJson from './srd/monsters.json';
import spellsJson from './srd/spells.json';

import type {
  AbilityScore, Skill, Alignment, Language, DamageType, Condition, Trait,
  Species, Background, Feat, FeatureMap, DndClass, Subclass, ClassLevel,
  EquipmentItem, MagicItem, Monster, Spell,
} from './srdTypes';

export const abilityScores = abilityScoresJson as AbilityScore[];
export const skills = skillsJson as Skill[];
export const alignments = alignmentsJson as Alignment[];
export const languages = languagesJson as Language[];
export const damageTypes = damageTypesJson as DamageType[];
export const conditions = conditionsJson as Condition[];
export const traits = traitsJson as Trait[];
export const species = speciesJson as Species[];
export const backgrounds = backgroundsJson as Background[];
export const feats = featsJson as Feat[];
export const features = featuresJson as FeatureMap;
export const classes = classesJson as DndClass[];
export const subclasses = subclassesJson as Subclass[];
export const levels = levelsJson as ClassLevel[];
export const equipment = equipmentJson as EquipmentItem[];
export const magicItems = magicItemsJson as unknown as MagicItem[];
export const monsters = monstersJson as unknown as Monster[];
export const spells = spellsJson as Spell[];

export function byIndex<T extends { index: string }>(list: T[], index: string | undefined): T | undefined {
  return index ? list.find((item) => item.index === index) : undefined;
}

export function classByIndex(index: string) {
  return byIndex(classes, index);
}
export function speciesByIndex(index: string) {
  return byIndex(species, index);
}
export function backgroundByIndex(index: string) {
  return byIndex(backgrounds, index);
}
export function subclassesForClass(classIndex: string) {
  return subclasses.filter((sc) => sc.class === classIndex);
}
export function levelsForClass(classIndex: string) {
  return levels.filter((l) => l.class === classIndex).sort((a, b) => a.level - b.level);
}
export function levelForClass(classIndex: string, level: number) {
  return levels.find((l) => l.class === classIndex && l.level === level);
}
export function featureByIndex(index: string) {
  return features[index];
}
export function spellsForClass(classIndex: string) {
  return spells.filter((s) => s.classes.includes(classIndex));
}
export function monstersByCrRange(min: number, max: number) {
  return monsters.filter((m) => m.challenge_rating >= min && m.challenge_rating <= max);
}
