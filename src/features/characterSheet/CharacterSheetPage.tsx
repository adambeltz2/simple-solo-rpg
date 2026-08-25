import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCharacterStore } from '../../store/useCharacterStore';
import {
  classByIndex, speciesByIndex, backgroundByIndex, subclassesForClass, alignments,
  skills as allSkills, spellsForClass, byIndex, feats as allFeats, levelForClass, featureByIndex,
} from '../../data/srd';
import {
  ABILITY_KEYS, abilityModifier, formatModifier, proficiencyBonus, effectiveAbility,
  skillModifier, savingThrowModifier, computeArmorClass, hitDiceRemaining, xpForNextLevel,
  type AbilityKey,
} from '../../domain/character';
import { rollD20, parseAndRoll } from '../../domain/dice';

const ABBR: Record<AbilityKey, string> = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };

export default function CharacterSheetPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const character = useCharacterStore((s) => (id ? s.characters[id] : undefined));
  const update = useCharacterStore((s) => s.updateCharacter);
  const addRoll = useCharacterStore((s) => s.addRollLogEntry);
  const addItem = useCharacterStore((s) => s.addInventoryItem);
  const updateItem = useCharacterStore((s) => s.updateInventoryItem);
  const removeItem = useCharacterStore((s) => s.removeInventoryItem);
  const addFeatureNote = useCharacterStore((s) => s.addFeatureNote);
  const removeFeatureNote = useCharacterStore((s) => s.removeFeatureNote);

  const [newItemName, setNewItemName] = useState('');
  const [showLevelUp, setShowLevelUp] = useState(false);

  if (!id || !character) {
    return (
      <div className="panel">
        <p>Character not found.</p>
        <button className="btn" onClick={() => navigate('/')}>Back to roster</button>
      </div>
    );
  }

  const klass = classByIndex(character.classIndex);
  const sp = speciesByIndex(character.speciesIndex);
  const subspecies = sp?.subspecies.find((s) => s.index === character.subspeciesIndex);
  const bg = backgroundByIndex(character.backgroundIndex);
  const subclasses = subclassesForClass(character.classIndex);
  const subclass = subclasses.find((s) => s.index === character.subclassIndex);
  const alignment = alignments.find((a) => a.index === character.alignmentIndex);
  const pb = proficiencyBonus(character.level);
  const ac = computeArmorClass(character);

  function rollAbility(key: AbilityKey) {
    const mod = abilityModifier(effectiveAbility(character!, key));
    const result = rollD20(mod);
    addRoll(id!, {
      label: `${ABBR[key]} check`, formula: `d20${formatModifier(mod)}`,
      rolls: result.rolls as number[], total: result.total, advantage: result.advantage, isNat20: result.isNat20, isNat1: result.isNat1,
    });
  }
  function rollSave(key: AbilityKey) {
    const mod = savingThrowModifier(character!, key);
    const result = rollD20(mod);
    addRoll(id!, {
      label: `${ABBR[key]} save`, formula: `d20${formatModifier(mod)}`,
      rolls: result.rolls as number[], total: result.total, advantage: result.advantage, isNat20: result.isNat20, isNat1: result.isNat1,
    });
  }
  function rollSkill(skillIndex: string, skillName: string, ability: AbilityKey) {
    const mod = skillModifier(character!, skillIndex, ability);
    const result = rollD20(mod);
    addRoll(id!, {
      label: skillName, formula: `d20${formatModifier(mod)}`,
      rolls: result.rolls as number[], total: result.total, advantage: result.advantage, isNat20: result.isNat20, isNat1: result.isNat1,
    });
  }
  function rollInitiative() {
    const mod = abilityModifier(effectiveAbility(character!, 'dex')) + character!.initiativeBonus;
    const result = rollD20(mod);
    addRoll(id!, {
      label: 'Initiative', formula: `d20${formatModifier(mod)}`,
      rolls: result.rolls as number[], total: result.total, advantage: null, isNat20: result.isNat20, isNat1: result.isNat1,
    });
  }

  function adjustHp(delta: number) {
    update(id!, (c) => {
      let hp = c.currentHp + delta;
      let temp = c.tempHp;
      if (delta < 0 && temp > 0) {
        const fromTemp = Math.min(temp, -delta);
        temp -= fromTemp;
        hp = c.currentHp - (-delta - fromTemp);
      }
      hp = Math.max(0, Math.min(c.maxHp, hp));
      return { currentHp: hp, tempHp: temp };
    });
  }

  function toggleSkillProf(skillIndex: string) {
    update(id!, (c) => {
      const has = c.skillProficiencies.includes(skillIndex);
      const hasExpertise = c.skillExpertise.includes(skillIndex);
      if (!has) return { skillProficiencies: [...c.skillProficiencies, skillIndex] };
      if (has && !hasExpertise) return { skillExpertise: [...c.skillExpertise, skillIndex] };
      return {
        skillProficiencies: c.skillProficiencies.filter((s) => s !== skillIndex),
        skillExpertise: c.skillExpertise.filter((s) => s !== skillIndex),
      };
    });
  }

  function shortRest() {
    update(id!, { conditions: character!.conditions });
  }
  function longRest() {
    update(id!, (c) => ({
      currentHp: c.maxHp,
      tempHp: 0,
      hitDiceUsed: Math.max(0, c.hitDiceUsed - Math.ceil(c.level / 2)),
      deathSaveSuccesses: 0,
      deathSaveFailures: 0,
      spellSlots: Object.fromEntries(Object.entries(c.spellSlots).map(([lvl, slot]) => [lvl, { ...slot, used: 0 }])),
    }));
  }

  function levelUp() {
    const nextLevel = Math.min(20, character!.level + 1);
    const conMod = abilityModifier(effectiveAbility(character!, 'con'));
    const hitDie = klass?.hit_die ?? 8;
    const avgGain = Math.floor(hitDie / 2) + 1 + conMod;
    update(id!, (c) => ({ level: nextLevel, maxHp: c.maxHp + Math.max(1, avgGain), currentHp: c.currentHp + Math.max(1, avgGain) }));
    const info = levelForClass(character!.classIndex, nextLevel);
    info?.features.forEach((fIndex) => {
      const feature = featureByIndex(fIndex);
      if (feature) {
        addFeatureNote(id!, {
          name: feature.name, source: `${klass?.name} ${nextLevel}`,
          description: Array.isArray(feature.description) ? feature.description.join('\n') : feature.description ?? '',
        });
      }
    });
    setShowLevelUp(false);
  }

  const spellcasting = klass?.spellcasting;
  const classSpells = spellcasting ? spellsForClass(character.classIndex) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>{character.name}</h2>
          <div style={{ color: 'var(--text-dim)' }}>
            {sp?.name}{subspecies ? ` (${subspecies.name})` : ''} · {klass?.name}{subclass ? ` (${subclass.name})` : ''} · {bg?.name}
            {alignment ? ` · ${alignment.name}` : ''}
          </div>
          <div style={{ marginTop: 6, display: 'flex', gap: 10, alignItems: 'center', color: 'var(--text-dim)', fontSize: '0.9rem' }}>
            <span>Level {character.level}</span>
            <span>XP {character.xp} / {xpForNextLevel(character.level)}</span>
            <input
              type="number" value={character.xp} onChange={(e) => update(id!, { xp: Number(e.target.value) })}
              style={{ width: 80 }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={shortRest} title="Marks a short rest (spell slots persist; adjust HP/resources manually)">Short Rest</button>
          <button className="btn" onClick={longRest}>Long Rest</button>
          <button className="btn btn-primary" onClick={() => setShowLevelUp(true)} disabled={character.level >= 20}>Level Up</button>
        </div>
      </div>

      {showLevelUp && (
        <div className="panel" style={{ borderColor: 'var(--accent)' }}>
          <p>Advance {character.name} to level {character.level + 1}? This adds average hit points for a d{klass?.hit_die} hit die and logs any new class features to your Features list.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={levelUp}>Confirm Level Up</button>
            <button className="btn" onClick={() => setShowLevelUp(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <div className="panel">
          <div className="panel-title">Ability Scores</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {ABILITY_KEYS.map((k) => {
              const total = effectiveAbility(character, k);
              const mod = abilityModifier(total);
              return (
                <button key={k} className="stat-block" style={{ border: 'none', cursor: 'pointer' }} onClick={() => rollAbility(k)} title="Click to roll a check">
                  <span className="stat-label">{ABBR[k]}</span>
                  <span className="stat-mod">{formatModifier(mod)}</span>
                  <span className="stat-score">{total}</span>
                </button>
              );
            })}
          </div>
          <hr className="divider" />
          <div className="panel-title">Saving Throws</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {ABILITY_KEYS.map((k) => (
              <button key={k} className="btn btn-sm" style={{ justifyContent: 'space-between', background: character.savingThrowProficiencies.includes(k) ? 'var(--bg-panel)' : undefined }} onClick={() => rollSave(k)}>
                <span>{character.savingThrowProficiencies.includes(k) ? '●' : '○'} {ABBR[k]} Save</span>
                <span>{formatModifier(savingThrowModifier(character, k))}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Combat</div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 10, flexWrap: 'wrap' }}>
            <div className="stat-block"><span className="stat-label">AC</span><span className="stat-mod">{ac}</span></div>
            <button className="stat-block" style={{ border: 'none', cursor: 'pointer' }} onClick={rollInitiative}>
              <span className="stat-label">Initiative</span>
              <span className="stat-mod">{formatModifier(abilityModifier(effectiveAbility(character, 'dex')) + character.initiativeBonus)}</span>
            </button>
            <div className="stat-block"><span className="stat-label">Speed</span><span className="stat-mod">{character.speedOverride ?? sp?.speed ?? 30}</span></div>
            <div className="stat-block"><span className="stat-label">Prof.</span><span className="stat-mod">{formatModifier(pb)}</span></div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div className="panel-title">Hit Points</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className="btn btn-sm" onClick={() => adjustHp(-1)}>-1</button>
              <button className="btn btn-sm" onClick={() => adjustHp(-5)}>-5</button>
              <span style={{ fontSize: '1.2rem', fontWeight: 700 }}>{character.currentHp} / {character.maxHp}</span>
              <button className="btn btn-sm" onClick={() => adjustHp(1)}>+1</button>
              <button className="btn btn-sm" onClick={() => adjustHp(5)}>+5</button>
              <label style={{ marginLeft: 10, fontSize: '0.85rem' }}>
                Temp HP <input type="number" value={character.tempHp} onChange={(e) => update(id!, { tempHp: Number(e.target.value) })} style={{ width: 56 }} />
              </label>
            </div>
          </div>
          {character.currentHp === 0 && (
            <div style={{ marginBottom: 10 }}>
              <div className="panel-title">Death Saves</div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div>
                  Successes {' '}
                  {[0, 1, 2].map((i) => (
                    <input key={i} type="checkbox" checked={character.deathSaveSuccesses > i} onChange={() => update(id!, { deathSaveSuccesses: character.deathSaveSuccesses > i ? i : i + 1 })} />
                  ))}
                </div>
                <div>
                  Failures {' '}
                  {[0, 1, 2].map((i) => (
                    <input key={i} type="checkbox" checked={character.deathSaveFailures > i} onChange={() => update(id!, { deathSaveFailures: character.deathSaveFailures > i ? i : i + 1 })} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>Hit Dice: {hitDiceRemaining(character)}/{character.level} (d{klass?.hit_die})</span>
            <label>
              <input type="checkbox" checked={character.inspiration} onChange={(e) => update(id!, { inspiration: e.target.checked })} /> Heroic Inspiration
            </label>
          </div>
          <div style={{ marginTop: 10 }}>
            <div className="panel-title">AC Override (leave blank to auto-calc from equipped armor)</div>
            <input
              type="number" placeholder="auto" value={character.acOverride ?? ''}
              onChange={(e) => update(id!, { acOverride: e.target.value === '' ? null : Number(e.target.value) })}
              style={{ width: 80 }}
            />
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Skills</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 340, overflowY: 'auto' }}>
            {allSkills.map((skill) => {
              const ability = skill.ability as AbilityKey;
              const prof = character.skillProficiencies.includes(skill.index);
              const expertise = character.skillExpertise.includes(skill.index);
              return (
                <div key={skill.index} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.88rem' }}>
                  <button className="btn btn-sm" style={{ width: 26, padding: 0 }} onClick={() => toggleSkillProf(skill.index)} title="Click to cycle: none -> proficient -> expertise -> none">
                    {expertise ? '◆' : prof ? '●' : '○'}
                  </button>
                  <button className="btn btn-sm" style={{ flex: 1, justifyContent: 'space-between', display: 'flex' }} onClick={() => rollSkill(skill.index, skill.name, ability)}>
                    <span>{skill.name} <span style={{ color: 'var(--text-faint)' }}>({ABBR[ability]})</span></span>
                    <span>{formatModifier(skillModifier(character, skill.index, ability))}</span>
                  </button>
                </div>
              );
            })}
          </div>
          <hr className="divider" />
          <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
            Passive Perception: {10 + skillModifier(character, 'perception', 'wis')}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Features &amp; Traits</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {character.feats.map((fIndex) => {
            const feat = byIndex(allFeats, fIndex);
            if (!feat) return null;
            return (
              <div key={fIndex}>
                <strong>{feat.name}</strong> <span className="tag">Feat</span>
                <div style={{ color: 'var(--text-dim)', fontSize: '0.88rem', whiteSpace: 'pre-wrap' }}>
                  {Array.isArray(feat.description) ? feat.description.join('\n') : feat.description}
                </div>
              </div>
            );
          })}
          {character.featureNotes.map((note) => (
            <div key={note.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div><strong>{note.name}</strong> <span className="tag">{note.source}</span></div>
                <button className="btn btn-sm" onClick={() => removeFeatureNote(id!, note.id)}>Remove</button>
              </div>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.88rem', whiteSpace: 'pre-wrap' }}>{note.description}</div>
            </div>
          ))}
          {character.feats.length === 0 && character.featureNotes.length === 0 && (
            <div style={{ color: 'var(--text-faint)' }}>No features logged yet. Level up to gain class features automatically.</div>
          )}
        </div>
      </div>

      {spellcasting && (
        <div className="panel">
          <div className="panel-title">Spellcasting ({spellcasting.ability.toUpperCase()})</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: 8 }}>
            Spell Save DC {8 + pb + abilityModifier(effectiveAbility(character, spellcasting.ability as AbilityKey))} · Spell Attack {formatModifier(pb + abilityModifier(effectiveAbility(character, spellcasting.ability as AbilityKey)))}
          </div>
          <details>
            <summary style={{ cursor: 'pointer', marginBottom: 8 }}>Manage prepared/known spells ({character.spellsPrepared.length} prepared)</summary>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 260, overflowY: 'auto', marginTop: 8 }}>
              {classSpells.map((spell) => {
                const known = character.spellsPrepared.includes(spell.index);
                return (
                  <label key={spell.index} className="tag" style={{ borderColor: known ? 'var(--accent)' : undefined }}>
                    <input
                      type="checkbox" checked={known}
                      onChange={() => update(id!, (c) => ({
                        spellsPrepared: known ? c.spellsPrepared.filter((s) => s !== spell.index) : [...c.spellsPrepared, spell.index],
                      }))}
                    /> {spell.name} (lv {spell.level})
                  </label>
                );
              })}
            </div>
          </details>
        </div>
      )}

      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="panel-title">Inventory ({character.gold} gp)</div>
          <label style={{ fontSize: '0.85rem' }}>
            Gold <input type="number" value={character.gold} onChange={(e) => update(id!, { gold: Number(e.target.value) })} style={{ width: 70 }} />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input placeholder="Add item..." value={newItemName} onChange={(e) => setNewItemName(e.target.value)} style={{ flex: 1 }} />
          <button
            className="btn"
            onClick={() => {
              if (!newItemName.trim()) return;
              addItem(id!, { name: newItemName.trim(), quantity: 1 });
              setNewItemName('');
            }}
          >
            Add
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {character.inventory.map((item) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem' }}>
              {(item.isArmor || item.isShield) && (
                <input type="checkbox" checked={!!item.equipped} onChange={(e) => updateItem(id!, item.id, { equipped: e.target.checked })} title="Equipped" />
              )}
              <span style={{ flex: 1 }}>{item.name}{item.weight ? ` (${item.weight} lb)` : ''}</span>
              <input
                type="number" min={0} value={item.quantity}
                onChange={(e) => updateItem(id!, item.id, { quantity: Number(e.target.value) })}
                style={{ width: 50 }}
              />
              <button className="btn btn-sm btn-danger" onClick={() => removeItem(id!, item.id)}>x</button>
            </div>
          ))}
          {character.inventory.length === 0 && <div style={{ color: 'var(--text-faint)' }}>Empty pack.</div>}
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Notes</div>
        <textarea value={character.notes} onChange={(e) => update(id!, { notes: e.target.value })} rows={4} style={{ width: '100%', resize: 'vertical' }} />
      </div>

      <RollLog characterId={id} />
    </div>
  );
}

function RollLog({ characterId }: { characterId: string }) {
  const character = useCharacterStore((s) => s.characters[characterId]);
  const [formula, setFormula] = useState('1d20');
  const addRoll = useCharacterStore((s) => s.addRollLogEntry);
  const clearLog = useCharacterStore((s) => s.clearRollLog);
  if (!character) return null;

  function quickRoll() {
    try {
      const { rolls, total } = parseAndRoll(formula);
      addRoll(characterId, { label: 'Quick roll', formula, rolls, total });
    } catch {
      alert('Enter dice like 2d6+3');
    }
  }

  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div className="panel-title">Recent Rolls</div>
        <button className="btn btn-sm" onClick={() => clearLog(characterId)}>Clear</button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input value={formula} onChange={(e) => setFormula(e.target.value)} style={{ width: 120 }} />
        <button className="btn" onClick={quickRoll}>Roll</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 200, overflowY: 'auto' }}>
        {character.rollLog.slice(0, 20).map((r) => (
          <div key={r.id} style={{ fontSize: '0.85rem', color: 'var(--text-dim)', display: 'flex', justifyContent: 'space-between' }}>
            <span>{r.label} <span style={{ color: 'var(--text-faint)' }}>[{r.rolls.join(', ')}] {r.formula}</span></span>
            <strong style={{ color: r.isNat20 ? 'var(--gold)' : r.isNat1 ? 'var(--blood-strong)' : 'var(--text)' }}>{r.total}</strong>
          </div>
        ))}
        {character.rollLog.length === 0 && <div style={{ color: 'var(--text-faint)' }}>No rolls yet.</div>}
      </div>
    </div>
  );
}
