#!/usr/bin/env node
// Regenerates src/data/srd/*.json from a local clone of 5e-bits/5e-database.
//
// Usage:
//   git clone --depth 1 https://github.com/5e-bits/5e-database /tmp/5e-database
//   node scripts/extract-srd.cjs /tmp/5e-database
//
// See CLAUDE.md for when/why to re-run this (e.g. upstream publishes a fuller
// 2024 spell or monster list).
const fs = require('fs');
const path = require('path');

const repoRoot = process.argv[2];
if (!repoRoot) {
  console.error('Usage: node scripts/extract-srd.cjs <path-to-5e-database-clone>');
  process.exit(1);
}

const SRC24 = path.join(repoRoot, 'src/2024/en');
const SRC14 = path.join(repoRoot, 'src/2014/en');
const OUT = path.join(__dirname, '..', 'src/data/srd');

function load(dir, file) {
  return JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
}
function write(name, data) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(data));
  console.log(name, Array.isArray(data) ? `count=${data.length}` : 'object', `bytes=${fs.statSync(path.join(OUT, name)).size}`);
}
const strip = (ref) => ref && { index: ref.index, name: ref.name };
const stripList = (refs) => (refs || []).map(strip);

// ---------- 2024: reference tables ----------
const abilityScores = load(SRC24, '5e-SRD-Ability-Scores.json').map(a => ({
  index: a.index, name: a.name, full_name: a.full_name, description: a.desc || a.description,
}));
write('ability-scores.json', abilityScores);

const skills = load(SRC24, '5e-SRD-Skills.json').map(s => ({
  index: s.index, name: s.name, description: s.description, ability: s.ability_score.index,
}));
write('skills.json', skills);

const alignments = load(SRC24, '5e-SRD-Alignments.json').map(a => ({ index: a.index, name: a.name, abbreviation: a.abbreviation, description: a.desc || a.description }));
write('alignments.json', alignments);

const languages = load(SRC24, '5e-SRD-Languages.json').map(l => ({ index: l.index, name: l.name, type: l.type, script: l.script }));
write('languages.json', languages);

const damageTypes = load(SRC24, '5e-SRD-Damage-Types.json').map(d => ({ index: d.index, name: d.name, description: d.desc || d.description }));
write('damage-types.json', damageTypes);

const conditions = load(SRC24, '5e-SRD-Conditions.json').map(c => ({ index: c.index, name: c.name, description: c.desc || c.description }));
write('conditions.json', conditions);

// ---------- 2024: traits (for species/subspecies join) ----------
const traitsRaw = load(SRC24, '5e-SRD-Traits.json');
const traitByIndex = new Map(traitsRaw.map(t => [t.index, t]));
function fullTrait(ref) {
  const t = traitByIndex.get(ref.index);
  if (!t) return { index: ref.index, name: ref.name, description: '' };
  return { index: t.index, name: t.name, description: t.description, level: ref.level };
}
write('traits.json', traitsRaw.map(t => ({ index: t.index, name: t.name, description: t.description })));

// ---------- 2024: species + subspecies ----------
const subspeciesRaw = load(SRC24, '5e-SRD-Subspecies.json');
const species = load(SRC24, '5e-SRD-Species.json').map(sp => ({
  index: sp.index,
  name: sp.name,
  type: sp.type,
  size: sp.size,
  size_description: sp.size_description,
  speed: sp.speed,
  traits: (sp.traits || []).map(fullTrait),
  subspecies: subspeciesRaw.filter(ss => ss.species.index === sp.index).map(ss => ({
    index: ss.index,
    name: ss.name,
    damage_type: ss.damage_type ? ss.damage_type.index : undefined,
    traits: (ss.traits || []).map(fullTrait),
  })),
}));
write('species.json', species);

// ---------- shared choice-simplification (used by backgrounds + classes) ----------
function simplifyChoice(pc) {
  if (!pc) return undefined;
  return {
    description: pc.desc,
    choose: pc.choose,
    options: pc.from && pc.from.options ? pc.from.options.map(o => {
      if (o.option_type === 'reference') return strip(o.item);
      if (o.option_type === 'counted_reference') return { ...strip(o.of), count: o.count };
      if (o.option_type === 'money') return { money: `${o.count} ${o.unit}` };
      if (o.option_type === 'multiple') return { multiple: o.items.map(i => {
        if (i.option_type === 'reference') return strip(i.item);
        if (i.option_type === 'counted_reference') return { ...strip(i.of), count: i.count };
        if (i.option_type === 'money') return { money: `${i.count} ${i.unit}` };
        return null;
      }).filter(Boolean) };
      return null;
    }).filter(Boolean) : [],
  };
}

// ---------- 2024: backgrounds ----------
const backgrounds = load(SRC24, '5e-SRD-Backgrounds.json').map(bg => ({
  index: bg.index,
  name: bg.name,
  ability_scores: stripList(bg.ability_scores).map(a => a.index),
  feat: bg.feat ? strip(bg.feat) : undefined,
  proficiencies: stripList(bg.proficiencies),
  equipment_options: (bg.equipment_options || []).map(simplifyChoice),
  description: bg.description,
}));
write('backgrounds.json', backgrounds);

// ---------- 2024: feats ----------
const feats = load(SRC24, '5e-SRD-Feats.json').map(f => ({
  index: f.index, name: f.name, type: f.type, description: f.description, prerequisite: f.prerequisite,
}));
write('feats.json', feats);

// ---------- 2024: features (class/subclass feature text, keyed by index) ----------
const featuresRaw = load(SRC24, '5e-SRD-Features.json');
const features = {};
for (const f of featuresRaw) {
  features[f.index] = {
    index: f.index, name: f.name, level: f.level ? f.level.level : undefined,
    class: f.class ? f.class.index : undefined,
    subclass: f.subclass ? f.subclass.index : undefined,
    description: f.description,
  };
}
write('features.json', features);

// ---------- 2024: classes ----------
function simplifyEquipmentOptions(opts) {
  return (opts || []).map(o => simplifyChoice(o));
}

const classesRaw = load(SRC24, '5e-SRD-Classes.json');
const classes = classesRaw.map(c => ({
  index: c.index,
  name: c.name,
  hit_die: c.hit_die,
  primary_ability: c.primary_ability ? c.primary_ability.desc : undefined,
  saving_throws: stripList(c.saving_throws).map(s => s.index),
  armor_proficiencies: stripList(c.proficiencies).filter(p => /armor|shield/i.test(p.name)).map(p => p.name),
  weapon_proficiencies: stripList(c.proficiencies).filter(p => /weapon/i.test(p.name) && !/saving/i.test(p.name)).map(p => p.name),
  tool_proficiencies: stripList(c.proficiencies).filter(p => /tool/i.test(p.name)).map(p => p.name),
  skill_choices: (c.proficiency_choices || []).map(simplifyChoice),
  starting_equipment_options: simplifyEquipmentOptions(c.starting_equipment_options),
  spellcasting: c.spellcasting ? {
    ability: c.spellcasting.spellcasting_ability.index,
    info: c.spellcasting.info,
  } : undefined,
  subclasses: stripList(c.subclasses),
}));
write('classes.json', classes);

// ---------- 2024: subclasses ----------
const subclasses = load(SRC24, '5e-SRD-Subclasses.json').map(sc => ({
  index: sc.index,
  name: sc.name,
  class: sc.class.index,
  summary: sc.summary,
  description: sc.description,
  features: (sc.features || []).map(f => ({ name: f.name, level: f.level, description: f.description })),
}));
write('subclasses.json', subclasses);

// ---------- 2024: levels (progression table incl. class_specific + feature refs) ----------
const levels = load(SRC24, '5e-SRD-Levels.json').map(l => ({
  class: l.class.index,
  level: l.level,
  prof_bonus: l.prof_bonus,
  features: (l.features || []).map(f => f.index),
  class_specific: l.class_specific,
}));
write('levels.json', levels);

// ---------- 2024: equipment ----------
const equipment = load(SRC24, '5e-SRD-Equipment.json').map(e => ({
  index: e.index,
  name: e.name,
  categories: stripList(e.equipment_categories).map(c => c.name),
  cost: e.cost,
  weight: e.weight,
  description: Array.isArray(e.description) ? e.description.join('\n') : e.description,
  damage: e.damage,
  armor_class: e.armor_class,
  str_minimum: e.str_minimum,
  stealth_disadvantage: e.stealth_disadvantage,
  range: e.range,
  throw_range: e.throw_range,
  properties: stripList(e.properties).map(p => p.name),
  weapon_category: e.weapon_category,
  weapon_range: e.weapon_range,
  armor_category: e.armor_category,
}));
write('equipment.json', equipment);

// ---------- 2024: magic items ----------
const magicItems = load(SRC24, '5e-SRD-Magic-Items.json').map(m => ({
  index: m.index,
  name: m.name,
  category: m.equipment_category ? m.equipment_category.name : undefined,
  rarity: m.rarity ? m.rarity.name : undefined,
  attunement: m.attunement,
  description: Array.isArray(m.desc) ? m.desc.join('\n') : m.desc,
}));
write('magic-items.json', magicItems);

// ---------- 2014: monsters (2024 SRD monster list is still sparse upstream) ----------
const monsters = load(SRC14, '5e-SRD-Monsters.json').map(m => ({
  index: m.index,
  name: m.name,
  size: m.size,
  type: m.type,
  subtype: m.subtype,
  alignment: m.alignment,
  armor_class: m.armor_class,
  hit_points: m.hit_points,
  hit_dice: m.hit_dice,
  speed: m.speed,
  strength: m.strength, dexterity: m.dexterity, constitution: m.constitution,
  intelligence: m.intelligence, wisdom: m.wisdom, charisma: m.charisma,
  proficiencies: (m.proficiencies || []).map(p => ({ name: p.proficiency.name, value: p.value })),
  damage_vulnerabilities: m.damage_vulnerabilities,
  damage_resistances: m.damage_resistances,
  damage_immunities: m.damage_immunities,
  condition_immunities: (m.condition_immunities || []).map(c => c.name),
  senses: m.senses,
  languages: m.languages,
  challenge_rating: m.challenge_rating,
  xp: m.xp,
  special_abilities: (m.special_abilities || []).map(s => ({ name: s.name, description: s.desc })),
  actions: (m.actions || []).map(a => ({ name: a.name, description: a.desc })),
  legendary_actions: (m.legendary_actions || []).map(a => ({ name: a.name, description: a.desc })),
}));
write('monsters.json', monsters);

// ---------- 2014: spells ----------
const spells = load(SRC14, '5e-SRD-Spells.json').map(s => ({
  index: s.index,
  name: s.name,
  level: s.level,
  school: s.school ? s.school.name : undefined,
  casting_time: s.casting_time,
  range: s.range,
  components: s.components,
  material: s.material,
  ritual: s.ritual,
  concentration: s.concentration,
  duration: s.duration,
  description: Array.isArray(s.desc) ? s.desc.join('\n') : s.desc,
  higher_level: Array.isArray(s.higher_level) ? s.higher_level.join('\n') : s.higher_level,
  classes: (s.classes || []).map(c => c.index),
}));
write('spells.json', spells);

console.log('DONE');
