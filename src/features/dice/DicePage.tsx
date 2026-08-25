import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useCharacterStore } from '../../store/useCharacterStore';
import { rollD20, rollDice, type DieSize } from '../../domain/dice';
import { formatModifier } from '../../domain/character';

const DICE: DieSize[] = [4, 6, 8, 10, 12, 20, 100];

export default function DicePage() {
  const { id } = useParams();
  const character = useCharacterStore((s) => (id ? s.characters[id] : undefined));
  const addRoll = useCharacterStore((s) => s.addRollLogEntry);
  const clearLog = useCharacterStore((s) => s.clearRollLog);
  const updateCharacter = useCharacterStore((s) => s.updateCharacter);

  const [modifier, setModifier] = useState(0);
  const [advantage, setAdvantage] = useState<'advantage' | 'disadvantage' | null>(null);
  const [label, setLabel] = useState('');
  const [diceCount, setDiceCount] = useState<Record<DieSize, number>>({ 4: 0, 6: 0, 8: 0, 10: 0, 12: 0, 20: 0, 100: 0 });

  if (!id || !character) return <div className="panel">Select a character first.</div>;

  function rollD20WithMod() {
    const result = rollD20(modifier, advantage);
    addRoll(id!, {
      label: label || (advantage ? `d20 (${advantage})` : 'd20'),
      formula: `d20${formatModifier(modifier)}${advantage ? ` (${advantage})` : ''}`,
      rolls: result.rolls as number[], total: result.total, advantage, isNat20: result.isNat20, isNat1: result.isNat1,
    });
    if (result.isNat20 && character && !character.inspiration) {
      if (confirm('Natural 20! Grant Heroic Inspiration?')) updateCharacter(id!, { inspiration: true });
    }
  }

  function rollPool() {
    const entries = Object.entries(diceCount) as [string, number][];
    const active = entries.filter(([, n]) => n > 0);
    if (active.length === 0) return;
    let allRolls: number[] = [];
    let total = modifier;
    const parts: string[] = [];
    for (const [size, count] of active) {
      const rolls = rollDice(count, Number(size) as DieSize);
      allRolls = allRolls.concat(rolls);
      total += rolls.reduce((a, b) => a + b, 0);
      parts.push(`${count}d${size}`);
    }
    if (modifier) parts.push(formatModifier(modifier));
    addRoll(id!, { label: label || 'Dice pool', formula: parts.join(' + '), rolls: allRolls, total });
    setDiceCount({ 4: 0, 6: 0, 8: 0, 10: 0, 12: 0, 20: 0, 100: 0 });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <h2>Dice</h2>

      <div className="panel">
        <div className="panel-title">d20 Roll (checks, saves, attacks)</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <label>Label <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="optional" style={{ width: 140 }} /></label>
          <label>Modifier <input type="number" value={modifier} onChange={(e) => setModifier(Number(e.target.value))} style={{ width: 70 }} /></label>
          <label><input type="radio" checked={advantage === null} onChange={() => setAdvantage(null)} /> Flat</label>
          <label><input type="radio" checked={advantage === 'advantage'} onChange={() => setAdvantage('advantage')} /> Advantage</label>
          <label><input type="radio" checked={advantage === 'disadvantage'} onChange={() => setAdvantage('disadvantage')} /> Disadvantage</label>
        </div>
        <button className="btn btn-primary" onClick={rollD20WithMod}>Roll d20{formatModifier(modifier)}</button>
      </div>

      <div className="panel">
        <div className="panel-title">Dice Pool (damage, tables)</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
          {DICE.map((size) => (
            <label key={size} className="stat-block" style={{ minWidth: 64 }}>
              <span className="stat-label">d{size}</span>
              <input
                type="number" min={0} value={diceCount[size]}
                onChange={(e) => setDiceCount((p) => ({ ...p, [size]: Math.max(0, Number(e.target.value)) }))}
                style={{ width: 46, textAlign: 'center' }}
              />
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <label>Modifier <input type="number" value={modifier} onChange={(e) => setModifier(Number(e.target.value))} style={{ width: 70 }} /></label>
          <button className="btn btn-primary" onClick={rollPool}>Roll Pool</button>
        </div>
      </div>

      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div className="panel-title">Roll History</div>
          <button className="btn btn-sm" onClick={() => clearLog(id!)}>Clear</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 420, overflowY: 'auto' }}>
          {character.rollLog.map((r) => (
            <div key={r.id} style={{ fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-soft)', paddingBottom: 4 }}>
              <span>{r.label} <span style={{ color: 'var(--text-faint)' }}>[{r.rolls.join(', ')}] {r.formula}</span></span>
              <strong style={{ color: r.isNat20 ? 'var(--gold)' : r.isNat1 ? 'var(--blood-strong)' : 'var(--text)' }}>{r.total}</strong>
            </div>
          ))}
          {character.rollLog.length === 0 && <div style={{ color: 'var(--text-faint)' }}>No rolls yet.</div>}
        </div>
      </div>
    </div>
  );
}
