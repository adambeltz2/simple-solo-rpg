import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useCharacterStore } from '../../store/useCharacterStore';
import type { CombatantRef, EncounterState } from '../../domain/character';
import { createId, computeArmorClass } from '../../domain/character';
import { monsters, byIndex } from '../../data/srd';
import { rollD20 } from '../../domain/dice';

export default function CombatPage() {
  const { id } = useParams();
  const character = useCharacterStore((s) => (id ? s.characters[id] : undefined));
  const setEncounter = useCharacterStore((s) => s.setEncounter);
  const updateCombatant = useCharacterStore((s) => s.updateCombatant);
  const addJournal = useCharacterStore((s) => s.addJournalEntry);

  const [monsterQuery, setMonsterQuery] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualHp, setManualHp] = useState(10);
  const [manualAc, setManualAc] = useState(12);

  if (!id || !character) return <div className="panel">Select a character first.</div>;

  const encounter = character.encounter;

  function startEncounter() {
    const pc: CombatantRef = {
      id: createId(), name: character!.name, isPC: true, initiative: 0,
      maxHp: character!.maxHp, currentHp: character!.currentHp, tempHp: character!.tempHp,
      ac: computeArmorClass(character!), conditions: [],
    };
    const newEncounter: EncounterState = { id: createId(), name: 'Encounter', round: 1, activeIndex: 0, combatants: [pc], active: true };
    setEncounter(id!, newEncounter);
  }

  function addCombatant(c: Omit<CombatantRef, 'id'>) {
    if (!encounter) return;
    setEncounter(id!, { ...encounter, combatants: [...encounter.combatants, { ...c, id: createId() }] });
  }

  function addMonster(monsterIndex: string) {
    const m = byIndex(monsters, monsterIndex);
    if (!m) return;
    addCombatant({
      name: m.name, isPC: false, monsterIndex, initiative: 0,
      maxHp: m.hit_points, currentHp: m.hit_points, tempHp: 0, ac: m.armor_class[0]?.value ?? 10, conditions: [],
    });
  }

  function addManual() {
    if (!manualName.trim()) return;
    addCombatant({ name: manualName.trim(), isPC: false, initiative: 0, maxHp: manualHp, currentHp: manualHp, tempHp: 0, ac: manualAc, conditions: [] });
    setManualName('');
  }

  function rollAllInitiative() {
    if (!encounter) return;
    let groupRoll: number | null = null;
    const updated = encounter.combatants.map((c) => {
      if (c.isPC || c.isSidekick) {
        return { ...c, initiative: rollD20(0).total };
      }
      if (groupRoll === null) groupRoll = rollD20(0).total;
      return { ...c, initiative: groupRoll };
    });
    const sorted = [...updated].sort((a, b) => b.initiative - a.initiative);
    setEncounter(id!, { ...encounter, combatants: sorted, activeIndex: 0, round: 1 });
  }

  function nextTurn() {
    if (!encounter) return;
    const nextIndex = encounter.activeIndex + 1;
    if (nextIndex >= encounter.combatants.length) {
      setEncounter(id!, { ...encounter, activeIndex: 0, round: encounter.round + 1 });
    } else {
      setEncounter(id!, { ...encounter, activeIndex: nextIndex });
    }
  }

  function endEncounter() {
    if (!encounter) return;
    addJournal(id!, {
      title: 'Combat Ended',
      text: `${encounter.name} ended after ${encounter.round} round(s). Survivors: ${encounter.combatants.filter((c) => c.currentHp > 0).map((c) => c.name).join(', ') || 'none'}.`,
      tag: 'combat',
    });
    setEncounter(id!, null);
  }

  function removeCombatant(cid: string) {
    if (!encounter) return;
    setEncounter(id!, { ...encounter, combatants: encounter.combatants.filter((c) => c.id !== cid) });
  }

  function adjustHp(c: CombatantRef, delta: number) {
    let hp = c.currentHp + delta;
    let temp = c.tempHp;
    if (delta < 0 && temp > 0) {
      const fromTemp = Math.min(temp, -delta);
      temp -= fromTemp;
      hp = c.currentHp - (-delta - fromTemp);
    }
    hp = Math.max(0, Math.min(c.maxHp, hp));
    updateCombatant(id!, c.id, { currentHp: hp, tempHp: temp });
  }

  const filteredMonsters = monsterQuery.trim()
    ? monsters.filter((m) => m.name.toLowerCase().includes(monsterQuery.toLowerCase())).slice(0, 12)
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <h2>Combat Tracker</h2>

      {!encounter ? (
        <div className="panel">
          <p style={{ color: 'var(--text-dim)' }}>No active encounter. Start one to build your initiative order.</p>
          <button className="btn btn-primary" onClick={startEncounter}>Start Encounter</button>
        </div>
      ) : (
        <>
          <div className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <input
                value={encounter.name}
                onChange={(e) => setEncounter(id!, { ...encounter, name: e.target.value })}
                style={{ fontSize: '1.1rem', fontWeight: 700, background: 'transparent', border: 'none' }}
              />
              <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Round {encounter.round}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={rollAllInitiative}>Roll Initiative</button>
              <button className="btn btn-primary" onClick={nextTurn}>Next Turn</button>
              <button className="btn btn-danger" onClick={endEncounter}>End Encounter</button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {encounter.combatants.map((c, i) => (
              <div
                key={c.id}
                className="panel"
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                  borderColor: i === encounter.activeIndex ? 'var(--accent)' : undefined,
                  opacity: c.currentHp === 0 ? 0.55 : 1,
                }}
              >
                <input
                  type="number" value={c.initiative} title="Initiative"
                  onChange={(e) => updateCombatant(id!, c.id, { initiative: Number(e.target.value) })}
                  style={{ width: 54 }}
                />
                <strong style={{ minWidth: 120 }}>{c.name}{c.isPC ? ' (PC)' : ''}</strong>
                <span>AC {c.ac}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button className="btn btn-sm" onClick={() => adjustHp(c, -1)}>-1</button>
                  <button className="btn btn-sm" onClick={() => adjustHp(c, -5)}>-5</button>
                  <span>{c.currentHp}/{c.maxHp}{c.tempHp ? ` (+${c.tempHp})` : ''}</span>
                  <button className="btn btn-sm" onClick={() => adjustHp(c, 1)}>+1</button>
                  <button className="btn btn-sm" onClick={() => adjustHp(c, 5)}>+5</button>
                </div>
                <input
                  placeholder="conditions" value={c.conditions.join(', ')}
                  onChange={(e) => updateCombatant(id!, c.id, { conditions: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                  style={{ width: 140 }}
                />
                <button className="btn btn-sm btn-danger" onClick={() => removeCombatant(c.id)}>Remove</button>
              </div>
            ))}
          </div>

          <div className="panel">
            <div className="panel-title">Add Monster from Compendium</div>
            <input placeholder="Search monsters..." value={monsterQuery} onChange={(e) => setMonsterQuery(e.target.value)} style={{ marginBottom: 8, width: 260 }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {filteredMonsters.map((m) => (
                <button key={m.index} className="btn btn-sm" onClick={() => addMonster(m.index)}>
                  {m.name} (CR {m.challenge_rating})
                </button>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">Add Custom Combatant</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input placeholder="Name" value={manualName} onChange={(e) => setManualName(e.target.value)} style={{ width: 160 }} />
              <label>HP <input type="number" value={manualHp} onChange={(e) => setManualHp(Number(e.target.value))} style={{ width: 70 }} /></label>
              <label>AC <input type="number" value={manualAc} onChange={(e) => setManualAc(Number(e.target.value))} style={{ width: 60 }} /></label>
              <button className="btn" onClick={addManual}>Add</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
