import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  species, classes, backgrounds, alignments, skills as allSkills, classByIndex,
  speciesByIndex, backgroundByIndex, subclassesForClass,
} from '../../data/srd';
import type { AbilityKey, Abilities } from '../../domain/character';
import { ABILITY_KEYS, abilityModifier, formatModifier } from '../../domain/character';
import {
  STANDARD_ARRAY, POINT_BUY_COST, POINT_BUY_BUDGET, pointBuyCost, emptyAbilities,
  distributeAbilityBonus, type AbilityMethod,
} from '../../domain/abilityScoreMethods';
import { resolveOption } from '../../domain/equipmentResolver';
import { buildCharacter } from '../../domain/characterFactory';
import { useCharacterStore } from '../../store/useCharacterStore';
import type { Choice } from '../../data/srdTypes';

const STEPS = ['Identity', 'Class', 'Background', 'Abilities', 'Skills', 'Equipment', 'Review'];

function optionLabel(option: { index?: string; name?: string; count?: number; money?: string; multiple?: { name?: string; index?: string; count?: number; money?: string }[] }): string {
  if ('money' in option && option.money) return `${option.money}`;
  if (option.multiple) return option.multiple.map(optionLabel).join(', ');
  return `${option.count && option.count > 1 ? `${option.count}x ` : ''}${option.name}`;
}

export default function CreateCharacterPage() {
  const navigate = useNavigate();
  const addCharacter = useCharacterStore((s) => s.addCharacter);
  const [step, setStep] = useState(0);

  const [name, setName] = useState('');
  const [speciesIndex, setSpeciesIndex] = useState(species[0]?.index ?? '');
  const [subspeciesIndex, setSubspeciesIndex] = useState<string | undefined>(undefined);
  const [alignmentIndex, setAlignmentIndex] = useState<string | undefined>(undefined);

  const [classIndex, setClassIndex] = useState(classes[0]?.index ?? '');
  const [subclassIndex, setSubclassIndex] = useState<string | undefined>(undefined);

  const [backgroundIndex, setBackgroundIndex] = useState(backgrounds[0]?.index ?? '');
  const [bonusChoice, setBonusChoice] = useState<'two-one' | 'one-one-one'>('two-one');
  const [bonusPicks, setBonusPicks] = useState<AbilityKey[]>([]);

  const [method, setMethod] = useState<AbilityMethod>('standard-array');
  const [abilities, setAbilities] = useState<Abilities>(emptyAbilities());
  const [arrayAssignment, setArrayAssignment] = useState<Record<AbilityKey, number | null>>({
    str: null, dex: null, con: null, int: null, wis: null, cha: null,
  });

  const [skillPicks, setSkillPicks] = useState<string[]>([]);
  const [classEquipChoice, setClassEquipChoice] = useState<Record<number, number>>({});
  const [bgEquipChoice, setBgEquipChoice] = useState<Record<number, number>>({});

  const selectedSpecies = speciesByIndex(speciesIndex);
  const selectedClass = classByIndex(classIndex);
  const selectedBackground = backgroundByIndex(backgroundIndex);
  const availableSubclasses = subclassesForClass(classIndex);
  const bgAbilities = (selectedBackground?.ability_scores ?? []) as AbilityKey[];
  const backgroundBonuses = useMemo(() => distributeAbilityBonus(bonusChoice, bonusPicks), [bonusChoice, bonusPicks]);

  const pbCost = pointBuyCost(abilities);
  const usedArrayValues = Object.values(arrayAssignment).filter((v): v is number => v !== null);
  const remainingArrayValues = STANDARD_ARRAY.filter((v) => !usedArrayValues.includes(v));

  function setArrayValue(key: AbilityKey, value: number | null) {
    setArrayAssignment((prev) => ({ ...prev, [key]: value }));
    setAbilities((prev) => ({ ...prev, [key]: value ?? 8 }));
  }

  const backgroundSkillProfs = (selectedBackground?.proficiencies ?? [])
    .filter((p) => p.index.startsWith('skill-'))
    .map((p) => p.index.replace('skill-', ''));
  const backgroundToolProfs = (selectedBackground?.proficiencies ?? [])
    .filter((p) => !p.index.startsWith('skill-'))
    .map((p) => p.name);

  const classSkillChoice: Choice | undefined = selectedClass?.skill_choices[0];

  function toggleSkillPick(skillIndex: string) {
    setSkillPicks((prev) => {
      if (prev.includes(skillIndex)) return prev.filter((s) => s !== skillIndex);
      if (classSkillChoice && prev.length >= classSkillChoice.choose) return prev;
      return [...prev, skillIndex];
    });
  }

  function canProceed(): boolean {
    switch (step) {
      case 0: return name.trim().length > 0 && !!speciesIndex;
      case 1: return !!classIndex;
      case 2: return !!backgroundIndex && Object.values(backgroundBonuses).reduce((a, b) => a + (b ?? 0), 0) === 3;
      case 3:
        if (method === 'point-buy') return pbCost <= POINT_BUY_BUDGET;
        if (method === 'standard-array') return ABILITY_KEYS.every((k) => arrayAssignment[k] !== null);
        return true;
      case 4: return !classSkillChoice || skillPicks.length === classSkillChoice.choose;
      default: return true;
    }
  }

  function handleCreate() {
    let inventory: ReturnType<typeof resolveOption>['items'] = [];
    let gold = 0;

    (selectedClass?.starting_equipment_options ?? []).forEach((choice, i) => {
      const pick = classEquipChoice[i] ?? 0;
      const opt = choice.options[pick];
      if (opt) {
        const resolved = resolveOption(opt);
        inventory = inventory.concat(resolved.items);
        gold += resolved.gold;
      }
    });
    (selectedBackground?.equipment_options ?? []).forEach((choice, i) => {
      const pick = bgEquipChoice[i] ?? 0;
      const opt = choice.options[pick];
      if (opt) {
        const resolved = resolveOption(opt);
        inventory = inventory.concat(resolved.items);
        gold += resolved.gold;
      }
    });

    const character = buildCharacter({
      name: name.trim(),
      speciesIndex,
      subspeciesIndex,
      classIndex,
      subclassIndex,
      backgroundIndex,
      alignmentIndex,
      abilities,
      backgroundAbilityBonuses: backgroundBonuses,
      skillProficiencies: Array.from(new Set([...backgroundSkillProfs, ...skillPicks])),
      toolProficiencies: backgroundToolProfs,
      languages: ['Common'],
      feats: selectedBackground?.feat ? [selectedBackground.feat.index] : [],
      gold,
    });
    character.inventory = inventory;
    addCharacter(character);
    navigate(`/character/${character.id}`);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h2>Create a Character</h2>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STEPS.map((s, i) => (
            <span key={s} className="tag" style={{ borderColor: i === step ? 'var(--accent)' : undefined, color: i === step ? 'var(--accent-strong)' : undefined }}>
              {i + 1}. {s}
            </span>
          ))}
        </div>
      </div>

      <div className="panel">
        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label>
              <div className="panel-title">Character Name</div>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ardyn Vale" style={{ width: '100%' }} />
            </label>
            <label>
              <div className="panel-title">Species</div>
              <select value={speciesIndex} onChange={(e) => { setSpeciesIndex(e.target.value); setSubspeciesIndex(undefined); }} style={{ width: '100%' }}>
                {species.map((s) => <option key={s.index} value={s.index}>{s.name}</option>)}
              </select>
            </label>
            {selectedSpecies && selectedSpecies.subspecies.length > 0 && (
              <label>
                <div className="panel-title">Lineage</div>
                <select value={subspeciesIndex ?? ''} onChange={(e) => setSubspeciesIndex(e.target.value || undefined)} style={{ width: '100%' }}>
                  <option value="">None</option>
                  {selectedSpecies.subspecies.map((ss) => <option key={ss.index} value={ss.index}>{ss.name}</option>)}
                </select>
              </label>
            )}
            {selectedSpecies && (
              <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
                Size {selectedSpecies.size} · Speed {selectedSpecies.speed} ft.
                <ul>
                  {selectedSpecies.traits.map((t) => <li key={t.index}><strong>{t.name}.</strong> {t.description}</li>)}
                </ul>
              </div>
            )}
            <label>
              <div className="panel-title">Alignment (optional)</div>
              <select value={alignmentIndex ?? ''} onChange={(e) => setAlignmentIndex(e.target.value || undefined)} style={{ width: '100%' }}>
                <option value="">Unspecified</option>
                {alignments.map((a) => <option key={a.index} value={a.index}>{a.name}</option>)}
              </select>
            </label>
          </div>
        )}

        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label>
              <div className="panel-title">Class</div>
              <select value={classIndex} onChange={(e) => { setClassIndex(e.target.value); setSubclassIndex(undefined); }} style={{ width: '100%' }}>
                {classes.map((c) => <option key={c.index} value={c.index}>{c.name}</option>)}
              </select>
            </label>
            {selectedClass && (
              <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
                Hit Die d{selectedClass.hit_die} · Primary Ability {selectedClass.primary_ability} · Saving Throws{' '}
                {selectedClass.saving_throws.map((s) => s.toUpperCase()).join(', ')}
              </div>
            )}
            {availableSubclasses.length > 0 && (
              <label>
                <div className="panel-title">Subclass (chosen for planning — most classes gain this at level 3)</div>
                <select value={subclassIndex ?? ''} onChange={(e) => setSubclassIndex(e.target.value || undefined)} style={{ width: '100%' }}>
                  <option value="">Decide later</option>
                  {availableSubclasses.map((sc) => <option key={sc.index} value={sc.index}>{sc.name}</option>)}
                </select>
              </label>
            )}
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label>
              <div className="panel-title">Background</div>
              <select value={backgroundIndex} onChange={(e) => { setBackgroundIndex(e.target.value); setBonusPicks([]); }} style={{ width: '100%' }}>
                {backgrounds.map((b) => <option key={b.index} value={b.index}>{b.name}</option>)}
              </select>
            </label>
            {selectedBackground && (
              <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
                Grants proficiency: {selectedBackground.proficiencies.map((p) => p.name.replace(/^Skill: |^Tool: /, '')).join(', ')}
                <br />
                Grants Origin Feat: <strong>{selectedBackground.feat?.name}</strong>
              </div>
            )}
            <div>
              <div className="panel-title">Ability Score Bonus (+2/+1 or +1/+1/+1 among {bgAbilities.map((a) => a.toUpperCase()).join(', ')})</div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                <label><input type="radio" checked={bonusChoice === 'two-one'} onChange={() => { setBonusChoice('two-one'); setBonusPicks([]); }} /> +2 / +1</label>
                <label><input type="radio" checked={bonusChoice === 'one-one-one'} onChange={() => { setBonusChoice('one-one-one'); setBonusPicks([]); }} /> +1 / +1 / +1</label>
              </div>
              {bonusChoice === 'two-one' ? (
                <div style={{ display: 'flex', gap: 10 }}>
                  <label>
                    +2 to
                    <select value={bonusPicks[0] ?? ''} onChange={(e) => setBonusPicks([e.target.value as AbilityKey, bonusPicks[1]])}>
                      <option value="">-</option>
                      {bgAbilities.map((a) => <option key={a} value={a} disabled={a === bonusPicks[1]}>{a.toUpperCase()}</option>)}
                    </select>
                  </label>
                  <label>
                    +1 to
                    <select value={bonusPicks[1] ?? ''} onChange={(e) => setBonusPicks([bonusPicks[0], e.target.value as AbilityKey])}>
                      <option value="">-</option>
                      {bgAbilities.map((a) => <option key={a} value={a} disabled={a === bonusPicks[0]}>{a.toUpperCase()}</option>)}
                    </select>
                  </label>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {bgAbilities.map((a) => (
                    <label key={a} className="tag">
                      <input
                        type="checkbox"
                        checked={bonusPicks.includes(a)}
                        onChange={() => setBonusPicks((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : prev.length < 3 ? [...prev, a] : prev))}
                      /> {a.toUpperCase()}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <label><input type="radio" checked={method === 'standard-array'} onChange={() => setMethod('standard-array')} /> Standard Array</label>
              <label><input type="radio" checked={method === 'point-buy'} onChange={() => { setMethod('point-buy'); setAbilities(emptyAbilities()); }} /> Point Buy (27 pts)</label>
              <label><input type="radio" checked={method === 'manual'} onChange={() => setMethod('manual')} /> Manual / Rolled</label>
            </div>

            {method === 'standard-array' && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {ABILITY_KEYS.map((k) => (
                  <label key={k} className="stat-block" style={{ minWidth: 100 }}>
                    <span className="stat-label">{k.toUpperCase()}</span>
                    <select value={arrayAssignment[k] ?? ''} onChange={(e) => setArrayValue(k, e.target.value ? Number(e.target.value) : null)}>
                      <option value="">-</option>
                      {STANDARD_ARRAY.map((v, i) => (
                        <option key={i} value={v} disabled={!remainingArrayValues.includes(v) && arrayAssignment[k] !== v}>{v}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            )}

            {method === 'point-buy' && (
              <div>
                <div style={{ marginBottom: 8, color: pbCost > POINT_BUY_BUDGET ? 'var(--blood-strong)' : 'var(--text-dim)' }}>
                  Points used: {pbCost} / {POINT_BUY_BUDGET}
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {ABILITY_KEYS.map((k) => (
                    <div key={k} className="stat-block" style={{ minWidth: 100 }}>
                      <span className="stat-label">{k.toUpperCase()}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button className="btn btn-sm" onClick={() => setAbilities((p) => ({ ...p, [k]: Math.max(8, p[k] - 1) }))}>-</button>
                        <span className="stat-score">{abilities[k]}</span>
                        <button className="btn btn-sm" onClick={() => setAbilities((p) => ({ ...p, [k]: Math.min(15, p[k] + 1) }))}>+</button>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-faint)' }}>cost {POINT_BUY_COST[abilities[k]]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {method === 'manual' && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {ABILITY_KEYS.map((k) => (
                  <label key={k} className="stat-block" style={{ minWidth: 100 }}>
                    <span className="stat-label">{k.toUpperCase()}</span>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={abilities[k]}
                      onChange={(e) => setAbilities((p) => ({ ...p, [k]: Number(e.target.value) }))}
                      style={{ width: 56, textAlign: 'center' }}
                    />
                  </label>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {ABILITY_KEYS.map((k) => {
                const total = abilities[k] + (backgroundBonuses[k] ?? 0);
                return (
                  <div key={k} className="stat-block">
                    <span className="stat-label">{k.toUpperCase()}</span>
                    <span className="stat-mod">{formatModifier(abilityModifier(total))}</span>
                    <span className="stat-score">{total}{backgroundBonuses[k] ? ` (${abilities[k]}+${backgroundBonuses[k]})` : ''}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
              From Background ({selectedBackground?.name}): {backgroundSkillProfs.map((s) => allSkills.find((sk) => sk.index === s)?.name ?? s).join(', ') || 'none'}
            </div>
            {classSkillChoice ? (
              <div>
                <div className="panel-title">Choose {classSkillChoice.choose} class skill{classSkillChoice.choose > 1 ? 's' : ''} ({skillPicks.length}/{classSkillChoice.choose})</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {classSkillChoice.options.map((opt) => {
                    if (!('index' in opt)) return null;
                    const skillIndex = opt.index.replace('skill-', '');
                    const skill = allSkills.find((s) => s.index === skillIndex);
                    const checked = skillPicks.includes(skillIndex);
                    return (
                      <label key={opt.index} className="tag" style={{ borderColor: checked ? 'var(--accent)' : undefined }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleSkillPick(skillIndex)} /> {skill?.name ?? opt.name}
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--text-dim)' }}>This class grants no additional skill choices.</div>
            )}
          </div>
        )}

        {step === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <div className="panel-title">Class Starting Equipment</div>
              {(selectedClass?.starting_equipment_options ?? []).map((choice, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  {choice.description && <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: 4 }}>{choice.description}</div>}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {choice.options.map((opt, oi) => (
                      <label key={oi} className="tag" style={{ borderColor: classEquipChoice[i] === oi ? 'var(--accent)' : undefined }}>
                        <input type="radio" name={`class-eq-${i}`} checked={(classEquipChoice[i] ?? 0) === oi} onChange={() => setClassEquipChoice((p) => ({ ...p, [i]: oi }))} />{' '}
                        {optionLabel(opt as never)}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div>
              <div className="panel-title">Background Starting Equipment</div>
              {(selectedBackground?.equipment_options ?? []).map((choice, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  {choice.description && <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: 4 }}>{choice.description}</div>}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {choice.options.map((opt, oi) => (
                      <label key={oi} className="tag" style={{ borderColor: bgEquipChoice[i] === oi ? 'var(--accent)' : undefined }}>
                        <input type="radio" name={`bg-eq-${i}`} checked={(bgEquipChoice[i] ?? 0) === oi} onChange={() => setBgEquipChoice((p) => ({ ...p, [i]: oi }))} />{' '}
                        {optionLabel(opt as never)}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 6 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h3>{name || 'Unnamed'}</h3>
            <div style={{ color: 'var(--text-dim)' }}>
              {selectedSpecies?.name}{subspeciesIndex ? ` (${selectedSpecies?.subspecies.find((s) => s.index === subspeciesIndex)?.name})` : ''} · {selectedClass?.name} · {selectedBackground?.name}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
              {ABILITY_KEYS.map((k) => {
                const total = abilities[k] + (backgroundBonuses[k] ?? 0);
                return (
                  <div key={k} className="stat-block">
                    <span className="stat-label">{k.toUpperCase()}</span>
                    <span className="stat-mod">{formatModifier(abilityModifier(total))}</span>
                    <span className="stat-score">{total}</span>
                  </div>
                );
              })}
            </div>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
              Hit Die d{selectedClass?.hit_die} — starting HP {(selectedClass?.hit_die ?? 8) + abilityModifier(abilities.con + (backgroundBonuses.con ?? 0))}
            </p>
            <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={handleCreate}>Begin the Adventure</button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button className="btn" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>Back</button>
        {step < STEPS.length - 1 && (
          <button className="btn btn-primary" disabled={!canProceed()} onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>Next</button>
        )}
      </div>
    </div>
  );
}
