// Types for the bundled SRD JSON in src/data/srd/.
// Core rules, species, classes, backgrounds, feats, equipment, magic items
// come from the 2024 ("5.5e" / SRD 5.2) dataset. Spells and monsters are
// sourced from the 2014 SRD (5.1) since the free 2024 SRD dataset does not
// yet publish a full spell or monster list; the two rule sets are mechanically
// compatible for the vast majority of entries.

export interface Ref {
  index: string;
  name: string;
}

export interface CountedRef extends Ref {
  count?: number;
}

export interface MoneyOption {
  money: string;
}

export type ChoiceOption = CountedRef | MoneyOption | { multiple: (CountedRef | MoneyOption)[] };

export interface Choice {
  description?: string;
  choose: number;
  options: ChoiceOption[];
}

export interface AbilityScore {
  index: string;
  name: string;
  full_name?: string;
  description?: string[] | string;
}

export interface Skill {
  index: string;
  name: string;
  description?: string;
  ability: string;
}

export interface Alignment {
  index: string;
  name: string;
  abbreviation?: string;
  description?: string;
}

export interface Language {
  index: string;
  name: string;
  type?: string;
  script?: string;
}

export interface DamageType {
  index: string;
  name: string;
  description?: string;
}

export interface Condition {
  index: string;
  name: string;
  description?: string[] | string;
}

export interface Trait {
  index: string;
  name: string;
  description?: string;
  level?: number;
}

export interface Subspecies {
  index: string;
  name: string;
  damage_type?: string;
  traits: Trait[];
}

export interface Species {
  index: string;
  name: string;
  type?: string;
  size: string;
  size_description?: string;
  speed: number;
  traits: Trait[];
  subspecies: Subspecies[];
}

export interface Background {
  index: string;
  name: string;
  ability_scores: string[];
  feat?: Ref;
  proficiencies: Ref[];
  equipment_options: Choice[];
  description?: string[] | string;
}

export interface Feat {
  index: string;
  name: string;
  type?: string;
  description?: string[] | string;
  prerequisite?: string;
}

export interface Feature {
  index: string;
  name: string;
  level?: number;
  class?: string;
  subclass?: string;
  description?: string[] | string;
}

export type FeatureMap = Record<string, Feature>;

export interface ClassSpellcasting {
  ability: string;
  info: { name: string; desc: string[] }[];
}

export interface DndClass {
  index: string;
  name: string;
  hit_die: number;
  primary_ability?: string;
  saving_throws: string[];
  armor_proficiencies: string[];
  weapon_proficiencies: string[];
  tool_proficiencies: string[];
  skill_choices: Choice[];
  starting_equipment_options: Choice[];
  spellcasting?: ClassSpellcasting;
  subclasses: Ref[];
}

export interface SubclassFeature {
  name: string;
  level: number;
  description?: string[] | string;
}

export interface Subclass {
  index: string;
  name: string;
  class: string;
  summary?: string;
  description?: string[] | string;
  features: SubclassFeature[];
}

export interface ClassLevel {
  class: string;
  level: number;
  prof_bonus: number;
  features: string[];
  class_specific?: Record<string, unknown>;
}

export interface EquipmentItem {
  index: string;
  name: string;
  categories: string[];
  cost?: { quantity: number; unit: string };
  weight?: number;
  description?: string;
  damage?: { damage_dice: string; damage_type: Ref };
  armor_class?: { base: number; dex_bonus: boolean; max_bonus?: number };
  str_minimum?: number;
  stealth_disadvantage?: boolean;
  range?: { normal: number; long?: number };
  throw_range?: { normal: number; long?: number };
  properties: string[];
  weapon_category?: string;
  weapon_range?: string;
  armor_category?: string;
}

export interface MagicItem {
  index: string;
  name: string;
  category?: string;
  rarity?: string;
  attunement?: boolean;
  description?: string;
}

export interface MonsterAction {
  name: string;
  description?: string;
}

export interface Monster {
  index: string;
  name: string;
  size: string;
  type: string;
  subtype?: string;
  alignment?: string;
  armor_class: { type: string; value: number }[];
  hit_points: number;
  hit_dice: string;
  speed: Record<string, string>;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  proficiencies: { name: string; value: number }[];
  damage_vulnerabilities: string[];
  damage_resistances: string[];
  damage_immunities: string[];
  condition_immunities: string[];
  senses?: Record<string, string | number>;
  languages?: string;
  challenge_rating: number;
  xp: number;
  special_abilities: MonsterAction[];
  actions: MonsterAction[];
  legendary_actions: MonsterAction[];
}

export interface Spell {
  index: string;
  name: string;
  level: number;
  school?: string;
  casting_time?: string;
  range?: string;
  components?: string[];
  material?: string;
  ritual?: boolean;
  concentration?: boolean;
  duration?: string;
  description?: string;
  higher_level?: string;
  classes: string[];
}
